import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  createBookingHandler,
  getAllBookings,
  getMyBookings,
  patchBookingStatus,
  rescheduleBookingHandler,
  reviewBookingHandler,
} from '../controllers/booking.controller';

const router = Router();

router.post('/', authenticate, createBookingHandler);
router.get('/my-bookings', authenticate, getMyBookings);
router.get('/', authenticate, authorize(Role.ADMIN), getAllBookings);
router.patch('/:id/status', authenticate, patchBookingStatus);
router.patch('/:id/reschedule', authenticate, rescheduleBookingHandler);
router.post('/:id/review', authenticate, reviewBookingHandler);

export default router;
