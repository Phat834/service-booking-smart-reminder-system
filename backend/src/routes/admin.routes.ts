import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import { getAdminStats, getStaffList, createStaff, toggleStaffStatus, updateStaff } from '../controllers/admin.controller';

const router = Router();

router.get('/stats', authenticate, authorize(Role.ADMIN), getAdminStats);
router.get('/staff', authenticate, authorize(Role.ADMIN), getStaffList);
router.post('/staff', authenticate, authorize(Role.ADMIN), createStaff);
router.put('/staff/:id', authenticate, authorize(Role.ADMIN), updateStaff);
router.patch('/staff/:id/toggle', authenticate, authorize(Role.ADMIN), toggleStaffStatus);

export default router;
