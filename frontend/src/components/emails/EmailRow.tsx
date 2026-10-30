import { Link } from 'react-router-dom';
import { decodeEntities, nameFromEmail } from '../../lib/format';
import type { EmailListItem } from '../../types';
import { StatusPill } from './StatusPill';

export function EmailRow({ email }: { email: EmailListItem }) {
  return (
    <Link to={`/email/${email.id}`} className="flex items-center gap-4 px-4 py-3.5 text-sm hover:bg-neutral-50">
      <span className="w-36 shrink-0 truncate" title={email.email}>To: {nameFromEmail(email.email)}</span>
      <StatusPill email={email} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{email.subject}</span>
        <span className="text-neutral-400"> - {decodeEntities(email.snippet)}</span>
      </span>
    </Link>
  );
}
