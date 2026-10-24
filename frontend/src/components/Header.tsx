import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import type { Notification } from '@/types';
import { Bell, LogOut, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const token = localStorage.getItem('token');

  const fetchNotifications = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return;
      if (res.ok) {
        const data = await res.json();
        const notifs: Notification[] = data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
      }
    } catch {
      // silent
    }
  }, [token, user]);

  const connectSSE = useCallback(() => {
    if (!isAuthenticated || !user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
    es.onopen = () => {
      // connected
    };
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'notification') {
          const notif: Notification = payload.data;
          setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
          setUnreadCount((c) => c + 1);
          toast({
            title: notif.title,
            message: notif.message,
            type: 'info',
            duration: 4000,
          });
        }
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
    };
    setEventSource(es);
    return () => es.close();
  }, [isAuthenticated, user, API_URL, toast]);

  useEffect(() => {
    const cleanup = connectSSE();
    return cleanup;
  }, [connectSSE]);

  useEffect(() => {
    if (!token || !user) return;
    fetchNotifications();
  }, [token, user]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    for (const n of notifications) {
      if (!n.isRead) await markAsRead(n.id);
    }
  };

  const handleLogout = () => {
    logout();
    if (eventSource) eventSource.close();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (!isAuthenticated) return null;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
              <User className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight hover:underline">ServiceBooking</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium">
              <User className="w-4 h-4" />
              <span>{user?.fullName || user?.email}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-xs text-brand-600 bg-brand-50 border border-brand-100 capitalize">
              {user?.role}
            </span>
            <nav className="flex items-center gap-3 border-l border-gray-300 pl-4">
              {user?.role === 'CUSTOMER' && (
                <>
                  <Link to="/" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50">Đặt lịch</Link>
                  <Link to="/my-bookings" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50">Lịch hẹn của tôi</Link>
                </>
              )}
              {user?.role === 'STAFF' && (
                <Link to="/staff" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50">Quản lý lịch hẹn</Link>
              )}
              {user?.role === 'ADMIN' && (
                <>
                  <Link to="/admin" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50">Báo cáo thống kê</Link>
                  <Link to="/staff" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50">Quản lý lịch hẹn</Link>
                </>
              )}
            </nav>
          </div>

          <div className="relative group">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Thông báo</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-brand-600 hover:underline font-medium"
                    >
                      Đánh dấu tất cả đã đọc
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-gray-500">Không có thông báo mới.</div>
                ) : (
                  <ul className="max-h-60 overflow-y-auto">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between ${
                          !n.isRead ? 'bg-brand-50/50' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                        {!n.isRead && (
                          <div className="w-2 h-2 bg-brand-600 rounded-full"></div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-4 py-2 border-t border-gray-50">
                  <button
                    onClick={() => setDropdownOpen(false)}
                    className="w-full py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
