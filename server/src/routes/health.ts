import { Router, Request, Response } from "express";
import pool from "../config/db";

const router = Router();

// Liveness check: Confirms the Node process is running and can accept HTTP requests.
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check: Confirms the application is actually fully connected and ready to serve traffic.
router.get("/ready", async (_req: Request, res: Response) => {
  const checks: Record<string, "ok" | "fail"> = {};

  try {
    // A lightweight ping to verify the connection pool is actively communicating with Postgres.
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ready" : "not ready",
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;