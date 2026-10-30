import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout, DashboardRedirect } from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import MailboxPage from './pages/MailboxPage';
import EmailDetailPage from './pages/EmailDetailPage';
import ComposePage from './pages/ComposePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/scheduled" element={<MailboxPage kind="scheduled" />} />
          <Route path="/sent" element={<MailboxPage kind="sent" />} />
          <Route path="/email/:id" element={<EmailDetailPage />} />
        </Route>
        <Route path="/compose" element={<ComposePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/scheduled" replace />} />
    </Routes>
  );
}
