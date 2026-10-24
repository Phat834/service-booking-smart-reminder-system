export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role: Role;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  bufferMinutes?: number;
  isActive: boolean;
}

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  bookingCount?: number;
  averageRating?: number | null;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked?: boolean;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Booking {
  id: string;
  bookingDate: Date;
  status: BookingStatus;
  notes?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  customer: User;
  staff: User;
  service: Service;
  timeSlot: TimeSlot;
  rating?: number | null;
  reviewComment?: string | null;
  isReminder2hSent?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  userId: string;
}

export interface BookingListResult {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminStats {
  actualRevenue: number;
  expectedRevenue: number;
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  occupancyRate: number;
  cancellationRate: number;
  noShowRate: number;
  bookingsByStatus: Record<BookingStatus, number>;
  staffPerformance: StaffPerformance[];
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  staffEmail: string;
  totalBookings: number;
  completedBookings: number;
  revenue: number;
  averageRating?: number | null;
}
