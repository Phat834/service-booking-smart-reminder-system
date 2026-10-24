import { Router } from 'express';
import { getAvailableSlots, getSlots, createSlot } from '../controllers/slot.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/available', getAvailableSlots);
router.get('/', getSlots);
router.post('/', authenticate, authorize(Role.ADMIN), createSlot);

export default router;
