import { Router } from 'express';
import { getStaff } from '../controllers/user.controller';

const router = Router();

router.get('/staff', getStaff);

export default router;
