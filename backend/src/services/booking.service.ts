 import { BookingStatus, Prisma, Role } from '@prisma/client';
 import { prisma } from '../config/prisma';
 import { createNotification } from './notification.service';
 import { sseService } from './sse.service';

 export const SLOT_CONFLICT_MESSAGE =
   'Khung giá» nÃ y vá»«a cÃ³ ngÆ°á»i Ä‘áº·t, vui lÃ²ng chá»n khung giá» khÃ¡c!';

 export const BOOKING_UPDATED_CONFLICT_MESSAGE =
   'Lá»‹ch háº¹n vá»«a Ä‘Æ°á»£c cáº­p nháº­t bá»Ÿi ngÆ°á»i khÃ¡c, vui lÃ²ng táº£i láº¡i dá»¯ liá»‡u!';

 export const FOUR_HOUR_CUTOFF_MESSAGE =
   'ChÃ­nh sÃ¡ch hoÃ n/há»§y: Chá»‰ Ä‘Æ°á»£c phÃ©p há»§y hoáº·c Ä‘á»•i lá»‹ch trÆ°á»›c giá» háº¹n Ã­t nháº¥t 4 tiáº¿ng.';

 export class BookingConflictError extends Error {
   public readonly code = 'BOOKING_SLOT_CONFLICT';

   constructor(message: string = SLOT_CONFLICT_MESSAGE) {
     super(message);
     this.name = 'BookingConflictError';
     Object.setPrototypeOf(this, BookingConflictError.prototype);
   }
 }

 export class BookingValidationError extends Error {
   public readonly code = 'BOOKING_VALIDATION_ERROR';

   constructor(message: string) {
     super(message);
     this.name = 'BookingValidationError';
     Object.setPrototypeOf(this, BookingValidationError.prototype);
   }
 }

 export class BookingNotFoundError extends Error {
   public readonly code = 'BOOKING_NOT_FOUND';

   constructor(message: string = 'KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n!') {
     super(message);
     this.name = 'BookingNotFoundError';
     Object.setPrototypeOf(this, BookingNotFoundError.prototype);
   }
 }

 export class BookingForbiddenError extends Error {
   public readonly code = 'BOOKING_FORBIDDEN';

   constructor(message: string = 'Forbidden: KhÃ´ng cÃ³ quyá»n thá»±c hiá»‡n thao tÃ¡c nÃ y!') {
     super(message);
     this.name = 'BookingForbiddenError';
     Object.setPrototypeOf(this, BookingForbiddenError.prototype);
   }
 }

const bookingInclude = {
  customer: { select: { id: true, fullName: true, email: true, phone: true } },
  staff: { select: { id: true, fullName: true, email: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true } },
  timeSlot: { select: { id: true, startTime: true, endTime: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export interface CreateBookingInput {
  customerId: string;
  staffId: string;
  serviceId: string;
  timeSlotId: string;
  bookingDate: string;
  notes?: string | null;
}

export interface BookingFilters {
  date?: string;
  status?: BookingStatus;
  staffId?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

export interface BookingListResult {
  bookings: BookingWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

 export interface ReviewBookingInput {
   rating: number;
   reviewComment?: string | null;
 }

 export interface RescheduleBookingInput {
   bookingDate: string;
   timeSlotId: string;
   staffId?: string;
 }

 export const STAFF_UPDATABLE_STATUSES: BookingStatus[] = [
   BookingStatus.CONFIRMED,
   BookingStatus.IN_PROGRESS,
   BookingStatus.COMPLETED,
   BookingStatus.CANCELLED,
   BookingStatus.NO_SHOW,
 ];

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

 const parseTimeToMinutes = (time: string): number => {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(time.trim());
  if (!match) {
    throw new BookingValidationError('timeSlot khÃ´ng há»£p lá»‡!');
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
};

const getBookingStartDateTime = (bookingDate: Date | string, startTime: string): Date => {
  const dateOnly = typeof bookingDate === 'string' ? bookingDate.trim().slice(0, 10) : bookingDate.toISOString().slice(0, 10);
  const timeMinutes = parseTimeToMinutes(startTime);
  const hours = Math.floor(timeMinutes / 60);
  const mins = timeMinutes % 60;
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCHours(hours, mins, 0, 0);
  return date;
};

const enforceFourHourCutoff = (
  actorRole: Role,
  bookingDate: Date | string,
  startTime: string,
  now: Date = new Date()
): void => {
  if (actorRole === Role.ADMIN || actorRole === Role.STAFF) {
    return;
  }
  const start = getBookingStartDateTime(bookingDate, startTime);
  const diffMs = start.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 4) {
    throw new BookingValidationError(FOUR_HOUR_CUTOFF_MESSAGE);
  }
};

const buildSlotLockKey = (staffId: string, bookingDate: string, timeSlotId: string): string =>
  `booking-slot:${staffId}:${bookingDate}:${timeSlotId}`;

const acquireSlotLock = async (
  tx: Prisma.TransactionClient,
  lockKey: string
): Promise<void> => {
  await tx.$queryRawUnsafe(
    `SELECT 1 AS "ok" FROM pg_advisory_xact_lock(hashtext($1)::bigint)`,
    lockKey
  );
};

const lockSlotBookings = async (
  tx: Prisma.TransactionClient,
  staffId: string,
  bookingDate: string,
  timeSlotId: string
): Promise<Array<{ id: string; status: BookingStatus }>> => {
  return tx.$queryRawUnsafe<Array<{ id: string; status: BookingStatus }>>(
    `SELECT "id", "status"
       FROM "Booking"
      WHERE "staffId" = $1::uuid
        AND "bookingDate" = $2::date
        AND "timeSlotId" = $3::uuid
        AND "status" <> 'CANCELLED'::"BookingStatus"
      FOR UPDATE`,
    staffId,
    bookingDate,
    timeSlotId
  );
};

export const createBooking = async (
  input: CreateBookingInput
): Promise<BookingWithRelations> => {
  if (!isUuid(input.customerId) || !isUuid(input.staffId) || !isUuid(input.serviceId) || !isUuid(input.timeSlotId)) {
    throw new BookingValidationError('CÃ¡c Ä‘á»‹nh danh staffId, serviceId, timeSlotId khÃ´ng há»£p lá»‡!');
  }

  const bookingDate = parseDateOnly(input.bookingDate);
  const bookingDateOnly = input.bookingDate.trim().slice(0, 10);
  const lockKey = buildSlotLockKey(input.staffId, bookingDateOnly, input.timeSlotId);

  try {
    return await prisma.$transaction(
      async (tx) => {
        await acquireSlotLock(tx, lockKey);

        const lockedRows = await lockSlotBookings(tx, input.staffId, bookingDateOnly, input.timeSlotId);
        if (lockedRows.length > 0) {
          throw new BookingConflictError();
        }

        const [staff, service, timeSlot] = await Promise.all([
          tx.user.findUnique({ where: { id: input.staffId }, select: { id: true, role: true } }),
          tx.service.findUnique({ where: { id: input.serviceId }, select: { id: true, isActive: true } }),
          tx.timeSlot.findUnique({ where: { id: input.timeSlotId }, select: { id: true } }),
        ]);

        if (!staff || staff.role !== Role.STAFF) {
          throw new BookingValidationError('NhÃ¢n viÃªn phá»¥c vá»¥ khÃ´ng tá»“n táº¡i!');
        }
        if (!service || !service.isActive) {
          throw new BookingValidationError('Dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ ngá»«ng hoáº¡t Ä‘á»™ng!');
        }
        if (!timeSlot) {
          throw new BookingValidationError('Khung giá» khÃ´ng tá»“n táº¡i!');
        }

        const booking = await tx.booking.create({
          data: {
            customerId: input.customerId,
            staffId: input.staffId,
            serviceId: input.serviceId,
            timeSlotId: input.timeSlotId,
            bookingDate,
            status: BookingStatus.PENDING,
            notes: input.notes ?? null,
          },
          include: bookingInclude,
        });

        await createNotification({
          userId: booking.staffId,
          title: 'Lich hen moi',
          message: 'Khach hang ' + booking.customer.fullName + ' da dat lich hen moi',
        });

        return booking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (error instanceof BookingConflictError || error instanceof BookingValidationError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034' || error.code === 'P2002') {
        throw new BookingConflictError();
      }
    }
    throw error;
  }
};

const buildWhereClause = (filters: BookingFilters): Prisma.BookingWhereInput => {
  const where: Prisma.BookingWhereInput = {};

  if (filters.date) {
    where.bookingDate = parseDateOnly(filters.date);
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.staffId) {
    if (!isUuid(filters.staffId)) {
      throw new BookingValidationError('staffId khÃ´ng há»£p lá»‡!');
    }
    where.staffId = filters.staffId;
  }
  if (filters.customerId) {
    if (!isUuid(filters.customerId)) {
      throw new BookingValidationError('customerId khÃ´ng há»£p lá»‡!');
    }
    where.customerId = filters.customerId;
  }

  return where;
};

const parseDateOnly = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    throw new BookingValidationError('bookingDate không hợp lệ, cần định dạng YYYY-MM-DD!');
  }
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BookingValidationError('bookingDate không hợp lệ, cần định dạng YYYY-MM-DD!');
  }
  return date;
};

const resolvePagination = (filters: BookingFilters): { page: number; limit: number } => {
  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? Math.floor(filters.page as number) : 1;
  const limit =
    Number.isFinite(filters.limit) && (filters.limit as number) > 0
      ? Math.min(100, Math.floor(filters.limit as number))
      : 20;

  return { page, limit };
};

const getBookingById = async (id: string): Promise<BookingWithRelations> => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
  if (!booking) {
    throw new BookingNotFoundError();
  }
  return booking;
};

export const listBookings = async (filters: BookingFilters): Promise<BookingListResult> => {
  const where = buildWhereClause(filters);
  const { page, limit } = resolvePagination(filters);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ bookingDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const listMyBookings = async (
  actor: { userId: string; role: Role },
  filters: BookingFilters
): Promise<BookingListResult> => {
  const where = buildWhereClause(filters);

  if (actor.role === Role.CUSTOMER) {
    where.customerId = actor.userId;
  } else if (actor.role === Role.STAFF) {
    where.staffId = actor.userId;
  }

  const { page, limit } = resolvePagination(filters);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ bookingDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const updateBookingStatus = async (
  bookingId: string,
  status: BookingStatus,
  actor: { userId: string; role: Role }
): Promise<BookingWithRelations> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { timeSlot: true },
  });

  if (!booking) {
    throw new BookingNotFoundError();
  }

  if (actor.role === Role.CUSTOMER) {
    if (booking.customerId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Báº¡n khÃ´ng cÃ³ quyá»n thay Ä‘á»•i lá»‹ch háº¹n cá»§a ngÆ°á»i khÃ¡c!');
    }
    if (status !== BookingStatus.CANCELLED) {
      throw new BookingForbiddenError('Forbidden: KhÃ¡ch hÃ ng chá»‰ Ä‘Æ°á»£c há»§y lá»‹ch háº¹n!');
    }
    enforceFourHourCutoff(actor.role, booking.bookingDate, booking.timeSlot.startTime);
  } else if (actor.role === Role.STAFF) {
    if (booking.staffId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Báº¡n khÃ´ng cÃ³ quyá»n thay Ä‘á»•i lá»‹ch háº¹n cá»§a nhÃ¢n viÃªn khÃ¡c!');
    }
    if (!STAFF_UPDATABLE_STATUSES.includes(status)) {
      throw new BookingValidationError('Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡!');
    }
  } else if (actor.role === Role.ADMIN) {
    if (!STAFF_UPDATABLE_STATUSES.includes(status)) {
      throw new BookingValidationError('Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡!');
    }
  }

  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, version: booking.version },
    data: { status, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw new BookingConflictError(BOOKING_UPDATED_CONFLICT_MESSAGE);
  }

  const updatedBooking = await getBookingById(booking.id);

  if (status === BookingStatus.CONFIRMED || status === BookingStatus.CANCELLED) {
    await createNotification({
      userId: updatedBooking.customerId,
      title: status === BookingStatus.CONFIRMED ? 'Lich hen da duoc xac nhan' : 'Lich hen da bi huy',
      message: status === BookingStatus.CONFIRMED ? 'Lich hen cua ban da duoc xac nhan' : 'Lich hen cua ban da bi huy',
    });
  } else if (status === BookingStatus.IN_PROGRESS) {
    await createNotification({
      userId: updatedBooking.customerId,
      title: 'Lich hen dang thuc hien',
      message: 'Lich hen cua ban dang duoc thuc hien',
    });
  } else if (status === BookingStatus.NO_SHOW) {
    await createNotification({
      userId: updatedBooking.customerId,
      title: 'Khach khong den',
      message: 'Lich hen da duoc ghi nhan la khach khong den',
    });
  }

  sseService.sendToUser(updatedBooking.customerId, { type: 'booking:status', data: updatedBooking });
  sseService.sendToUser(updatedBooking.staffId, { type: 'booking:status', data: updatedBooking });

  return updatedBooking;
};

export const isBookingStatus = (value: string): value is BookingStatus =>
  Object.values(BookingStatus).includes(value as BookingStatus);

 export const rescheduleBooking = async (
  bookingId: string,
  input: RescheduleBookingInput,
  actor: { userId: string; role: Role }
): Promise<BookingWithRelations> => {
  if (!isUuid(bookingId)) {
    throw new BookingValidationError('ID lá»‹ch háº¹n khÃ´ng há»£p lá»‡!');
  }
  if (!isUuid(input.timeSlotId)) {
    throw new BookingValidationError('timeSlotId khÃ´ng há»£p lá»‡!');
  }
  if (input.staffId && !isUuid(input.staffId)) {
    throw new BookingValidationError('staffId khÃ´ng há»£p lá»‡!');
  }

  const bookingDate = parseDateOnly(input.bookingDate);
  const bookingDateOnly = input.bookingDate.trim().slice(0, 10);

  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { timeSlot: true },
  });
  if (!existing) {
    throw new BookingNotFoundError();
  }

  if (actor.role === Role.CUSTOMER) {
    if (existing.customerId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Báº¡n khÃ´ng cÃ³ quyá»n thay Ä‘á»•i lá»‹ch háº¹n cá»§a ngÆ°á»i khÃ¡c!');
    }
    enforceFourHourCutoff(actor.role, existing.bookingDate, existing.timeSlot.startTime);
  } else if (actor.role === Role.STAFF) {
    if (existing.staffId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Báº¡n khÃ´ng cÃ³ quyá»n thay Ä‘á»•i lá»‹ch háº¹n cá»§a nhÃ¢n viÃªn khÃ¡c!');
    }
  }

  const targetStaffId = input.staffId || existing.staffId;
  const lockKey = buildSlotLockKey(targetStaffId, bookingDateOnly, input.timeSlotId);

  try {
    return await prisma.$transaction(
      async (tx) => {
        await acquireSlotLock(tx, lockKey);

        const lockedRows = await lockSlotBookings(tx, targetStaffId, bookingDateOnly, input.timeSlotId);
        const conflicting = lockedRows.filter((row) => row.id !== existing.id);
        if (conflicting.length > 0) {
          throw new BookingConflictError();
        }

        const [staff, timeSlot] = await Promise.all([
          tx.user.findUnique({ where: { id: targetStaffId }, select: { id: true, role: true } }),
          tx.timeSlot.findUnique({ where: { id: input.timeSlotId }, select: { id: true } }),
        ]);
        if (!staff || staff.role !== Role.STAFF) {
          throw new BookingValidationError('NhÃ¢n viÃªn phá»¥c vá»¥ khÃ´ng tá»“n táº¡i!');
        }
        if (!timeSlot) {
          throw new BookingValidationError('Khung giá» khÃ´ng tá»“n táº¡i!');
        }

        const updated = await tx.booking.updateMany({
          where: { id: existing.id, version: existing.version },
          data: {
            staffId: targetStaffId,
            timeSlotId: input.timeSlotId,
            bookingDate,
            version: { increment: 1 },
            isReminderSent: false,
            isReminder2hSent: false,
          },
        });

        if (updated.count === 0) {
          throw new BookingConflictError(BOOKING_UPDATED_CONFLICT_MESSAGE);
        }

        const updatedBooking = await tx.booking.findUnique({
          where: { id: existing.id },
          include: bookingInclude,
        });
        if (!updatedBooking) {
          throw new BookingNotFoundError();
        }

        await createNotification({
          userId: updatedBooking.customerId,
          title: 'Lich hen da doi gio',
          message: 'Lich hen cua ban da duoc doi sang ngay/gio khac',
        });
        await createNotification({
          userId: updatedBooking.staffId,
          title: 'Lich hen da doi gio',
          message: 'Co lich hen da duoc doi gio',
        });

        sseService.sendToUser(updatedBooking.customerId, { type: 'booking:rescheduled', data: updatedBooking });
        sseService.sendToUser(updatedBooking.staffId, { type: 'booking:rescheduled', data: updatedBooking });

        return updatedBooking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (error instanceof BookingConflictError || error instanceof BookingValidationError || error instanceof BookingForbiddenError || error instanceof BookingNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034' || error.code === 'P2002') {
        throw new BookingConflictError();
      }
    }
    throw error;
  }
};

export const reviewBooking = async (
  bookingId: string,
  input: ReviewBookingInput,
  actor: { userId: string; role: Role }
): Promise<BookingWithRelations> => {
  if (!isUuid(bookingId)) {
    throw new BookingValidationError('ID lá»‹ch háº¹n khÃ´ng há»£p lá»‡!');
  }
  if (!input.rating || input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
    throw new BookingValidationError('rating pháº£i lÃ  sá»‘ nguyÃªn tá»« 1 Ä‘áº¿n 5!');
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new BookingNotFoundError();
  }
  if (actor.role !== Role.CUSTOMER) {
    throw new BookingForbiddenError('Forbidden: Chá»‰ khÃ¡ch hÃ ng má»›i Ä‘Æ°á»£c Ä‘Ã¡nh giÃ¡!');
  }
  if (booking.customerId !== actor.userId) {
    throw new BookingForbiddenError('Forbidden: Báº¡n khÃ´ng cÃ³ quyá»n Ä‘Ã¡nh giÃ¡ lá»‹ch háº¹n cá»§a ngÆ°á»i khÃ¡c!');
  }
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new BookingValidationError('Chá»‰ cÃ³ thá»ƒ Ä‘Ã¡nh giÃ¡ lá»‹ch háº¹n Ä‘Ã£ hoÃ n thÃ nh!');
  }
  if (booking.rating !== null) {
    throw new BookingValidationError('Lá»‹ch háº¹n nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Ã¡nh giÃ¡!');
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      rating: input.rating,
      reviewComment: input.reviewComment ?? null,
    },
  });

  return getBookingById(booking.id);
};
