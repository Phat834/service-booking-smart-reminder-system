import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import { getAdminStats } from '../controllers/admin.controller';

const router = Router();

router.get('/stats', authenticate, authorize(Role.ADMIN), getAdminStats);

export default router;
