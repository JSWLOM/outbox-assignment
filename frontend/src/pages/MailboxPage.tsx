import { useEffect, useState } from 'react';
import { Inbox, RefreshCw, Search, Clock } from 'lucide-react';
import { useEmails } from '../hooks/useEmails';
import { useToast } from '../components/ui/Toast';
import { EmailRow } from '../components/emails/EmailRow';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import type { MailboxKind } from '../types';

export default function MailboxPage({ kind }: { kind: MailboxKind }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const { items, loading, error, reload } = useEmails(kind, query);
  const toast = useToast();

  useEffect(() => { setInput(''); setQuery(''); }, [kind]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  useEffect(() => { if (error) toast.error(error); }, [error, toast]);

  const Icon = kind === 'scheduled' ? Clock : Inbox;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm">
          <Search size={15} className="text-neutral-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>
        <button onClick={reload} aria-label="Refresh" className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : error && !items.length ? (
        <div className="py-24 text-center text-sm text-neutral-500">
          <p className="mb-3">Couldn't load emails.</p>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon size={40} />}
          title={query ? 'No emails match your search' : kind === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
          hint={query ? undefined : kind === 'scheduled' ? 'Use Compose to schedule one.' : 'Emails appear here once they are sent.'}
        />
      ) : (
        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          {items.map((e) => <EmailRow key={e.id} email={e} />)}
        </div>
      )}
    </div>
  );
}
