import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Booking, BookingStatus } from '@/types';
import { Calendar, Clock, User, Building2, RefreshCw } from 'lucide-react';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Đang chờ', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-700', bg: 'bg-blue-50' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-green-700', bg: 'bg-green-50' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50' },
};

const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axiosClient.get('/bookings/my-bookings');
      setBookings(res.data.bookings || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách lịch hẹn', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancel = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn hủy lịch hẹn này?')) return;
    try {
      await axiosClient.patch(`/bookings/${id}/status`, { status: 'CANCELLED' });
      toast({
        title: 'Đã hủy lịch hẹn',
        message: 'Lịch hẹn của bạn đã được hủy thành công.',
        type: 'success',
        duration: 4000,
      });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)));
    } catch (err: any) {
      toast({
        title: 'Hủy lịch thất bại',
        message: err.response?.data?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch hẹn của tôi</h1>
          <p className="text-gray-500 text-sm">Quản lý và theo dõi các lịch hẹn đặt dịch vụ của bạn.</p>
        </div>
        <button
          onClick={fetchBookings}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 border border-brand-100 rounded-lg hover:bg-brand-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Tải lại
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="flex flex-col items-center gap-2 animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent rounded-full"></div>
            <span className="text-sm text-gray-500">Đang tải...</span>
          </div>
        </div>
      )}

 {!loading && bookings.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Chưa có lịch hẹn nào</h3>
          <p className="text-gray-500 mt-1">Bạn hãy đặt một lịch hẹn mới để bắt đầu.</p>
        </div>
      )}

 {!loading && bookings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-semibold text-gray-700">Dịch vụ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700">Nhân viên</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700">Ngày & giờ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700">Trạng thái</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((booking) => {
                const status = STATUS_CONFIG[booking.status];
                const isPending = booking.status === 'PENDING';
                return (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{booking.service.name}</p>
                          <p className="text-xs text-gray-500">{booking.service.durationMinutes} phút</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <p className="text-sm font-medium text-gray-900">{booking.staff.fullName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatDate(booking.bookingDate.toString())}</p>
                          <Clock className="w-3 h-3 text-gray-400 inline-block mr-1" />
                          <span className="text-sm text-gray-600">{formatTime(booking.timeSlot.startTime)} - {formatTime(booking.timeSlot.endTime)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isPending ? (
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="text-sm text-red-600 font-medium hover:text-red-700 hover:underline transition-colors"
                        >
                          Hủy lịch
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
