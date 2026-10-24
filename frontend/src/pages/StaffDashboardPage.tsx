import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Booking, BookingStatus } from '@/types';
import { Calendar, RefreshCw } from 'lucide-react';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Đang chờ', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-700', bg: 'bg-blue-50' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-green-700', bg: 'bg-green-50' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50' },
  NO_SHOW: { label: 'Không đến', color: 'text-orange-700', bg: 'bg-orange-50' },
};

const STATUS_FILTERS: { label: string; value: BookingStatus | 'ALL' }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Đang chờ', value: 'PENDING' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Đang thực hiện', value: 'IN_PROGRESS' },
  { label: 'Hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
  { label: 'Không đến', value: 'NO_SHOW' },
];

const DATE_FILTERS: { label: string; value: string }[] = [
  { label: 'Hôm nay', value: 'TODAY' },
  { label: 'Sắp tới', value: 'UPCOMING' },
  { label: 'Tất cả', value: 'ALL' },
];

const isToday = (dateString: string) => {
  const d = new Date(dateString);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

const isUpcoming = (dateString: string) => {
  const d = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today;
};

const StaffDashboardPage: React.FC = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/bookings/my-bookings');
      setBookings(res.data.bookings || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được lịch hẹn', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    if (!confirm(`Bạn chắc chắn muốn chuyển trạng thái này thành ${STATUS_CONFIG[status].label}?`)) return;
    try {
      await axiosClient.patch(`/bookings/${id}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      toast({ title: 'Thành công', message: 'Cập nhật trạng thái thành công', type: 'success' });
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Thất bại', type: 'error' });
    }
  };

  const filtered = bookings.filter((b) => {
    const dateMatch =
      dateFilter === 'ALL'
        ? true
        : dateFilter === 'TODAY'
          ? isToday(b.bookingDate.toString())
          : isUpcoming(b.bookingDate.toString());
    const statusMatch = statusFilter === 'ALL' || b.status === statusFilter;
    return dateMatch && statusMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý lịch hẹn</h1>
          <p className="text-gray-500 text-sm">Theo dõi và cập nhật trạng thái các lịch hẹn của khách hàng.</p>
        </div>
        <button
          onClick={fetchBookings}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 border border-brand-100 rounded-lg hover:bg-brand-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Tải lại
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap gap-3 mb-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lọc theo ngày</span>
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${dateFilter === f.value ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lọc theo trạng thái</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${statusFilter === f.value ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-gray-500">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Không có lịch hẹn phù hợp</h3>
          <p className="text-gray-500 mt-1">Hãy thử thay đổi bộ lọc ngày hoặc trạng thái.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Khách hàng</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Dịch vụ</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Ngày & Giờ</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Ghi chú</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Trạng thái</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b) => {
                const st = STATUS_CONFIG[b.status];
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">{b.customer.fullName || b.customer.email}</td>
                    <td className="px-4 py-3 text-sm">{b.service.name}</td>
                    <td className="px-4 py-3 text-sm">{new Date(b.bookingDate).toLocaleDateString('vi-VN')} {b.timeSlot.startTime}-{b.timeSlot.endTime}</td>
                    <td className="px-4 py-3 text-sm">{b.notes || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${st.color} ${st.bg}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {b.status === 'PENDING' && (
                        <>
                          <button onClick={() => updateStatus(b.id, 'CONFIRMED')} className="text-blue-600 text-sm hover:underline font-medium">Xác nhận</button>
                          <button onClick={() => updateStatus(b.id, 'CANCELLED')} className="text-red-600 text-sm hover:underline font-medium">Hủy</button>
                        </>
                      )}
                      {b.status === 'CONFIRMED' && (
                        <>
                          <button onClick={() => updateStatus(b.id, 'IN_PROGRESS')} className="text-indigo-600 text-sm hover:underline font-medium">Check-in / Bắt đầu</button>
                          <button onClick={() => updateStatus(b.id, 'NO_SHOW')} className="text-orange-600 text-sm hover:underline font-medium">Không đến</button>
                        </>
                      )}
                      {b.status === 'IN_PROGRESS' && (
                        <button onClick={() => updateStatus(b.id, 'COMPLETED')} className="text-green-600 text-sm hover:underline font-medium">Hoàn thành</button>
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

export default StaffDashboardPage;
