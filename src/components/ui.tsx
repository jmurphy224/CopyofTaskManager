import type { CSSProperties, ReactNode } from 'react';
import type { Profile, Tag } from '../lib/types';

const PATHS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 18l-6-6 6-6" />,
  next: <path d="M9 6l6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3 3 0 010 6M21 20c0-2.6-1.6-4.8-4-5.6" /></>,
  sync: <><path d="M20 11a8 8 0 00-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0014.3 4.9L20 16" /><path d="M20 20v-4h-4" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  list: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /></>,
  tv: <><rect x="2" y="5" width="20" height="13" rx="2" /><path d="M8 21h8" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 18, style }: { name: keyof typeof PATHS | string; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Avatar({ person, size = 32 }: { person: Pick<Profile, 'initials' | 'color' | 'name'> | undefined; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: person?.color ?? '#6B665C', width: size, height: size, fontSize: Math.round(size * 0.38) }}
      title={person?.name}
      aria-hidden="true"
    >
      {person?.initials ?? '?'}
    </span>
  );
}

export function TagChip({ tag }: { tag: Tag }) {
  return <span className="chip" style={{ background: tag.bg, color: tag.fg }}>{tag.name}</span>;
}

export function ShowChip({ number }: { number: string }) {
  return (
    <span className="chip chip-show">
      <Icon name="hash" size={12} />Show {number}
    </span>
  );
}

export function Segmented<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { id: T; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
