import { Router } from 'express';
import { getServices, createService } from '../controllers/service.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', getServices);
router.post('/', authenticate, authorize(Role.ADMIN), createService);

export default router;