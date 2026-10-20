import { Router } from 'express';
import { getAvailableSlots } from '../controllers/slot.controller';

const router = Router();

router.get('/available', getAvailableSlots);

export default router;
