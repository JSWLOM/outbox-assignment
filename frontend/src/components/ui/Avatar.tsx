interface Props { name?: string | null; src?: string | null; size?: number }

export function Avatar({ name, src, size = 32 }: Props) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" referrerPolicy="no-referrer" style={style} className="rounded-full object-cover" />;
  return (
    <span style={style} className="inline-flex items-center justify-center rounded-full bg-brand text-white text-sm font-medium">
      {(name?.[0] ?? '?').toUpperCase()}
    </span>
  );
}
