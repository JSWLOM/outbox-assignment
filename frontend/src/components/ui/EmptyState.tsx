import { ReactNode } from 'react';

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-neutral-400">
      <div className="text-neutral-300">{icon}</div>
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  );
}
