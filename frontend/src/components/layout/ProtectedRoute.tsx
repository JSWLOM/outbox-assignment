import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../ui/Button';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-brand"><Spinner /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
