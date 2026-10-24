import { Request, Response, NextFunction } from 'express';
import { BookingStatus, Role } from '@prisma/client';
import {
  BookingConflictError,
  BookingForbiddenError,
  BookingNotFoundError,
  BookingValidationError,
  STAFF_UPDATABLE_STATUSES,
  createBooking,
  isBookingStatus,
  listBookings,
  listMyBookings,
  updateBookingStatus,
  rescheduleBooking,
  reviewBooking,
} from '../services/booking.service';

const parseFilters = (req: Request) => {
  const { date, status, staffId, customerId, page, limit } = req.query as Record<
    string,
    string | undefined
  >;

  if (status && !isBookingStatus(status)) {
    throw new BookingValidationError('Trạng thái không hợp lệ!');
  }

  return {
    date,
    status: status as BookingStatus | undefined,
    staffId,
    customerId,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  };
};

export const createBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { staffId, serviceId, timeSlotId, bookingDate, notes, customerId } = req.body;

    if (!staffId || !serviceId || !timeSlotId || !bookingDate) {
      res.status(400).json({
        message: 'staffId, serviceId, timeSlotId và bookingDate là bắt buộc!',
      });
      return;
    }

    const targetCustomerId =
      req.user.role === Role.ADMIN && customerId ? customerId : req.user.userId;

    const booking = await createBooking({
      customerId: targetCustomerId,
      staffId,
      serviceId,
      timeSlotId,
      bookingDate,
      notes: notes ?? null,
    });

    res.status(201).json({ booking });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      res.status(409).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};

export const getMyBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await listMyBookings(
      { userId: req.user.userId, role: req.user.role },
      parseFilters(req)
    );

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};

export const getAllBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await listBookings(parseFilters(req));
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};

export const patchBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !isBookingStatus(status) || !STAFF_UPDATABLE_STATUSES.includes(status)) {
      res.status(400).json({
        message: 'status không hợp lệ, chỉ nhận PENDING/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/NO_SHOW!',
      });
      return;
    }

    const booking = await updateBookingStatus(id, status, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({ booking });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      res.status(409).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingNotFoundError) {
      res.status(404).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};

export const rescheduleBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { bookingDate, timeSlotId, staffId } = req.body;

    if (!bookingDate || !timeSlotId) {
      res.status(400).json({ message: 'bookingDate và timeSlotId là bắt buộc!' });
      return;
    }

    const booking = await rescheduleBooking(
      id,
      { bookingDate, timeSlotId, staffId },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json({ booking });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      res.status(409).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingNotFoundError) {
      res.status(404).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};

export const reviewBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { rating, reviewComment } = req.body;

    if (rating === undefined || rating === null) {
      res.status(400).json({ message: 'rating là bắt buộc!' });
      return;
    }

    const booking = await reviewBooking(
      id,
      { rating: Number(rating), reviewComment },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json({ booking });
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      res.status(404).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ message: error.message, code: error.code });
      return;
    }
    next(error);
  }
};
