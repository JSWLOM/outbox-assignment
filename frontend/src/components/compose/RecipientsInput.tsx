import { KeyboardEvent, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { extractEmails } from '../../lib/format';

interface Props {
  recipients: string[];
  onChange: (next: string[]) => void;
  /** Called after a file is parsed, with the number of addresses found in that file. */
  onFileParsed: (found: number) => void;
}

const VISIBLE_CHIPS = 3;

export function RecipientsInput({ recipients, onChange, onFileParsed }: Props) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (found: string[]) => onChange([...new Set([...recipients, ...found])]);

  const commitText = () => {
    if (!text.trim()) return;
    add(extractEmails(text));
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && text.trim()) { e.preventDefault(); commitText(); }
    else if (e.key === 'Backspace' && !text && recipients.length) onChange(recipients.slice(0, -1));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const found = extractEmails(await file.text());
    add(found);
    onFileParsed(found.length);
    if (fileRef.current) fileRef.current.value = '';
  };

  const shown = expanded ? recipients : recipients.slice(0, VISIBLE_CHIPS);
  const hidden = recipients.length - shown.length;

  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {shown.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-2.5 py-0.5 text-xs">
            {r}
            <button type="button" aria-label={`Remove ${r}`} onClick={() => onChange(recipients.filter((x) => x !== r))}>
              <X size={11} />
            </button>
          </span>
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-brand bg-brand-soft px-2.5 py-0.5 text-xs">
            +{hidden}
          </button>
        )}
        {expanded && recipients.length > VISIBLE_CHIPS && (
          <button type="button" onClick={() => setExpanded(false)} className="text-xs text-neutral-400 hover:underline">collapse</button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={commitText}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (/[\s,;]/.test(pasted.trim())) { e.preventDefault(); add(extractEmails(pasted)); }
          }}
          placeholder={recipients.length ? '' : 'recipient@example.com'}
          className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-neutral-400"
        />
      </div>

      <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" onClick={() => fileRef.current?.click()} className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand hover:underline">
        <Upload size={14} /> Upload List
      </button>
    </div>
  );
}
