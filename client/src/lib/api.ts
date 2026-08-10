const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export class APIError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

export async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, ...init } = options;
  const url = `${API_URL}${endpoint}`;
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = localStorage.getItem("accessToken");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, { ...init, headers });

  if (response.ok) {
    return (await response.json()) as T;
  }

  // 401 Handling with Refresh Token Rotation Guard
  if (response.status === 401 && !skipAuth) {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      throw new APIError("Session expired. Please log in again.", 401);
    }

    // FIX: Queue parallel API requests while the token refreshes natively.
    // This prevents a thundering herd of 401 retries from crashing the auth server on app wake.
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshResponse.ok) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.dispatchEvent(new Event("auth:logout"));
          
          throw new APIError("Session expired. Please log in again.", 401);
        }

        const data = await refreshResponse.json();
        
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        
        isRefreshing = false;
        onRefreshed(data.accessToken);

      } catch (err) {
        isRefreshing = false;
        throw err;
      }
    }

    // If a refresh is already in flight, queue this request until it resolves
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(async (newToken) => {
        try {
          headers.set("Authorization", `Bearer ${newToken}`);
          
          const retryResponse = await fetch(url, { ...init, headers });

          if (!retryResponse.ok) {
            const errData = await retryResponse.json().catch(() => null);
            
            reject(
              new APIError(
                errData?.error || "Request failed after refresh",
                retryResponse.status,
                errData,
              ),
            );
          } else {
            resolve((await retryResponse.json()) as T);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  const errorData = await response.json().catch(() => null);

  throw new APIError(
    errorData?.error || `Request failed with status ${response.status}`,
    response.status,
    errorData,
  );
}