import { useEffect, useRef, useState, ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Clock, LogOut, Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCounts } from '../../hooks/useCounts';
import { useToast } from '../ui/Toast';
import { api, errorMessage } from '../../lib/api';
import type { SlackStatus } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';

function NavItem({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-soft font-semibold' : 'text-neutral-700 hover:bg-neutral-50'}`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-xs text-neutral-500">{count}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const counts = useCounts();
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    api<SlackStatus>('/api/slack/status').then(setSlack).catch(() => setSlack(null));
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const connectSlack = async () => {
    try {
      const { url } = await api<{ url: string }>('/api/slack/connect');
      window.location.href = url;
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const disconnectSlack = async () => {
    try {
      await api('/api/slack', { method: 'DELETE' });
      setSlack({ connected: false });
      toast.success('Slack disconnected');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-3 p-4">
      <div className="mb-1"><Logo /></div>

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl bg-surface px-3 py-2 text-left"
        >
          <Avatar name={user?.name ?? user?.email} src={user?.avatar} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user?.name}</span>
            <span className="block truncate text-[11px] text-neutral-500">{user?.email}</span>
          </span>
          <ChevronDown size={16} className="text-neutral-400" />
        </button>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
            {slack?.connected ? (
              <button onClick={disconnectSlack} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-50">
                <MessageSquare size={16} /> Disconnect Slack{slack.channel ? ` (${slack.channel})` : ''}
              </button>
            ) : (
              <button onClick={connectSlack} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-50">
                <MessageSquare size={16} /> Connect Slack
              </button>
            )}
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => navigate('/compose')}>Compose</Button>

      <p className="mt-2 px-3 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Core</p>
      <nav className="flex flex-col gap-1">
        <NavItem to="/scheduled" icon={<Clock size={16} />} label="Scheduled" count={counts.scheduled} />
        <NavItem to="/sent" icon={<Send size={16} />} label="Sent" count={counts.sent} />
      </nav>
    </aside>
  );
}
