import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { toLocalInputValue } from '../../lib/format';
import { Button } from '../ui/Button';

interface Props { value: Date | null; onApply: (d: Date | null) => void; onClose: () => void }

const tomorrowAt = (hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const QUICK_PICKS: { label: string; get: () => Date }[] = [
  { label: 'Tomorrow', get: () => tomorrowAt(9) },
  { label: 'Tomorrow, 10:00 AM', get: () => tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', get: () => tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', get: () => tomorrowAt(15) },
];

export function SendLaterPopover({ value, onApply, onClose }: Props) {
  const [pending, setPending] = useState<Date | null>(value);
  const inPast = pending !== null && pending.getTime() < Date.now() - 60_000;

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
      <p className="mb-3 text-sm font-medium">Send Later</p>

      <label className="relative mb-1 block">
        <input
          type="datetime-local"
          aria-label="Pick date and time"
          value={pending ? toLocalInputValue(pending) : ''}
          min={toLocalInputValue(new Date())}
          onChange={(e) => setPending(e.target.value ? new Date(e.target.value) : null)}
          className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand"
        />
        <Calendar size={13} className="pointer-events-none absolute right-8 top-2 text-neutral-300" />
      </label>
      {inPast && <p className="mb-1 text-[11px] text-red-600">Pick a time in the future.</p>}

      <ul className="mt-2">
        {QUICK_PICKS.map((p) => (
          <li key={p.label}>
            <button type="button" onClick={() => setPending(p.get())} className="w-full rounded px-1 py-2 text-left text-xs hover:bg-neutral-50">
              {p.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => { onApply(null); onClose(); }}>Cancel</Button>
        <Button variant="outline" disabled={inPast} onClick={() => { onApply(pending); onClose(); }}>Done</Button>
      </div>
    </div>
  );
}
