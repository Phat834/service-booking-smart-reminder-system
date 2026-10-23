import { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

const typeConfig: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
  error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
};

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId;
    const newToast: Toast = { ...t, id, duration: t.duration ?? 5000 };
    setToasts((prev) => [...prev, newToast]);
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastItemProps {
  toast: Toast;
  dismiss: (id: number) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, dismiss }) => {
  const { id, title, message, type } = toast;
  const config = typeConfig[type];
  const Icon = iconMap[type];

  return (
    <div
      className={`flex items-start gap-3 w-64 p-4 rounded-lg shadow-lg border ${config.bg} ${config.text} ${config.border} animate-in fade-in slide-in-from-right-2 duration-300 pointer-events-auto`}
      role="alert"
    >
      <div className="flex-shrink-0 w-5 h-5 mt-0.5">
        <Icon className="w-full h-full" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium">{title}</h4>
        {message && <p className="text-xs mt-1 opacity-90">{message}</p>}
      </div>
      <button
        onClick={() => dismiss(id)}
        className="flex-shrink-0 ml-2 p-1 hover:opacity-70 transition-opacity"
      >
        <span className="sr-only">Đóng</span>
        <svg className="w-4 h-4 currentColor" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
