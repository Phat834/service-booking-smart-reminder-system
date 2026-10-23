import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import axiosClient from '@/api/axiosClient';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

type DemoUser = {
  email: string;
  password: string;
  label: string;
};

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@demo.com', password: '123456', label: 'Login as Admin' },
  { email: 'staff1@demo.com', password: '123456', label: 'Login as Staff / Doctor' },
  { email: 'customer1@demo.com', password: '123456', label: 'Login as Customer' },
];

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage = () => {
  const [form, setForm] = useState<LoginFormData>({ email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (key: keyof LoginFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleDemoLogin = (user: DemoUser) => {
    setForm({ email: user.email, password: user.password });
    setError('');
    performLogin(user.email, user.password);
  };

  const performLogin = async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.post('/auth/login', { email, password });
      const token = res.data.token || res.data.accessToken;
      const user = res.data.user;
      if (!token || !user) {
        throw new Error('Không nhận được token từ server');
      }
      login(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(form.email, form.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4] px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-md w-full space-y-8">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Chào mừng quay lại</h2>
          <p className="mt-2 text-sm text-gray-600">Đăng nhập để quản lý đặt lịch dịch vụ</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu
                </label>
                <Link
                  to="/register"
                  className="text-xs text-brand-600 font-medium hover:underline hover:text-brand-700"
                >
                  Tạo tài khoản mới
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100 flex items-center gap-2">
              <span className="w-5 h-5 flex-shrink-0">⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Đang đăng nhập...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" /> Đăng nhập
              </>
            )}
          </button>

          <p className="text-center text-sm text-gray-600">
            Nếu bạn là Nhà tuyển dụng, hãy sử dụng truy cập nhanh bên dưới.
          </p>
        </form>

        {/* Quick Demo Access (For Recruiters) */}
        <div className="mt-8 p-6 rounded-2xl border-2 border-dashed border-brand-100 bg-brand-50 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-brand-700 font-semibold text-sm uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Quick Demo Access (For Recruiters)
          </div>
          <p className="text-xs text-brand-600/70 mb-4 text-center">
            Tự động điền thông tin và đăng nhập ngay bằng 1 cú click
          </p>
          <div className="space-y-3">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => handleDemoLogin(user)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-brand-200 bg-white text-brand-700 font-semibold hover:bg-brand-100 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-all text-sm"
              >
                <User className="w-4 h-4" />
                <span>{user.label}</span>
                <span className="ml-auto text-[10px] font-medium text-brand-500 bg-brand-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  1 click
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {DEMO_USERS.map((user) => (
              <div key={user.email} className="text-[10px] text-brand-600 font-medium text-center bg-brand-50/50 px-2 py-1 rounded border border-brand-100">
                {user.email} / {user.password}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
