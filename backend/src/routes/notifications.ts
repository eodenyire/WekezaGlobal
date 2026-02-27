import { Router, Response, NextFunction } from 'express';
import * as notificationService from '../services/notificationService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── GET /v1/notifications ───────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit      = parseInt(req.query.limit      as string) || 50;
    const offset     = parseInt(req.query.offset     as string) || 0;
    const unreadOnly = req.query.unread === 'true';
    const result = await notificationService.getUserNotifications(
      req.user!.userId,
      limit,
      offset,
      unreadOnly
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/notifications/:notification_id/read ─────────────────────────────

router.put('/:notification_id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.notification_id,
      req.user!.userId
    );
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/notifications/read-all ──────────────────────────────────────────

router.put('/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.markAllAsRead(req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
