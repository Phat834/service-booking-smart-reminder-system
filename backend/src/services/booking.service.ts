import { BookingStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { createNotification } from './notification.service';
import { sseService } from './sse.service';

export const SLOT_CONFLICT_MESSAGE =
  'Khung giờ này vừa có người đặt, vui lòng chọn khung giờ khác!';

export const BOOKING_UPDATED_CONFLICT_MESSAGE =
  'Lịch hẹn vừa được cập nhật bởi người khác, vui lòng tải lại dữ liệu!';

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

  constructor(message: string = 'Không tìm thấy lịch hẹn!') {
    super(message);
    this.name = 'BookingNotFoundError';
    Object.setPrototypeOf(this, BookingNotFoundError.prototype);
  }
}

export class BookingForbiddenError extends Error {
  public readonly code = 'BOOKING_FORBIDDEN';

  constructor(message: string = 'Forbidden: Không có quyền thực hiện thao tác này!') {
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

export const STAFF_UPDATABLE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
];

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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
    throw new BookingValidationError('Các định danh staffId, serviceId, timeSlotId không hợp lệ!');
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
          throw new BookingValidationError('Nhân viên phục vụ không tồn tại!');
        }
        if (!service || !service.isActive) {
          throw new BookingValidationError('Dịch vụ không tồn tại hoặc đã ngừng hoạt động!');
        }
        if (!timeSlot) {
          throw new BookingValidationError('Khung giờ không tồn tại!');
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
      throw new BookingValidationError('staffId không hợp lệ!');
    }
    where.staffId = filters.staffId;
  }
  if (filters.customerId) {
    if (!isUuid(filters.customerId)) {
      throw new BookingValidationError('customerId không hợp lệ!');
    }
    where.customerId = filters.customerId;
  }

  return where;
};

const resolvePagination = (filters: BookingFilters): { page: number; limit: number } => {
  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? Math.floor(filters.page as number) : 1;
  const limit =
    Number.isFinite(filters.limit) && (filters.limit as number) > 0
      ? Math.min(100, Math.floor(filters.limit as number))
      : 20;

  return { page, limit };
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

export const getBookingById = async (bookingId: string): Promise<BookingWithRelations> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });

  if (!booking) {
    throw new BookingNotFoundError();
  }

  return booking;
};

export const updateBookingStatus = async (
  bookingId: string,
  status: BookingStatus,
  actor: { userId: string; role: Role }
): Promise<BookingWithRelations> => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    throw new BookingNotFoundError();
  }

  if (actor.role === Role.CUSTOMER) {
    if (booking.customerId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Bạn không có quyền thay đổi lịch hẹn của người khác!');
    }
    if (status !== BookingStatus.CANCELLED) {
      throw new BookingForbiddenError('Forbidden: Khách hàng chỉ được hủy lịch hẹn!');
    }
  } else if (actor.role === Role.STAFF) {
    if (booking.staffId !== actor.userId) {
      throw new BookingForbiddenError('Forbidden: Bạn không có quyền thay đổi lịch hẹn của nhân viên khác!');
    }
    if (!STAFF_UPDATABLE_STATUSES.includes(status)) {
      throw new BookingValidationError('Trạng thái không hợp lệ!');
    }
  } else if (actor.role === Role.ADMIN) {
    if (!STAFF_UPDATABLE_STATUSES.includes(status)) {
      throw new BookingValidationError('Trạng thái không hợp lệ!');
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
  }

  return updatedBooking;
};

export const isBookingStatus = (value: string): value is BookingStatus =>
  Object.values(BookingStatus).includes(value as BookingStatus);
