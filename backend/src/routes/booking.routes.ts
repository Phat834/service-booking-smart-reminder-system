import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  createBookingHandler,
  getAllBookings,
  getMyBookings,
  patchBookingStatus,
} from '../controllers/booking.controller';

const router = Router();

router.post('/', authenticate, createBookingHandler);
router.get('/my-bookings', authenticate, getMyBookings);
router.get('/', authenticate, authorize(Role.ADMIN), getAllBookings);
router.patch('/:id/status', authenticate, patchBookingStatus);

export default router;
