import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const getStaff = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });
    res.status(200).json({ staff });
  } catch (error) {
    next(error);
  }
};
