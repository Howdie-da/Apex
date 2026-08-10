import pino from "pino";
import { env } from "./env";

// Bypasses synchronous console.log bottlenecks by using Pino's asynchronous transport layer.
export const logger = pino({
  level: env.IS_PRODUCTION ? "info" : "debug",
  transport: env.IS_PRODUCTION ? undefined : {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});
