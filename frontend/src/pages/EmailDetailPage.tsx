import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatFull } from '../lib/format';
import type { EmailDetail } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Button';
import { StatusPill } from '../components/emails/StatusPill';

export default function EmailDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EmailDetail>(`/api/emails/${id}`).then(setEmail).catch((e) => setError(errorMessage(e)));
  }, [id]);

  const safeBody = useMemo(() => (email ? DOMPurify.sanitize(email.body) : ''), [email]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 hover:bg-neutral-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="truncate text-lg font-medium">{email?.subject ?? ''}</h1>
      </div>

      {error ? (
        <p className="py-20 text-center text-sm text-neutral-500">
          {error}. <Link to="/scheduled" className="text-brand underline">Back to mailbox</Link>
        </p>
      ) : !email ? (
        <div className="flex justify-center py-20 text-brand"><Spinner /></div>
      ) : (
        <div className="max-w-3xl pl-2">
          <div className="flex items-start gap-3">
            <Avatar name={email.sender_email} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><span className="font-semibold">Scheduler</span> <span className="text-neutral-500">&lt;{email.sender_email}&gt;</span></p>
              <p className="text-xs text-neutral-500">to {email.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-neutral-500">
              <span>{formatFull(email.sent_at ?? email.scheduled_at)}</span>
              <StatusPill email={email} />
            </div>
          </div>

          {email.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Failed: {email.error}</p>}

          <div className="rich mt-6" dangerouslySetInnerHTML={{ __html: safeBody }} />

          {email.preview_url && (
            <a href={email.preview_url} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-1.5 text-xs text-brand hover:underline">
              <ExternalLink size={13} /> View delivered message on Ethereal
            </a>
          )}
        </div>
      )}
    </div>
  );
}
