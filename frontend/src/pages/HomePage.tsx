import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Service, Staff, TimeSlot } from '@/types';
import { Clock, User, Building2, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

type Step = 'service' | 'staff' | 'slot' | 'confirm';

const STEP_LABELS: Record<Step, string> = {
  service: 'Chọn dịch vụ',
  staff: 'Chọn nhân viên',
  slot: 'Chọn khung giờ',
  confirm: 'Xác nhận',
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const fetchServices = useCallback(async () => {
    try {
      const res = await axiosClient.get('/services');
      setServices(res.data.services || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách dịch vụ', type: 'error' });
    }
  }, [toast]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await axiosClient.get('/staff');
      const data = Array.isArray(res.data) ? res.data : res.data.staff || res.data.users || [];
      setStaffList(data);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách nhân viên', type: 'error' });
    }
  }, [toast]);

  useEffect(() => {
    fetchServices();
    fetchStaff();
  }, [fetchServices, fetchStaff]);

  useEffect(() => {
    if (!selectedStaff || !selectedDate) return;
    setSlotLoading(true);
    axiosClient
      .get('/slots/available', {
        params: { staffId: selectedStaff.id, date: selectedDate },
      })
      .then((res) => setSlots(res.data.slots || []))
      .catch(() => toast({ title: 'Lỗi', message: 'Không tải được khung giờ', type: 'error' }))
      .finally(() => setSlotLoading(false));
  }, [selectedStaff, selectedDate, toast]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedStaff || !selectedSlot || !selectedDate || !user) return;

    setLoading(true);
    try {
      await axiosClient.post('/bookings', {
        staffId: selectedStaff.id,
        serviceId: selectedService.id,
        timeSlotId: selectedSlot.id,
        bookingDate: selectedDate,
        notes: notes || null,
      });
      toast({
        title: 'Đặt lịch thành công!',
        message: `Bạn đã đặt lịch ${selectedService.name} vào ${selectedDate} lúc ${selectedSlot.startTime}-${selectedSlot.endTime}.`,
        type: 'success',
        duration: 5000,
      });
      setStep('service');
      setSelectedService(null);
      setSelectedStaff(null);
      setSelectedDate('');
      setSelectedSlot(null);
      setNotes('');
      setSlots([]);
      navigate('/my-bookings');
    } catch (err: any) {
      toast({
        title: 'Đặt lịch thất bại',
        message: err.response?.data?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const stepOrder: Step[] = ['service', 'staff', 'slot', 'confirm'];
  const currentStepIndex = stepOrder.indexOf(step);

  const NavBar = ({ onBack, onNext, nextDisabled, nextLabel }: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel: string }) => (
    <div className="pt-6 flex items-center justify-between border-t border-gray-100">
      {onBack && (
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={`px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 ${
          nextDisabled ? 'bg-gray-300' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {nextLabel} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đặt lịch dịch vụ</h1>
          <p className="text-gray-500 text-sm">Chọn dịch vụ, nhân viên và khung giờ phù hợp với bạn.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          {stepOrder.map((s, i) => {
            const isActive = s === step;
            const isCompleted = i < currentStepIndex;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ArrowLeft className="w-3 h-3 text-gray-300" />}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : isCompleted
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-brand-600' : 'text-gray-600'}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Service */}
        {step === 'service' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Chọn dịch vụ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-gray-500">Không có dịch vụ nào.</div>
              ) : (
                services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setStep('staff');
                    }}
                    className={`flex flex-col gap-3 p-5 rounded-xl border transition-all hover:shadow-md ${
                      selectedService?.id === svc.id
                        ? 'bg-brand-50 border-brand-600 text-brand-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mb-1" />
                    <h3 className="font-semibold">{svc.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{svc.description || 'Không có mô tả'}</p>
                    <div className="mt-auto flex items-baseline gap-1">
                      <span className="text-lg font-bold">{formatVND(svc.price)}</span>
                      <span className="text-xs text-gray-400">/lần</span>
                    </div>
                    <div className="text-xs text-brand-600 font-medium">
                      {svc.durationMinutes} phút
                    </div>
                  </button>
                ))
              )}
            </div>
            <NavBar
              onNext={() => {
                if (!selectedService) return;
                setStep('staff');
              }}
              nextDisabled={!selectedService}
              nextLabel="Tiếp tục"
            />
          </div>
        )}

        {/* Step 2: Staff */}
        {step === 'staff' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Chọn nhân viên</h2>
              <button
                onClick={() => setStep('service')}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Quay lại
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-gray-500">Không có nhân viên nào.</div>
              ) : (
                staffList.map((stf) => (
                  <button
                    key={stf.id}
                    onClick={() => {
                      setSelectedStaff(stf);
                      setStep('slot');
                    }}
                    className={`flex flex-col gap-3 p-5 rounded-xl border transition-all hover:shadow-md ${
                      selectedStaff?.id === stf.id
                        ? 'bg-brand-50 border-brand-600 text-brand-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <User className="w-5 h-5 mb-1" />
                    <h3 className="font-semibold">{stf.fullName}</h3>
                    <p className="text-xs text-gray-500">{stf.email}</p>
                  </button>
                ))
              )}
            </div>
            <NavBar
              onBack={() => setStep('service')}
              onNext={() => {
                if (!selectedStaff) return;
                setStep('slot');
              }}
              nextDisabled={!selectedStaff}
              nextLabel="Tiếp tục"
            />
          </div>
        )}

        {/* Step 3: Slot */}
        {step === 'slot' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Chọn khung giờ</h2>
              <button
                onClick={() => setStep('staff')}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Quay lại
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hẹn</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                    setSlots([]);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {selectedDate && !slotLoading && slots.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-3">Khung giờ sẵn có</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      disabled={slot.isBooked}
                      className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                        selectedSlot?.id === slot.id
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : slot.isBooked
                          ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-brand-500 hover:bg-brand-50'
                      }`}
                    >
                      <Clock className="w-3 h-3 mr-1.5" />
                      {slot.startTime} - {slot.endTime}
                      {slot.isBooked && <span className="ml-auto text-xs text-gray-300">Đã đặt</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!selectedDate && (
              <div className="py-10 text-center text-gray-500">Vui lòng chọn ngày.</div>
            )}

            {selectedDate && !slotLoading && slots.length === 0 && (
              <div className="py-10 text-center text-gray-500">Không có khung giờ trống vào ngày này.</div>
            )}

            <NavBar
              onBack={() => setStep('staff')}
              onNext={() => {
                if (!selectedSlot || !selectedDate) return;
                setStep('confirm');
              }}
              nextDisabled={!selectedSlot || !selectedDate}
              nextLabel="Tiếp tục"
            />
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold">Dịch vụ</p>
                <p className="text-gray-900">{selectedService?.name}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold">Nhân viên</p>
                <p className="text-gray-900">{selectedStaff?.fullName}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold">Ngày</p>
                <p className="text-gray-900">{selectedDate}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold">Khung giờ</p>
                <p className="text-gray-900">{selectedSlot?.startTime} - {selectedSlot?.endTime}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold">Tổng tiền</p>
                <p className="text-gray-900 font-bold">{formatVND(selectedService?.price || 0)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Yêu cầu thêm của bạn..."
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                onClick={() => setStep('slot')}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={loading}
                className="px-6 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang đặt...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Xác nhận đặt lịch
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
