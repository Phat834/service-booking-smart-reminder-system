import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Service, Staff, TimeSlot } from '@/types';

const BookingPage: React.FC = () => {
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axiosClient.get('/services').then((r) => setServices(r.data.services || r.data || []));
    axiosClient.get('/users/staff').then((r) => setStaffList(r.data.staff || []));
  }, []);

  const fetchSlots = useCallback(async () => {
    if (!selectedStaff) return;
    setLoadingSlots(true);
    try {
      const res = await axiosClient.get('/slots/available', { params: { staffId: selectedStaff.id, date: selectedDate } });
      setSlots(res.data.slots || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được khung giờ', type: 'error' });
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedStaff, selectedDate, toast]);

  useEffect(() => {
    fetchSlots();
    setSelectedSlot(null);
  }, [fetchSlots]);

  const handleSubmit = async () => {
    if (!selectedService || !selectedStaff || !selectedSlot) {
      toast({ title: 'Thiếu thông tin', message: 'Vui lòng chọn đủ dịch vụ, nhân viên, ngày và khung giờ', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axiosClient.post('/bookings', {
        serviceId: selectedService.id,
        staffId: selectedStaff.id,
        bookingDate: selectedDate,
        timeSlotId: selectedSlot.id,
        notes,
      });
      toast({ title: 'Thành công', message: 'Đặt lịch thành công', type: 'success' });
      setSelectedSlot(null);
      setNotes('');
      fetchSlots();
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast({ title: 'Xung đột', message: 'Khung giờ đã có người đặt. Danh sách đang làm mới.', type: 'error' });
        fetchSlots();
      } else {
        toast({ title: 'Lỗi', message: err.response?.data?.message || 'Đặt lịch thất bại', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Đặt lịch hẹn</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="font-semibold mb-3">Bước 1: Chọn dịch vụ</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedService(s)}
              className={`text-left p-4 border rounded-lg ${selectedService?.id === s.id ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">{s.durationMinutes} phút · {s.price.toLocaleString()}đ</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="font-semibold mb-3">Bước 2: Chọn nhân viên & ngày</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            className="border rounded-lg px-3 py-2"
            value={selectedStaff?.id || ''}
            onChange={(e) => setSelectedStaff(staffList.find((s) => s.id === e.target.value) || null)}
          >
            <option value="">-- Chọn nhân viên --</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
          <input
            type="date"
            className="border rounded-lg px-3 py-2"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="font-semibold mb-3">Bước 3: Chọn khung giờ</h2>
        {loadingSlots ? (
          <p className="text-gray-500">Đang tải...</p>
        ) : slots.length === 0 ? (
          <p className="text-gray-500">Chưa có khung giờ</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.id}
                disabled={slot.isBooked}
                onClick={() => setSelectedSlot(slot)}
                className={`p-2 rounded-lg text-sm border ${
                  slot.isBooked
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : selectedSlot?.id === slot.id
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-gray-200 hover:border-brand-400'
                }`}
              >
                {slot.startTime} - {slot.endTime}
                {slot.isBooked && <span className="block text-xs">Đã kín</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="font-semibold mb-3">Bước 4: Ghi chú & xác nhận</h2>
        <textarea
          className="w-full border rounded-lg px-3 py-2 mb-4"
          rows={3}
          placeholder="Ghi chú (tuỳ chọn)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Đang đặt...' : 'Xác nhận đặt lịch'}
        </button>
      </div>
    </div>
  );
};

export default BookingPage;