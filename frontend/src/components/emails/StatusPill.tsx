import { Clock } from 'lucide-react';
import { formatScheduled } from '../../lib/format';
import type { EmailListItem } from '../../types';

export function StatusPill({ email }: { email: Pick<EmailListItem, 'status' | 'scheduled_at'> }) {
  const base = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium';
  switch (email.status) {
    case 'scheduled':
      return <span className={`${base} bg-orange-100 text-orange-700`}><Clock size={11} />{formatScheduled(email.scheduled_at)}</span>;
    case 'processing':
      return <span className={`${base} bg-blue-100 text-blue-700`}>Sending</span>;
    case 'failed':
      return <span className={`${base} bg-red-100 text-red-700`}>Failed</span>;
    default:
      return <span className={`${base} bg-neutral-100 text-neutral-600`}>Sent</span>;
  }
}
