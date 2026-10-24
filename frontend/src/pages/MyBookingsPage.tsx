import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Booking, BookingStatus, TimeSlot } from '@/types';
import { Calendar, Clock, User, Building2, RefreshCw, Star } from 'lucide-react';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Đang chờ', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-700', bg: 'bg-blue-50' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-green-700', bg: 'bg-green-50' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50' },
  NO_SHOW: { label: 'Không đến', color: 'text-orange-700', bg: 'bg-orange-50' },
};

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

const StarRatingBadge = ({ rating }: { rating: number | null }) => {
  if (!rating) return <span className="text-xs text-gray-400">Chưa đánh giá</span>;
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  return (
    <span className="flex items-center gap-1 text-xs">
      {[...Array(5)].map((_, i) => {
        const starValue = i + 1;
        if (starValue <= fullStars) {
          return <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />;
        }
        if (hasHalf && starValue === fullStars + 1) {
          return <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />;
        }
        return <Star key={i} className="w-3 h-3 text-gray-300" />;
      })}
      <span className="ml-1 text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
};

const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // Reschedule modal state
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlot | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string>('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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

  const openReschedule = (booking: Booking) => {
    setRescheduleId(booking.id);
    setRescheduleDate(new Date(booking.bookingDate).toISOString().split('T')[0]);
    setRescheduleSelectedSlot(null);
    setRescheduleSlots([]);
    setRescheduleOpen(true);
  };

  const fetchRescheduleSlots = useCallback(async () => {
    if (!rescheduleDate) return;
    const booking = bookings.find((b) => b.id === rescheduleId);
    if (!booking) return;
    setRescheduleLoading(true);
    try {
      const res = await axiosClient.get('/slots/available', {
        params: { staffId: booking.staff.id, date: rescheduleDate },
      });
      setRescheduleSlots(res.data.slots || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được khung giờ', type: 'error' });
    } finally {
      setRescheduleLoading(false);
    }
  }, [rescheduleId, rescheduleDate, bookings, toast]);

  useEffect(() => {
    if (rescheduleOpen && rescheduleDate) {
      setRescheduleSelectedSlot(null);
      fetchRescheduleSlots();
    }
  }, [rescheduleOpen, rescheduleDate, fetchRescheduleSlots]);

  const handleReschedule = async () => {
    if (!rescheduleSelectedSlot) return;
    setRescheduleLoading(true);
    try {
      const res = await axiosClient.patch(`/bookings/${rescheduleId}/reschedule`, {
        bookingDate: rescheduleDate,
        timeSlotId: rescheduleSelectedSlot.id,
      });
      const updatedBooking = res.data.booking;
      toast({
        title: 'Đã đổi lịch',
        message: 'Lịch hẹn của bạn đã được đổi lịch thành công.',
        type: 'success',
        duration: 4000,
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === rescheduleId
            ? { ...b, bookingDate: updatedBooking.bookingDate, timeSlot: updatedBooking.timeSlot }
            : b
        )
      );
      setRescheduleOpen(false);
    } catch (err: any) {
      toast({
        title: 'Đổi lịch thất bại',
        message: err.response?.data?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setRescheduleLoading(false);
    }
  };

  const openReview = (booking: Booking) => {
    setReviewId(booking.id);
    setReviewRating(booking.rating || 0);
    setReviewComment(booking.reviewComment || '');
    setReviewOpen(true);
  };

  const handleReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) return;
    setReviewSubmitting(true);
    try {
      await axiosClient.post(`/bookings/${reviewId}/review`, {
        rating: reviewRating,
        reviewComment: reviewComment || null,
      });
      toast({
        title: 'Cảm ơn bạn',
        message: 'Bạn đã đánh giá lịch hẹn này thành công.',
        type: 'success',
        duration: 4000,
      });
      setBookings((prev) =>
        prev.map((b) => (b.id === reviewId ? { ...b, rating: reviewRating, reviewComment: reviewComment || null } : b))
      );
      setReviewOpen(false);
    } catch (err: any) {
      toast({
        title: 'Đánh giá thất bại',
        message: err.response?.data?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setReviewSubmitting(false);
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
                const isPendingOrConfirmed = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
                const isCompleted = booking.status === 'COMPLETED';
                const alreadyReviewed = Boolean(booking.rating);
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
                      {isCompleted && alreadyReviewed && (
                        <div className="mt-1 flex items-center gap-1">
                          <StarRatingBadge rating={booking.rating ?? 0} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isPendingOrConfirmed ? (
                        <>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            className="text-sm text-red-600 font-medium hover:text-red-700 hover:underline transition-colors mr-3"
                          >
                            Hủy lịch
                          </button>
                          <button
                            onClick={() => openReschedule(booking)}
                            className="text-sm text-brand-600 font-medium hover:text-brand-700 hover:underline transition-colors"
                          >
                            Đổi lịch
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {isCompleted && !alreadyReviewed && (
                        <button
                          onClick={() => openReview(booking)}
                          className="text-sm text-green-600 font-medium hover:text-green-700 hover:underline transition-colors mt-1 block text-right"
                        >
                          Đánh giá
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRescheduleOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setRescheduleOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <span className="sr-only">Đóng</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Đổi lịch hẹn</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày mới</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khung giờ</label>
                {rescheduleLoading ? (
                  <p className="text-gray-500">Đang tải...</p>
                ) : rescheduleSlots.length === 0 ? (
                  <p className="text-gray-500">Không có khung giờ trống vào ngày này.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {rescheduleSlots.map((slot) => (
                      <button
                        key={slot.id}
                        disabled={slot.isBooked}
                        onClick={() => setRescheduleSelectedSlot(slot)}
                        className={`p-2 rounded-lg text-sm border transition-all ${slot.isBooked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : rescheduleSelectedSlot?.id === slot.id ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 hover:border-brand-400'}`}
                      >
                        {slot.startTime} - {slot.endTime}
                        {slot.isBooked && <span className="block text-xs">Đã kín</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setRescheduleOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={rescheduleLoading}
                >
                  Hủy
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleSelectedSlot || rescheduleLoading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {rescheduleLoading ? 'Đang đổi...' : 'Xác nhận đổi lịch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setReviewOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setReviewOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <span className="sr-only">Đóng</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Đánh giá lịch hẹn</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Số sao</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-all ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                    >
                      <Star className="w-5 h-5" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Bạn đánh giá {reviewRating} sao</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bình luận</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Chia sẻ cảm nhận của bạn về dịch vụ..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setReviewOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={reviewSubmitting}
                >
                  Hủy
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewRating < 1 || reviewSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
