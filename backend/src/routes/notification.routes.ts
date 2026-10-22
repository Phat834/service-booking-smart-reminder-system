import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getNotificationsHandler,
  markAsReadHandler,
  streamNotificationsHandler,
} from '../controllers/notification.controller';

const router = Router();

router.get('/stream', authenticate, streamNotificationsHandler);
router.get('/', authenticate, getNotificationsHandler);
router.patch('/:id/read', authenticate, markAsReadHandler);

export default router;
