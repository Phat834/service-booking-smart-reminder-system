import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';

const LoadingSpinner: React.FC = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
  </div>
);

export const GuestGuard: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default GuestGuard;
