import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const services = await prisma.service.findMany({ where: { isActive: true } });
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, durationMinutes, price, isActive, bufferMinutes } = req.body;

    if (!name || durationMinutes === undefined || price === undefined) {
      res.status(400).json({ message: 'name, durationMinutes and price are required' });
      return;
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        durationMinutes: Number(durationMinutes),
        bufferMinutes: bufferMinutes !== undefined && bufferMinutes !== null ? Number(bufferMinutes) : 15,
        price: Number(price),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, durationMinutes, bufferMinutes, price } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (durationMinutes !== undefined && durationMinutes !== null) data.durationMinutes = Number(durationMinutes);
    if (bufferMinutes !== undefined && bufferMinutes !== null) data.bufferMinutes = Number(bufferMinutes);
    if (price !== undefined && price !== null) data.price = Number(price);

    const service = await prisma.service.update({
      where: { id },
      data,
    });

    res.status(200).json({ service });
  } catch (error) {
    next(error);
  }
};

export const toggleService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      res.status(404).json({ message: 'Không tìm thấy dịch vụ!' });
      return;
    }
    const updated = await prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });
    res.status(200).json({ service: updated });
  } catch (error) {
    next(error);
  }
};
