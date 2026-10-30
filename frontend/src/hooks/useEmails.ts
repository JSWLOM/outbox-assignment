import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { EmailListItem, MailboxKind } from '../types';

const STATUSES: Record<MailboxKind, string> = { scheduled: 'scheduled,processing', sent: 'sent,failed' };
const POLL_MS = 10_000;

/** Loads a mailbox (optionally filtered by a search query) and silently refreshes it. */
export function useEmails(kind: MailboxKind, query: string) {
  const [items, setItems] = useState<EmailListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async (silent = false) => {
    const id = ++latest.current;
    if (!silent) setLoading(true);
    const path = query
      ? `/api/emails/search?q=${encodeURIComponent(query)}&status=${STATUSES[kind]}`
      : `/api/emails/${kind}`;
    try {
      const data = await api<EmailListItem[]>(path);
      if (id === latest.current) { setItems(data); setError(null); }
    } catch (e) {
      if (id === latest.current) setError(errorMessage(e));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return { items, loading, error, reload: () => load() };
}
