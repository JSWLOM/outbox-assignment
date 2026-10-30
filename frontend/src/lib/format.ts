export const formatScheduled = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' });

export const formatFull = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const nameFromEmail = (email: string) => email.split('@')[0];

export function decodeEntities(s: string) {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Pull every unique, lower-cased email address out of free text / CSV content. */
export const extractEmails = (text: string) =>
  [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];

export const toLocalInputValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
