import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

export const getAdminStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get all bookings
    const bookings = await prisma.booking.findMany({
      include: {
        staff: { select: { id: true, fullName: true, email: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    });

    // Calculate total revenue from COMPLETED bookings
    let totalRevenue = 0;
    for (const booking of bookings) {
      if (booking.status === 'COMPLETED') {
        totalRevenue += Number(booking.service.price);
      }
    }

    // Count bookings by status
    const bookingsByStatus = {
      PENDING: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const booking of bookings) {
      bookingsByStatus[booking.status]++;
    }

    // Calculate staff performance
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
          });
        }
        const stats = staffPerformanceMap.get(staffId);
        stats.totalBookings++;
        if (booking.status === 'COMPLETED') {
          stats.completedBookings++;
          stats.revenue += Number(booking.service.price);
        }
      }
    }

    const staffPerformance = Array.from(staffPerformanceMap.values());

    res.status(200).json({
      totalRevenue,
      bookingsByStatus,
      staffPerformance,
    });
  } catch (error) {
    next(error);
  }
};
