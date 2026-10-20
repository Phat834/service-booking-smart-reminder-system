import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const getServices = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, durationMinutes, price, isActive } = req.body;

    if (!name || durationMinutes === undefined || price === undefined) {
      res.status(400).json({ message: 'name, durationMinutes and price are required' });
      return;
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        durationMinutes: Number(durationMinutes),
        price,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
};
