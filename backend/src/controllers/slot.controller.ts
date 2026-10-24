import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BookingStatus } from '@prisma/client';

export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, date } = req.query;

    if (!staffId || !date) {
      res.status(400).json({ message: 'staffId and date are required' });
      return;
    }

    const allTimeSlots = await prisma.timeSlot.findMany({
      orderBy: { startTime: 'asc' },
    });

    const bookingDate = new Date(date as string);

    const bookings = await prisma.booking.findMany({
      where: {
        staffId: staffId as string,
        bookingDate,
        status: { not: BookingStatus.CANCELLED },
      },
      select: {
        timeSlotId: true,
      },
    });

    const bookedTimeSlotIds = new Set(bookings.map((b) => b.timeSlotId));

    const slots = allTimeSlots.map((slot) => ({
      ...slot,
      isBooked: bookedTimeSlotIds.has(slot.id),
    }));

    res.status(200).json({ slots });
  } catch (error) {
    next(error);
  }
};

export const getSlots = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slots = await prisma.timeSlot.findMany({ orderBy: { startTime: 'asc' } });
    res.status(200).json({ slots });
  } catch (error) {
    next(error);
  }
};

export const createSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) {
      res.status(400).json({ message: 'startTime và endTime là bắt buộc!' });
      return;
    }
    const slot = await prisma.timeSlot.create({
      data: { startTime, endTime },
    });
    res.status(201).json({ slot });
  } catch (error) {
    next(error);
  }
};
