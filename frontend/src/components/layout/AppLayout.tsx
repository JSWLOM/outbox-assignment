import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useToast } from '../ui/Toast';

export function AppLayout() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  // Slack OAuth redirects back with ?slack=connected|error
  useEffect(() => {
    const result = params.get('slack');
    if (!result) return;
    if (result === 'connected') toast.success('Slack connected');
    else toast.error('Could not connect Slack');
    params.delete('slack');
    setParams(params, { replace: true });
  }, [params, setParams, toast]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 pl-0"><Outlet /></main>
    </div>
  );
}

/** Backend redirects here after OAuth; keep the query string (e.g. ?slack=connected). */
export function DashboardRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/scheduled', search }} replace />;
}
