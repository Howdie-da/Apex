import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authHttp";
import * as UserModel from "../models/user";
import { logger } from "../config/logger";

const router = Router();
const log = logger.child({ module: "routes:keys" });

// Handles the upload of public keys for ECDH key exchange, alongside an optionally encrypted
// private key backup. The server never sees the plaintext private key (Zero-Knowledge Architecture).
router.put("/public", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { publicKey, encryptedPrivateKey } = req.body;

      if (!publicKey || typeof publicKey !== "string") {
        res
          .status(400)
          .json({ error: "publicKey (Base64 string) is required." });
        return;
      }

      // Forces length validation to prevent malicious clients from inserting massive arbitrary payloads into the public_key column.
      if (publicKey.length < 100 || publicKey.length > 512) {
        res.status(400).json({ error: "Invalid public key format." });
        return;
      }

      if (encryptedPrivateKey && typeof encryptedPrivateKey !== "string") {
        res
          .status(400)
          .json({ error: "encryptedPrivateKey must be a string if provided." });
        return;
      }

      await UserModel.saveE2EEKeys(
        userId,
        publicKey,
        encryptedPrivateKey || null,
      );

      log.debug(
        { userId, hasBackup: !!encryptedPrivateKey },
        "E2EE keys uploaded",
      );

      res.json({ ok: true });

    } catch (err) {
      log.error({ err }, "Failed to save public key");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

// Fetches a target user's public key so the local client can derive the shared ECDH secret.
router.get("/:userId", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const targetUserId = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;

      if (!targetUserId) {
        res.status(400).json({ error: "userId is required." });
        return;
      }

      const publicKey = await UserModel.getPublicKey(targetUserId);
      
      if (!publicKey) {
        res.status(404).json({ error: "Public key not found for user." });
        return;
      }

      res.json({ userId: targetUserId, publicKey });

    } catch (err) {
      log.error({ err }, "Failed to fetch public key");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

export default router;