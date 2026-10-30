import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import type { Counts } from '../types';

export function useCounts() {
  const [counts, setCounts] = useState<Counts>({ scheduled: 0, sent: 0 });
  const { pathname } = useLocation();

  useEffect(() => {
    const load = () => api<Counts>('/api/emails/counts').then(setCounts).catch(() => undefined);
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [pathname]);

  return counts;
}
