import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui';
import { IS_DEMO } from '../lib/config';
import { addDays, DAY_NAMES, DOW_SHORT, effectiveTime, fmtTime, MONTH_NAMES, taskStatus, ymd } from '../lib/dates';
import { demoDisplayBackend } from '../lib/demoBackend';
import { liveDisplayBackend } from '../lib/liveBackend';
import { useNow } from '../lib/useNow';
import type { DisplayFeed } from '../lib/types';

const TOKEN_KEY = 'runsheet-display-token';
const backend = IS_DEMO ? demoDisplayBackend : liveDisplayBackend;
const REFRESH_MS = 30_000;
/** More than this many tasks today and the rest show as "+N more". */
const MAX_TODAY = 7;

function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t: string | null) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

const STATUS = {
  done: { label: 'Done', color: '#8FD3A4' },
  overdue: { label: 'Overdue', color: '#FFA467' },
  'due-today': { label: 'Due today', color: '#9DB0EA' },
  upcoming: { label: 'Upcoming', color: '#9DB0EA' },
} as const;

/** The view-only shop TV screen. */
export function TvPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow(15_000);
  const [feed, setFeed] = useState<DisplayFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Demo: ?display=<id> picks a TV; live: the token saved when the TV was paired.
  const demoDisplays = IS_DEMO ? [{ id: 'tv-warehouse', name: 'Warehouse' }, { id: 'tv-carpenters', name: 'Carpenters' }] : [];
  const token = IS_DEMO ? params.get('display') ?? readToken() ?? 'tv-warehouse' : readToken();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const today = new Date();
      setFeed(await backend.feed(token, ymd(today), ymd(addDays(today, 5))));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate('/tv/pair', { replace: true }); return; }
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [token, load, navigate]);

  // Demo: refresh right away when tasks change in another tab.
  useEffect(() => {
    if (!IS_DEMO) return;
    try {
      const ch = new BroadcastChannel('runsheet-demo');
      ch.onmessage = () => void load();
      return () => ch.close();
    } catch { return undefined; }
  }, [load]);

  if (error && !feed) {
    return (
      <div className="tv-pair">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
          <h1>Display not available</h1>
          <p className="err">{error}</p>
          <Link to="/tv/pair" onClick={() => writeToken(null)}>Pair this TV again</Link>
        </div>
      </div>
    );
  }
  if (!feed) return <div className="tv" aria-busy="true"><p>Loading…</p></div>;

  const todayKey = ymd(now);
  const nowHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const people = new Map(feed.people.map((p) => [p.id, p]));
  const byTime = (a: { dueTime: string | null }, b: { dueTime: string | null }) => effectiveTime(a).localeCompare(effectiveTime(b));
  const today = feed.tasks.filter((t) => t.dueDate === todayKey).sort(byTime);
  const counts = { open: 0, done: 0, overdue: 0 };
  today.forEach((t) => {
    const s = taskStatus(t, now);
    if (s === 'done') counts.done++; else counts.open++;
    if (s === 'overdue') counts.overdue++;
  });
  const todayEvents = feed.events.filter((e) => e.date === todayKey);
  const upcoming = Array.from({ length: 5 }, (_, i) => addDays(now, i + 1)).map((d) => {
    const key = ymd(d);
    const items = [
      ...feed.events.filter((e) => e.date === key).map((e) => ({ id: e.id, sort: e.time ?? '00:00', time: e.time ? fmtTime(e.time) : 'All day', title: e.title, who: 'Calendar', cal: true })),
      ...feed.tasks.filter((t) => t.dueDate === key).map((t) => ({
        id: t.id, sort: effectiveTime(t), time: fmtTime(effectiveTime(t)), title: t.title + (t.showNumber ? ` · Show ${t.showNumber}` : ''),
        who: people.get(t.assigneeId)?.short ?? '', cal: false,
      })),
    ].sort((a, b) => a.sort.localeCompare(b.sort));
    return { label: `${DOW_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()}`, items };
  }).filter((d) => d.items.length);

  return (
    <div className="tv">
      <header>
        <div>
          <span className="kicker"><Icon name="eye" size={26} />Shop display · view only</span>
          <h1>{feed.group.name}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
          {IS_DEMO && (
            <div className="picker" role="group" aria-label="Preview display">
              <span style={{ padding: '0 8px', color: '#B8B2A6' }}>Preview display</span>
              {demoDisplays.map((d) => (
                <button key={d.id} type="button" aria-pressed={d.id === token} onClick={() => setParams({ display: d.id })}>{d.name}</button>
              ))}
            </div>
          )}
          <div className="clock">
            <span>{DAY_NAMES[now.getDay()]}, {MONTH_NAMES[now.getMonth()]} {now.getDate()}</span>
            <span className="t">{fmtTime(nowHM)}</span>
          </div>
        </div>
      </header>

      <div className="cols">
        <section aria-labelledby="tv-today">
          <h2 id="tv-today">
            Today
            {todayEvents.map((e) => (
              <span key={e.id} className="tv-event"><Icon name="calendar" size={18} /><span className="t">{e.time ? fmtTime(e.time) : 'All day'}</span>{e.title}</span>
            ))}
          </h2>
          <div className={`today${today.length > 4 ? ' compact' : ''}`}>
            {today.slice(0, MAX_TODAY).map((t) => {
              const s = taskStatus(t, now);
              const p = people.get(t.assigneeId);
              return (
                <div key={t.id} className={`row ${s}`}>
                  <div className="time">
                    {fmtTime(effectiveTime(t))}
                    <span className="status" style={{ color: STATUS[s].color }}>{STATUS[s].label}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="title">{t.title}</div>
                    <div className="meta">{t.showNumber ? `Show ${t.showNumber}` : 'Shop task'}</div>
                  </div>
                  <div className="who">
                    {p?.short ?? ''}
                    <span className="avatar" style={{ background: lighten(p?.color) }}>{p?.initials ?? '?'}</span>
                  </div>
                </div>
              );
            })}
            {today.length > MAX_TODAY && <p style={{ margin: 0, fontSize: '1.2em', color: '#B8B2A6' }}>+{today.length - MAX_TODAY} more today</p>}
            {today.length === 0 && <p style={{ fontSize: '1.4em', color: '#B8B2A6' }}>Nothing scheduled today.</p>}
          </div>
        </section>
        <section aria-labelledby="tv-week">
          <h2 id="tv-week">Rest of this week</h2>
          <div className="week">
            {upcoming.map((d) => (
              <div key={d.label} className="dayrow">
                <span className="dlabel">{d.label}</span>
                <div className="its">
                  {d.items.map((it) => (
                    <div key={it.id} className={`it${it.cal ? ' cal' : ''}`}>
                      <span className="t">{it.time}</span><span className="ti">{it.title}</span><span className="w">{it.who}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <p style={{ color: '#B8B2A6' }}>Nothing else scheduled this week.</p>}
          </div>
        </section>
      </div>

      <footer>
        <div className="n">
          <span><strong>{counts.open}</strong> open today</span>
          <span><strong style={{ color: '#8FD3A4' }}>{counts.done}</strong> done</span>
          <span style={{ color: counts.overdue ? '#FFA467' : undefined }}><strong>{counts.overdue}</strong> overdue</span>
        </div>
        <span>Nothing can be changed from this screen. Tasks are checked off by the assignee on their own login.{error ? ' · Reconnecting…' : ''}</span>
      </footer>
    </div>
  );
}

/** Lighter avatar colors read better on the dark TV background. */
function lighten(hex = '#6B665C'): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** A TV types in the code from the Shop TVs page once. */
export function TvPairPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await backend.pair(code);
      writeToken(token);
      navigate(IS_DEMO ? `/tv?display=${token}` : '/tv', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tv-pair">
      <form onSubmit={submit}>
        <h1>Link this TV</h1>
        <p>An admin can find the six-character code on the Shop TVs page in Runsheet.</p>
        <label htmlFor="code" className="sr-only">Pairing code</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoComplete="off" autoFocus />
        <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 6} style={{ minHeight: 56, fontSize: 20 }}>
          {busy ? 'Linking…' : 'Link TV'}
        </button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </div>
  );
}
