import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Clock, Paperclip } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatFull } from '../lib/format';
import type { ScheduleRequest, ScheduleResponse, Sender } from '../types';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { RichTextEditor } from '../components/compose/RichTextEditor';
import { RecipientsInput } from '../components/compose/RecipientsInput';
import { SendLaterPopover } from '../components/compose/SendLaterPopover';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <span className="w-14 shrink-0 pt-1.5 text-xs text-neutral-700">{label}</span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const numberInput =
  'w-16 rounded-md bg-surface px-2.5 py-1.5 text-center text-xs outline-none placeholder:text-neutral-400 focus:ring-1 focus:ring-brand';

export default function ComposePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileBtnRef = useRef<HTMLDivElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [filesUploaded, setFilesUploaded] = useState(0);
  const [lastFileCount, setLastFileCount] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [delaySec, setDelaySec] = useState('');
  const [hourly, setHourly] = useState('');
  const [html, setHtml] = useState('');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [popover, setPopover] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<Sender[]>('/api/senders').then(setSenders).catch((e) => toast.error(errorMessage(e)));
  }, [toast]);

  const submit = async () => {
    if (!recipients.length) return toast.error('Add at least one recipient.');
    if (!subject.trim()) return toast.error('Subject is required.');
    if (!html) return toast.error('Write a message body.');

    const delay = delaySec === '' ? 2 : Number(delaySec);
    const limit = hourly === '' ? undefined : Number(hourly);
    if (!Number.isFinite(delay) || delay < 0) return toast.error('Delay must be 0 or more seconds.');
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) return toast.error('Hourly limit must be a whole number of 1 or more.');

    const payload: ScheduleRequest = {
      subject: subject.trim(),
      body: html,
      recipients,
      startTime: (startAt ?? new Date()).toISOString(),
      delayBetweenMs: Math.round(delay * 1000),
      hourlyLimit: limit,
      senderId: senderId ? Number(senderId) : undefined,
    };

    setSending(true);
    try {
      const res = await api<ScheduleResponse>('/api/emails/schedule', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(`${res.count} email${res.count === 1 ? '' : 's'} scheduled`);
      navigate('/scheduled');
    } catch (e) {
      toast.error(errorMessage(e));
      setSending(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-5">
      <header className="relative mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-1.5 hover:bg-neutral-100"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-lg font-medium">Compose New Email</h1>

        <div ref={fileBtnRef} className="flex items-center gap-3">
          <span className="relative text-brand" title="Recipient lists uploaded">
            <Paperclip size={18} />
            {filesUploaded > 0 && <sub className="absolute -bottom-1 left-3.5 text-[9px]">{filesUploaded}</sub>}
          </span>
          <button type="button" aria-label="Send later" onClick={() => setPopover((o) => !o)} className="text-brand">
            <Clock size={18} />
          </button>
          <Button variant="outline" loading={sending} onClick={submit}>{startAt ? 'Send Later' : 'Send'}</Button>
        </div>

        {popover && <SendLaterPopover value={startAt} onApply={setStartAt} onClose={() => setPopover(false)} />}
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-3.5">
        <Row label="From">
          <div className="relative inline-block">
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              aria-label="From"
              className="appearance-none rounded-md bg-surface py-1.5 pl-3 pr-7 text-xs outline-none"
            >
              <option value="">Auto (rotate across {senders.length || '…'} senders)</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2 top-2 text-neutral-400" />
          </div>
        </Row>

        <Row label="To">
          <RecipientsInput
            recipients={recipients}
            onChange={setRecipients}
            onFileParsed={(n) => { setFilesUploaded((c) => c + 1); setLastFileCount(n); }}
          />
          <p className="mt-1 text-[11px] text-neutral-500" aria-live="polite">
            {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
            {lastFileCount !== null && ` · ${lastFileCount} email address${lastFileCount === 1 ? '' : 'es'} detected in the uploaded file`}
          </p>
        </Row>

        <Row label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full border-b border-neutral-200 bg-transparent pb-2 pt-1 text-sm outline-none placeholder:text-neutral-400"
          />
        </Row>

        <div className="flex flex-wrap items-center gap-6 pl-[4.5rem] text-xs">
          <label className="flex items-center gap-2">
            Delay between 2 emails
            <input type="number" min={0} step="any" value={delaySec} onChange={(e) => setDelaySec(e.target.value)} placeholder="00" className={numberInput} />
            <span className="text-neutral-400">sec</span>
          </label>
          <label className="flex items-center gap-2">
            Hourly Limit
            <input type="number" min={1} step={1} value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder="00" className={numberInput} />
          </label>
          {startAt && <span className="text-brand">Starts {formatFull(startAt.toISOString())}</span>}
        </div>

        <div className="mt-1">
          <RichTextEditor onChange={setHtml} />
        </div>
      </div>
    </div>
  );
}
