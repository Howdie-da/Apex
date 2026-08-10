import { Router, Request, Response } from "express";

import { authMiddleware } from "../middleware/authHttp";
import * as UserModel from "../models/user";
import { logger } from "../config/logger";

import type { TypedServer } from "../types/socket";

const router = Router();
const log = logger.child({ module: "routes:users" });

router.get("/", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      
      const usernameQuery =
        typeof req.query.username === "string" ? req.query.username.trim() : "";

      // We short-circuit empty queries here to prevent the DB from executing an expensive unfiltered ILIKE scan.
      if (!usernameQuery) {
        res.json([]);
        return;
      }

      const matches = await UserModel.searchUsers(usernameQuery, userId);
      
      res.json(matches);

    } catch (err) {
      log.error({ err }, "Failed to search users");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

router.patch("/me/display-name", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { displayName } = req.body;

      if (
        !displayName ||
        typeof displayName !== "string" ||
        displayName.trim().length === 0
      ) {
        res.status(400).json({ error: "Display name is required." });
        return;
      }

      await UserModel.updateDisplayName(userId, displayName.trim());

      const io: TypedServer = req.app.get("io");
      
      if (io) {
        // We broadcast this globally rather than iterating through rooms. 
        // Handles the edge case where users might see stale names in the global search dropdown.
        io.emit("user:display-name-changed", {
          userId,
          newDisplayName: displayName.trim(),
        });
      }

      res.json({ success: true });

    } catch (err) {
      log.error({ err }, "Failed to update display name");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

export default router;