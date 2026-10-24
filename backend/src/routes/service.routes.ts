import { Router } from 'express';
import { getServices, createService, updateService, toggleService } from '../controllers/service.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', getServices);
router.post('/', authenticate, authorize(Role.ADMIN), createService);
router.put('/:id', authenticate, authorize(Role.ADMIN), updateService);
router.patch('/:id/toggle', authenticate, authorize(Role.ADMIN), toggleService);

export default router;