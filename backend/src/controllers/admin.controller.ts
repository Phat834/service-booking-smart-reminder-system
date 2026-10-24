import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { Role, BookingStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const parseDateOnly = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return new Date();
  }
  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
};

export const getAdminStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        staff: { select: { id: true, fullName: true, email: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    });

    let actualRevenue = 0;
    let expectedRevenue = 0;
    for (const booking of bookings) {
      if (booking.status === BookingStatus.COMPLETED) {
        actualRevenue += Number(booking.service.price);
      }
      if (
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.IN_PROGRESS ||
        booking.status === BookingStatus.PENDING
      ) {
        expectedRevenue += Number(booking.service.price);
      }
    }

    const bookingsByStatus = {
      PENDING: 0,
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };

    for (const booking of bookings) {
      bookingsByStatus[booking.status]++;
    }

    const totalBookings = bookings.length;
    const cancellationRate = totalBookings === 0 ? 0 : Number(((bookingsByStatus.CANCELLED / totalBookings) * 100).toFixed(2));
    const noShowRate = totalBookings === 0 ? 0 : Number(((bookingsByStatus.NO_SHOW / totalBookings) * 100).toFixed(2));

    const staffPerformanceMap = new Map<string, any>();
    for (const booking of bookings) {
      if (booking.staff) {
        const staffId = booking.staff.id;
        if (!staffPerformanceMap.has(staffId)) {
          staffPerformanceMap.set(staffId, {
            staffId: booking.staff.id,
            staffName: booking.staff.fullName,
            staffEmail: booking.staff.email,
            totalBookings: 0,
            completedBookings: 0,
            revenue: 0,
            noShowCount: 0,
            ratings: [],
          });
        }
        const stats = staffPerformanceMap.get(staffId);
        stats.totalBookings++;
        if (booking.status === BookingStatus.COMPLETED) {
          stats.completedBookings++;
          stats.revenue += Number(booking.service.price);
        }
        if (booking.status === BookingStatus.NO_SHOW) {
          stats.noShowCount++;
        }
        if (booking.rating !== null && booking.rating !== undefined) {
          stats.ratings.push(booking.rating);
        }
      }
    }

    const staffPerformance = Array.from(staffPerformanceMap.values()).map((s) => {
      const avg = s.ratings.length === 0 ? null : Number((s.ratings.reduce((a: number, b: number) => a + b, 0) / s.ratings.length).toFixed(2));
      const { ratings, ...rest } = s;
      return { ...rest, averageRating: avg };
    });

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfWeekDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    const [staffCount, slotCount, bookingsTodayWeek] = await Promise.all([
      prisma.user.count({ where: { role: Role.STAFF } }),
      prisma.timeSlot.count(),
      prisma.booking.findMany({
        where: {
          bookingDate: { gte: startOfWeekDate, lt: todayEnd },
          status: { not: BookingStatus.CANCELLED },
        },
        select: { id: true },
      }),
    ]);

    const totalSlotsWeek = staffCount * slotCount * 7;
    const occupancyRate = totalSlotsWeek === 0 ? 0 : Number(((bookingsTodayWeek.length / totalSlotsWeek) * 100).toFixed(2));

    res.status(200).json({
      totalRevenue: actualRevenue,
      actualRevenue,
      expectedRevenue,
      bookingsByStatus,
      cancellationRate,
      noShowRate,
      occupancyRate,
      staffPerformance,
    });
  } catch (error) {
    next(error);
  }
};

export const getStaffList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: Role.STAFF },
      select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const staffWithStats = await Promise.all(
      staff.map(async (s) => {
        const bookings = await prisma.booking.findMany({
          where: { staffId: s.id },
          include: { service: { select: { price: true } } },
        });
        const totalBookings = bookings.length;
        const completedBookings = bookings.filter((b) => b.status === BookingStatus.COMPLETED).length;
        const ratings = bookings.filter((b) => b.rating !== null && b.rating !== undefined).map((b) => b.rating as number);
        const averageRating = ratings.length === 0 ? null : Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2));
        return { ...s, totalBookings, completedBookings, averageRating };
      })
    );

    res.status(200).json({ staff: staffWithStats });
  } catch (error) {
    console.error('getStaffList error:', error);
    next(error);
  }
};

export const toggleStaffStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff) {
      res.status(404).json({ message: 'Không tìm thấy nhân viên!' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !staff.isActive },
    });
    res.status(200).json({ staff: updated });
  } catch (error) {
    console.error('toggleStaffStatus error:', error);
    next(error);
  }
};

export const updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, phone } = req.body;

    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff) {
      res.status(404).json({ message: 'Không tìm thấy nhân viên!' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    });
    res.status(200).json({ staff: updated });
  } catch (error) {
    console.error('updateStaff error:', error);
    next(error);
  }
};

export const createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fullName, email, password, phone } = req.body;
    if (!fullName || !email || !password) {
      res.status(400).json({ message: 'fullName, email, password là bắt buộc!' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email đã tồn tại!' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const staff = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: Role.STAFF,
        phone: phone || null,
      },
      select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
    });
    res.status(201).json({ staff });
  } catch (error) {
    next(error);
  }
};
