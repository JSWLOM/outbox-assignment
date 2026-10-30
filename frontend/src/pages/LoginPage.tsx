import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../lib/api';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (!loading && user) return <Navigate to="/scheduled" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 p-7">
        <h1 className="mb-5 text-center text-2xl font-bold">Login</h1>

        {params.get('error') && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
            Google sign-in failed. Please try again.
          </p>
        )}

        <a
          href={apiUrl('/auth/google')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-medium hover:bg-green-100"
        >
          <GoogleIcon /> Login with Google
        </a>

        <div className="my-4 flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" /> or sign up through email <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <fieldset disabled className="flex flex-col gap-2.5 opacity-60">
          <input placeholder="Email ID" className="rounded-lg bg-surface px-3 py-2.5 text-xs" />
          <input placeholder="Password" type="password" className="rounded-lg bg-surface px-3 py-2.5 text-xs" />
          <button className="mt-2 rounded-lg bg-brand py-2.5 text-sm text-white">Login</button>
        </fieldset>
        <p className="mt-3 text-center text-[11px] text-neutral-400">Email sign-in isn't available yet. Please use Google.</p>
      </div>
    </div>
  );
}
