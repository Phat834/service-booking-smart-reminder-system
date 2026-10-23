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
  isActive: boolean;
}

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked?: boolean;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

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
