import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { GuestGuard } from '@/components/GuestGuard';
import { RoleGuard } from '@/components/RoleGuard';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import HomePage from '@/pages/HomePage';
import MyBookingsPage from '@/pages/MyBookingsPage';

const App = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={
        <GuestGuard>
          <LoginPage />
        </GuestGuard>
      } />
      <Route path="/register" element={
        <GuestGuard>
          <RegisterPage />
        </GuestGuard>
      } />
      <Route path="/" element={
        <RoleGuard allowedRoles={['ADMIN', 'STAFF', 'CUSTOMER']}>
          <Layout>
            <HomePage />
          </Layout>
        </RoleGuard>
      } />
      <Route path="/my-bookings" element={
        <RoleGuard allowedRoles={['ADMIN', 'STAFF', 'CUSTOMER']}>
          <Layout>
            <MyBookingsPage />
          </Layout>
        </RoleGuard>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
