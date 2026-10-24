import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import axiosClient from '@/api/axiosClient';
import type { Booking, BookingStatus, Service, Staff, AdminStats } from '@/types';
import { Calendar, User, Building2, RefreshCw, ToggleRight, ToggleLeft } from 'lucide-react';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Đang chờ', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-700', bg: 'bg-blue-50' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-green-700', bg: 'bg-green-50' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50' },
  NO_SHOW: { label: 'Không đến', color: 'text-orange-700', bg: 'bg-orange-50' },
};

const TABS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'analytics', label: 'Phân tích & Lịch hẹn', icon: Calendar },
  { key: 'services', label: 'Quản lý dịch vụ', icon: Building2 },
  { key: 'staff', label: 'Nhân viên & Khung giờ', icon: User },
];

const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatPercent = (value: number) => {
  return `${Number(value || 0).toFixed(1)}%`;
};

const AdminDashboardPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'analytics' | 'services' | 'staff'>('analytics');

  // Analytics state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');

  // Service state
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', durationMinutes: '', price: '', bufferMinutes: '' });
  const [submittingService, setSubmittingService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; durationMinutes: string; price: string; bufferMinutes: string; isActive: boolean }>({
    name: '',
    description: '',
    durationMinutes: '',
    price: '',
    bufferMinutes: '',
    isActive: true,
  });

  // Staff state
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffEditForm, setStaffEditForm] = useState({ fullName: '', phone: '' });

  // TimeSlot state
  const [slotForm, setSlotForm] = useState({ startTime: '', endTime: '' });
  const [submittingSlot, setSubmittingSlot] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosClient.get('/admin/stats');
      setStats(res.data);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được thống kê', type: 'error' });
    }
  }, [toast]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/bookings');
      setBookings(res.data.bookings || res.data || []);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách lịch hẹn', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
    fetchBookings();
  }, [fetchStats, fetchBookings]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    try {
      await axiosClient.patch(`/bookings/${id}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      toast({ title: 'Thành công', message: 'Cập nhật trạng thái thành công', type: 'success' });
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Thất bại', type: 'error' });
    }
  };

  // --- Services ---
  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const res = await axiosClient.get('/services?all=true');
      const data = Array.isArray(res.data) ? res.data : res.data.services || res.data || [];
      setServices(data);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách dịch vụ', type: 'error' });
    } finally {
      setServicesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'services') fetchServices();
  }, [activeTab, fetchServices]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingService(true);
    try {
      const res = await axiosClient.post('/services', {
        name: serviceForm.name,
        description: serviceForm.description,
        durationMinutes: Number(serviceForm.durationMinutes),
        price: Number(serviceForm.price),
        bufferMinutes: serviceForm.bufferMinutes ? Number(serviceForm.bufferMinutes) : undefined,
      });
      const createdService = res.data.service;
      toast({ title: 'Thành công', message: 'Tạo dịch vụ mới thành công', type: 'success' });
      setServiceForm({ name: '', description: '', durationMinutes: '', price: '', bufferMinutes: '' });
      setServices((prev) => [...prev, createdService]);
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Tạo dịch vụ thất bại', type: 'error' });
    } finally {
      setSubmittingService(false);
    }
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setEditForm({
      name: service.name,
      description: service.description || '',
      durationMinutes: String(service.durationMinutes),
      price: String(service.price),
      bufferMinutes: String(service.bufferMinutes ?? ''),
      isActive: service.isActive,
    });
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setSubmittingService(true);
    try {
      const res = await axiosClient.put(`/services/${editingService.id}`, {
        name: editForm.name,
        description: editForm.description,
        durationMinutes: Number(editForm.durationMinutes),
        price: Number(editForm.price),
        bufferMinutes: editForm.bufferMinutes ? Number(editForm.bufferMinutes) : undefined,
        isActive: editForm.isActive,
      });
      const updatedService = res.data.service;
      toast({ title: 'Thành công', message: 'Cập nhật dịch vụ thành công', type: 'success' });
      setEditingService(null);
      setServices((prev) =>
        prev.map((s) => (s.id === updatedService.id ? { ...s, ...updatedService } : s))
      );
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Cập nhật dịch vụ thất bại', type: 'error' });
    } finally {
      setSubmittingService(false);
    }
  };

  const handleToggleService = async (service: Service) => {
    const previousIsActive = service.isActive;
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, isActive: !previousIsActive } : s))
    );
    try {
      await axiosClient.patch(`/services/${service.id}/toggle`);
      toast({ title: 'Thành công', message: `Dịch vụ đã ${previousIsActive ? 'đã khóa' : 'đã kích hoạt'}`, type: 'success' });
    } catch (err: any) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, isActive: previousIsActive } : s))
      );
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Thao tác thất bại', type: 'error' });
    }
  };

  // --- Staff ---
  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await axiosClient.get('/admin/staff');
      const data = Array.isArray(res.data) ? res.data : res.data.staff || res.data.users || [];
      setStaffList(data);
    } catch {
      toast({ title: 'Lỗi', message: 'Không tải được danh sách nhân viên', type: 'error' });
    } finally {
      setStaffLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'staff') fetchStaff();
  }, [activeTab, fetchStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingStaff(true);
    try {
      const res = await axiosClient.post('/admin/staff', {
        fullName: staffForm.fullName,
        email: staffForm.email,
        phone: staffForm.phone,
        password: staffForm.password,
      });
      const createdStaff = res.data.staff;
      toast({ title: 'Thành công', message: 'Tạo tài khoản nhân viên thành công', type: 'success' });
      setStaffForm({ fullName: '', email: '', phone: '', password: '' });
      setStaffList((prev) => [...prev, createdStaff]);
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Tạo nhân viên thất bại', type: 'error' });
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (staff: Staff) => {
    const previousIsActive = staff.isActive;
    setStaffList((prev) =>
      prev.map((s) => (s.id === staff.id ? { ...s, isActive: !previousIsActive } : s))
    );
    try {
      await axiosClient.patch(`/admin/staff/${staff.id}/toggle`);
      toast({ title: 'Thành công', message: `Nhân viên đã ${previousIsActive ? 'đã khóa' : 'đã kích hoạt'}`, type: 'success' });
    } catch (err: any) {
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, isActive: previousIsActive } : s))
      );
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Thao tác thất bại', type: 'error' });
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setSubmittingStaff(true);
    try {
      const res = await axiosClient.put(`/admin/staff/${editingStaff.id}`, {
        fullName: staffEditForm.fullName,
        phone: staffEditForm.phone,
      });
      const updatedStaff = res.data.staff;
      toast({ title: 'Thành công', message: 'Cập nhật nhân viên thành công', type: 'success' });
      setEditingStaff(null);
      setStaffList((prev) =>
        prev.map((s) => (s.id === updatedStaff.id ? { ...s, ...updatedStaff } : s))
      );
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Cập nhật nhân viên thất bại', type: 'error' });
    } finally {
      setSubmittingStaff(false);
    }
  };

  // --- TimeSlot ---
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSlot(true);
    try {
      await axiosClient.post('/slots', {
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
      });
      toast({ title: 'Thành công', message: 'Thêm khung giờ thành công', type: 'success' });
      setSlotForm({ startTime: '', endTime: '' });
    } catch (err: any) {
      toast({ title: 'Lỗi', message: err.response?.data?.message || 'Thêm khung giờ thất bại', type: 'error' });
    } finally {
      setSubmittingSlot(false);
    }
  };

  const filteredBookings = bookings.filter(
    (b) => bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter
  );

  const actualRevenue = stats?.actualRevenue ?? stats?.totalRevenue ?? 0;
  const expectedRevenue = stats?.expectedRevenue ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển quản trị</h1>
          <p className="text-gray-500 text-sm">Quản lý hệ thống đặt lịch hẹn dịch vụ.</p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchBookings();
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 border border-brand-100 rounded-lg hover:bg-brand-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Tải lại
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`-mb-1 px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
              activeTab === t.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Analytics & All Bookings */}
      {activeTab === 'analytics' && (
        <>
          {!stats ? (
            <p className="text-gray-500">Đang tải thống kê...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white p-6 rounded-xl border">
                <p className="text-gray-500 text-sm">Doanh thu thực tế</p>
                <p className="text-2xl font-bold">{formatVND(actualRevenue)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border">
                <p className="text-gray-500 text-sm">Doanh thu dự kiến</p>
                <p className="text-2xl font-bold">{formatVND(expectedRevenue)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border">
                <p className="text-gray-500 text-sm">Tỷ lệ beschäft</p>
                <p className="text-2xl font-bold">{formatPercent(stats.occupancyRate)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border">
                <p className="text-gray-500 text-sm">Tỷ lệ hủy</p>
                <p className="text-2xl font-bold">{formatPercent(stats.cancellationRate)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border">
                <p className="text-gray-500 text-sm">Tỷ lệ không đến</p>
                <p className="text-2xl font-bold">{formatPercent(stats.noShowRate)}</p>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Tất cả lịch hẹn hệ thống</h2>
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value as BookingStatus | 'ALL')}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key as BookingStatus}>{cfg.label}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <p className="p-4 text-gray-500">Đang tải...</p>
            ) : filteredBookings.length === 0 ? (
              <p className="p-4 text-gray-500 text-center">Không có lịch hẹn nào.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Khách hàng</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Nhân viên</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Dịch vụ</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Ngày & Giờ</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Trạng thái</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBookings.map((b) => {
                    const st = STATUS_CONFIG[b.status];
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{b.customer.fullName || b.customer.email}</td>
                        <td className="px-4 py-3 text-sm">{b.staff.fullName || b.staff.email}</td>
                        <td className="px-4 py-3 text-sm">{b.service.name}</td>
                        <td className="px-4 py-3 text-sm">{new Date(b.bookingDate).toLocaleDateString('vi-VN')} {b.timeSlot.startTime}-{b.timeSlot.endTime}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${st.color} ${st.bg}`}>{st.label}</span></td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={b.status}
                            onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key as BookingStatus}>{cfg.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Service Management */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Danh sách dịch vụ</h2>
            {servicesLoading ? (
              <p className="p-4 text-gray-500">Đang tải...</p>
            ) : services.length === 0 ? (
              <p className="p-4 text-gray-500 text-center">Chưa có dịch vụ nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Tên dịch vụ</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Mô tả</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Thời lượng</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Giá</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Buffer (phút)</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Trạng thái</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {services.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{s.name}</td>
                        <td className="px-4 py-3 text-sm">{s.description || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.durationMinutes} phút</td>
                        <td className="px-4 py-3 text-sm">{formatVND(s.price)}</td>
                        <td className="px-4 py-3 text-sm">{s.bufferMinutes ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-1 block transition-colors ${
                            s.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {s.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                          <button
                            onClick={() => handleToggleService(s)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                              s.isActive
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {s.isActive ? (
                              <>
                                <ToggleLeft className="w-3 h-3 mr-1" /> Khóa
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-3 h-3 mr-1" /> Kích hoạt
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => openEditService(s)}
                            className="text-brand-600 text-sm hover:underline font-medium"
                          >
                            Sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Tạo dịch vụ mới</h2>
            <form onSubmit={handleCreateService} className="space-y-3 max-w-md">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Tên dịch vụ"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                required
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Mô tả"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Thời lượng (phút)"
                  value={serviceForm.durationMinutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: e.target.value })}
                  required
                />
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Giá"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  required
                />
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Buffer (phút)"
                  value={serviceForm.bufferMinutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, bufferMinutes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={submittingService}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-brand-700"
              >
                {submittingService ? 'Đang tạo...' : 'Tạo dịch vụ'}
              </button>
            </form>
          </div>

          {editingService && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingService(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditingService(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                  <span className="sr-only">Đóng</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Sửa dịch vụ</h2>
                <form onSubmit={handleUpdateService} className="space-y-3">
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Tên dịch vụ"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Mô tả"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <input
                      type="number"
                      className="border rounded-lg px-3 py-2 text-sm"
                      placeholder="Thời lượng (phút)"
                      value={editForm.durationMinutes}
                      onChange={(e) => setEditForm({ ...editForm, durationMinutes: e.target.value })}
                      required
                    />
                    <input
                      type="number"
                      className="border rounded-lg px-3 py-2 text-sm"
                      placeholder="Giá"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      required
                    />
                    <input
                      type="number"
                      className="border rounded-lg px-3 py-2 text-sm"
                      placeholder="Buffer (phút)"
                      value={editForm.bufferMinutes}
                      onChange={(e) => setEditForm({ ...editForm, bufferMinutes: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded text-brand-600 focus:ring-brand-500"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      />
                      Kích hoạt
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      disabled={submittingService}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingService}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingService ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Staff & TimeSlots Management */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Nhân viên hệ thống</h2>
            {staffLoading ? (
              <p className="p-4 text-gray-500">Đang tải...</p>
            ) : staffList.length === 0 ? (
              <p className="p-4 text-gray-500 text-center">Chưa có nhân viên nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Họ tên</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Email</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Số điện thoại</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Số lịch hẹn</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Đánh giá TB</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700">Trạng thái</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{s.fullName}</td>
                        <td className="px-4 py-3 text-sm">{s.email}</td>
                        <td className="px-4 py-3 text-sm">{s.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.bookingCount ?? 0}</td>
                        <td className="px-4 py-3 text-sm">
                          {s.averageRating != null ? s.averageRating.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {s.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleToggleStaffStatus(s)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                              s.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {s.isActive ? (
                              <>
                                <ToggleLeft className="w-3 h-3 mr-1" /> Khóa
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-3 h-3 mr-1" /> Kích hoạt
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setStaffEditForm({ fullName: s.fullName, phone: s.phone || '' });
                              setEditingStaff(s);
                            }}
                            className="text-brand-600 text-sm hover:underline font-medium"
                          >
                            Sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Tạo tài khoản nhân viên mới</h2>
            <form onSubmit={handleCreateStaff} className="space-y-3 max-w-md">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Họ tên"
                value={staffForm.fullName}
                onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                required
              />
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                required
              />
              <input
                type="tel"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Số điện thoại"
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
              />
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Mật khẩu"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                required
              />
              <button
                type="submit"
                disabled={submittingStaff}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-brand-700"
              >
                {submittingStaff ? 'Đang tạo...' : 'Tạo nhân viên'}
              </button>
            </form>
          </div>

          {editingStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingStaff(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditingStaff(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                  <span className="sr-only">Đóng</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Sửa nhân viên</h2>
                <form onSubmit={handleUpdateStaff} className="space-y-3">
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Họ tên"
                    value={staffEditForm.fullName}
                    onChange={(e) => setStaffEditForm({ ...staffEditForm, fullName: e.target.value })}
                    required
                  />
                  <input
                    type="tel"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Số điện thoại"
                    value={staffEditForm.phone}
                    onChange={(e) => setStaffEditForm({ ...staffEditForm, phone: e.target.value })}
                  />
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingStaff(null)}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      disabled={submittingStaff}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingStaff}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingStaff ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Thêm khung giờ làm việc</h2>
            <form onSubmit={handleCreateSlot} className="space-y-3 max-w-md">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Giờ bắt đầu"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                  required
                />
                <input
                  type="time"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Giờ kết thúc"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submittingSlot}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-brand-700"
              >
                {submittingSlot ? 'Đang thêm...' : 'Thêm khung giờ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
