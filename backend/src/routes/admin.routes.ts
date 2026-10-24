import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import { getAdminStats, getStaffList, createStaff } from '../controllers/admin.controller';

const router = Router();

router.get('/stats', authenticate, authorize(Role.ADMIN), getAdminStats);
router.get('/staff', authenticate, authorize(Role.ADMIN), getStaffList);
router.post('/staff', authenticate, authorize(Role.ADMIN), createStaff);

export default router;
