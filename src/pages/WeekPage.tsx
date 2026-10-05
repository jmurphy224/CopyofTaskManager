import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Avatar, Icon, Segmented, ShowChip, TagChip } from '../components/ui';
import { useNow } from '../lib/useNow';
import {
  addDays, DOW_SHORT, dueLabel, effectiveTime, fmtTime, mondayOf, MONTH_NAMES, MONTH_SHORT, parseYmd, taskStatus, ymd,
} from '../lib/dates';
import { canCompleteTask, canManageCalendars, completeLockReason, isManagerOrAdmin } from '../lib/permissions';
import { useApp } from '../lib/store';
import type { AppData, CalEvent, EventVisibility, Profile, Task } from '../lib/types';

type Scope = 'mine' | 'groups' | 'all';
type View = 'list' | 'month';

const STATUS_TEXT = { done: 'Done', overdue: 'Overdue', 'due-today': 'Due today', upcoming: 'Due' } as const;

export function WeekPage() {
  const { viewer, data, actions } = useApp();
  const now = useNow(30_000);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const elevated = isManagerOrAdmin(viewer);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  const weekStart = params.get('week') ? mondayOf(parseYmd(params.get('week')!)) : mondayOf(now);
  const view: View = params.get('view') === 'month' ? 'month' : 'list';
  let scope = (params.get('scope') as Scope | null) ?? (elevated ? 'all' : 'groups');
  if (scope === 'all' && !elevated) scope = 'groups';
  const person = elevated ? params.get('who') ?? 'any' : 'any';
  const activeTags = (params.get('tags') ?? '').split(',').filter(Boolean);

  const people = useMemo(() => new Map(data.profiles.map((p) => [p.id, p])), [data.profiles]);
  const tags = useMemo(() => new Map(data.tags.map((t) => [t.id, t])), [data.tags]);
  const groups = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups]);
  const calendars = useMemo(() => new Map(data.calendars.map((c) => [c.id, c])), [data.calendars]);

  const q = search.trim().toLowerCase();
  const matches = (t: Task) => {
    if (scope === 'mine' && t.assigneeId !== viewer.id) return false;
    if (scope === 'groups' && !(t.assigneeId === viewer.id || (t.groupId && viewer.groupIds.includes(t.groupId)))) return false;
    if (person !== 'any' && t.assigneeId !== person) return false;
    if (activeTags.length && !t.tagIds.some((id) => activeTags.includes(id))) return false;
    if (q) {
      const hay = [t.title, t.notes, t.showNumber ?? '', ...t.tagIds.map((id) => tags.get(id)?.name ?? ''),
        people.get(t.assigneeId)?.name ?? '', t.groupId ? groups.get(t.groupId)?.name ?? '' : ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const eventShown = (e: CalEvent) => (elevated ? calendars.get(e.calendarId)?.showEvents !== false : e.visibleToProfileId === viewer.id);

  const tasksOn = (key: string) => data.tasks
    .filter((t) => t.dueDate === key && matches(t))
    .sort((a, b) => effectiveTime(a).localeCompare(effectiveTime(b)) || a.title.localeCompare(b.title));
  const eventsOn = (key: string) => data.events
    .filter((e) => e.date === key && eventShown(e) && (!q || e.title.toLowerCase().includes(q)))
    .sort((a, b) => (a.time ?? '00:00').localeCompare(b.time ?? '00:00'));

  // Range for counters and headings
  const mid = addDays(weekStart, 3);
  const monthStart = new Date(mid.getFullYear(), mid.getMonth(), 1);
  const monthEnd = new Date(mid.getFullYear(), mid.getMonth() + 1, 0);
  const [rangeFrom, rangeTo] = view === 'month' ? [ymd(monthStart), ymd(monthEnd)] : [ymd(weekStart), ymd(addDays(weekStart, 6))];
  const inRange = data.tasks.filter((t) => t.dueDate >= rangeFrom && t.dueDate <= rangeTo && matches(t));
  const counts = { open: 0, done: 0, overdue: 0 };
  inRange.forEach((t) => {
    const s = taskStatus(t, now);
    if (s === 'done') counts.done++; else counts.open++;
    if (s === 'overdue') counts.overdue++;
  });

  const thisMonday = mondayOf(now);
  const weekEnd = addDays(weekStart, 6);
  const weekTag = ymd(weekStart) === ymd(thisMonday) ? 'This week'
    : ymd(weekStart) === ymd(addDays(thisMonday, 7)) ? 'Next week'
    : ymd(weekStart) === ymd(addDays(thisMonday, -7)) ? 'Last week' : 'Week of';
  const title = view === 'month'
    ? `${MONTH_NAMES[mid.getMonth()]} ${mid.getFullYear()}`
    : `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekStart.getMonth() === weekEnd.getMonth() ? '' : MONTH_SHORT[weekEnd.getMonth()] + ' '}${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const step = (dir: number) => {
    const next = view === 'month'
      ? mondayOf(new Date(mid.getFullYear(), mid.getMonth() + dir, 1))
      : addDays(weekStart, 7 * dir);
    set({ week: ymd(next) });
  };

  const scopeNote = scope === 'mine' ? `Tasks assigned to ${viewer.short}`
    : scope === 'groups' ? `${viewer.short}’s tasks + ${viewer.groupIds.map((g) => groups.get(g)?.name).filter(Boolean).join(' & ') || 'no'} group${viewer.groupIds.length === 1 ? '' : 's'}`
    : 'Everyone on the team';

  const sidebar = (
    <Sidebar data={data} viewer={viewer} activeTags={activeTags}
      onToggleTag={(id) => set({ tags: (activeTags.includes(id) ? activeTags.filter((x) => x !== id) : [...activeTags, id]).join(',') || null })}
      onClearTags={() => set({ tags: null })}
      onToggleCalendar={(id, on) => void actions.updateCalendar(id, { showEvents: on }).catch(() => undefined)}
    />
  );

  return (
    <AppShell sidebar={sidebar} search={search} onSearch={setSearch}>
      <div className="page">
        <Link to="/tasks/new" className="btn btn-primary narrow-only"><Icon name="plus" />New task</Link>
        <div className="week-head">
          <button type="button" className="icon-btn" aria-label={view === 'month' ? 'Previous month' : 'Previous week'} onClick={() => step(-1)}><Icon name="back" /></button>
          <button type="button" className="icon-btn" aria-label={view === 'month' ? 'Next month' : 'Next week'} onClick={() => step(1)}><Icon name="next" /></button>
          <div className="week-title">
            <span className="eyebrow">{view === 'month' ? 'Month' : weekTag}</span>
            <h1>{title}</h1>
          </div>
          <button type="button" className="btn" onClick={() => set({ week: null })}>This week</button>
          <label className="muted" htmlFor="jump" style={{ fontSize: 14 }}>Jump to</label>
          <input id="jump" type="date" className="input" style={{ width: 170 }} value={ymd(weekStart)}
            onChange={(e) => e.target.value && set({ week: ymd(mondayOf(parseYmd(e.target.value))) })} />
          <div className="push">
            <Segmented<View> label="Layout" value={view} onChange={(v) => set({ view: v === 'list' ? null : v })}
              options={[{ id: 'list', label: 'Week list' }, { id: 'month', label: 'Month calendar' }]} />
          </div>
        </div>

        <div className="filters">
          <Segmented<Scope> label="Whose tasks" value={scope} onChange={(v) => set({ scope: v })}
            options={[
              { id: 'mine', label: 'Assigned to me' },
              { id: 'groups', label: 'Me + my groups' },
              ...(elevated ? [{ id: 'all' as Scope, label: 'Everyone' }] : []),
            ]} />
          {elevated && (
            <>
              <label htmlFor="who" className="muted" style={{ fontSize: 14 }}>Assignee</label>
              <select id="who" className="select" value={person} onChange={(e) => set({ who: e.target.value === 'any' ? null : e.target.value })}>
                <option value="any">Anyone</option>
                {data.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
        </div>

        <div className="counts" aria-live="polite">
          <span><strong>{counts.open}</strong> open</span>
          <span><strong>{counts.done}</strong> done</span>
          <span className={counts.overdue ? 'over' : ''}><strong>{counts.overdue}</strong> overdue</span>
          <span>{scopeNote}{activeTags.length ? ` · tagged ${activeTags.map((id) => tags.get(id)?.name).join(' or ')}` : ''}{q ? ` · matching “${search.trim()}”` : ''}</span>
        </div>

        {view === 'list' ? (
          <div>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
              const key = ymd(d);
              const dayTasks = tasksOn(key);
              const dayEvents = eventsOn(key);
              const isToday = key === ymd(now);
              return (
                <section className="day" key={key} aria-label={`${DOW_SHORT[i]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}${isToday ? ', today' : ''}`}>
                  <div className={`day-badge${isToday ? ' today' : ''}`}>
                    <span>{DOW_SHORT[i]}</span><span className="num">{d.getDate()}</span><span className="mon">{MONTH_SHORT[d.getMonth()]}</span>
                  </div>
                  <div className="day-items">
                    {dayEvents.length > 0 && (
                      <div className="events-row">
                        <Icon name="calendar" size={16} style={{ color: 'var(--muted)' }} />
                        {dayEvents.map((e) => <EventChip key={e.id} event={e} data={data} viewer={viewer}
                          onShare={(v) => void actions.setEventVisibility(e.id, v).catch(() => undefined)} />)}
                      </div>
                    )}
                    {dayTasks.map((t) => <TaskRow key={t.id} task={t} data={data} viewer={viewer} now={now} dow={DOW_SHORT[i]}
                      onToggle={(done) => void actions.setTaskDone(t.id, done).catch(() => undefined)} />)}
                    {dayTasks.length === 0 && <div className="nothing">Nothing due</div>}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <MonthGrid monthStart={monthStart} now={now} tasksOn={tasksOn} eventsOn={eventsOn} data={data} viewer={viewer}
            onOpenWeek={(d) => set({ view: null, week: ymd(mondayOf(d)) })} />
        )}
      </div>
    </AppShell>
  );
}

function TaskRow({ task, data, viewer, now, dow, onToggle }: {
  task: Task; data: AppData; viewer: Profile; now: Date; dow: string; onToggle(done: boolean): void;
}) {
  const status = taskStatus(task, now);
  const assignee = data.profiles.find((p) => p.id === task.assigneeId);
  const group = task.groupId ? data.groups.find((g) => g.id === task.groupId) : null;
  const allowed = canCompleteTask(viewer, task);
  const checkId = `chk-${task.id}`;
  return (
    <div className={`task${task.done ? ' done' : ''}`}>
      <input
        id={checkId} type="checkbox" className="check" checked={task.done} disabled={!allowed}
        onChange={(e) => onToggle(e.target.checked)}
        title={allowed ? undefined : completeLockReason(assignee)}
        aria-label={allowed ? `${task.done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}` : completeLockReason(assignee)}
      />
      <div style={{ minWidth: 0 }}>
        <Link to={`/tasks/${task.id}`} className="task-title">{task.title}</Link>
        <div className="task-meta">
          {task.showNumber ? <ShowChip number={task.showNumber} /> : null}
          {task.tagIds.map((id) => data.tags.find((t) => t.id === id)).filter(Boolean).map((t) => <TagChip key={t!.id} tag={t!} />)}
          {group && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="people" size={14} />{group.name} group</span>}
          {task.recurrence !== 'none' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="repeat" size={14} />Repeats {task.recurrence === 'weekdays' ? 'weekdays' : task.recurrence}</span>}
        </div>
      </div>
      <span className={`task-due ${status}`}>
        <Icon name={status === 'overdue' ? 'alert' : status === 'done' ? 'check' : 'clock'} size={16} />
        {status === 'upcoming' ? 'Due' : `${STATUS_TEXT[status]} ·`} {dow} {dueLabel(task)}
      </span>
      <span className="task-who">{task.assigneeId === viewer.id ? 'You' : assignee?.short ?? 'Unknown'}<Avatar person={assignee} /></span>
    </div>
  );
}

function EventChip({ event, data, viewer, onShare }: { event: CalEvent; data: AppData; viewer: Profile; onShare(v: EventVisibility): void }) {
  const cal = data.calendars.find((c) => c.id === event.calendarId);
  const value = event.visibleToProfileId ? `p:${event.visibleToProfileId}` : event.visibleToDisplayId ? `d:${event.visibleToDisplayId}` : 'none';
  return (
    <span className="event">
      <span className="cal-dot" style={{ background: cal?.color ?? '#7A7468' }} />
      <span className="time">{event.time ? fmtTime(event.time) : 'All day'}</span>
      <span>{event.title}</span>
      {canManageCalendars(viewer) ? (
        <select
          aria-label={`Who can see: ${event.title}`} className={value === 'none' ? '' : 'shared'} value={value}
          onChange={(e) => {
            const v = e.target.value;
            onShare(v === 'none' ? { kind: 'none' } : v.startsWith('p:') ? { kind: 'profile', id: v.slice(2) } : { kind: 'display', id: v.slice(2) });
          }}
        >
          <option value="none">Not shared</option>
          {data.profiles.filter((p) => p.active && p.role === 'user').map((p) => <option key={p.id} value={`p:${p.id}`}>Visible to {p.short}</option>)}
          {data.displays.map((d) => <option key={d.id} value={`d:${d.id}`}>Visible on {d.name}</option>)}
        </select>
      ) : <span className="for-you">Assigned to you</span>}
    </span>
  );
}

function MonthGrid({ monthStart, now, tasksOn, eventsOn, data, viewer, onOpenWeek }: {
  monthStart: Date; now: Date; tasksOn(k: string): Task[]; eventsOn(k: string): CalEvent[]; data: AppData; viewer: Profile;
  onOpenWeek(d: Date): void;
}) {
  const gridStart = mondayOf(monthStart);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const weeks = Math.ceil((Math.round((lastDay.getTime() - gridStart.getTime()) / 86400000) + 1) / 7);
  const todayKey = ymd(now);
  const MAX = 4;
  return (
    <>
      <div className="month" role="grid" aria-label="Month calendar">
        {DOW_SHORT.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
        {Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i)).map((d) => {
          const key = ymd(d);
          const items = [
            ...eventsOn(key).map((e) => {
              const cal = data.calendars.find((c) => c.id === e.calendarId);
              return { key: 'e' + e.id, sort: e.time ?? '00:00', time: e.time ? fmtTime(e.time) : 'All day', title: e.title,
                href: canManageCalendars(viewer) ? '/calendars' : null, style: { background: '#E6E2DA' }, dot: cal?.color ?? '#7A7468',
                tip: `Calendar event: ${e.title}` };
            }),
            ...tasksOn(key).map((t) => {
              const s = taskStatus(t, now);
              const style = s === 'done' ? { background: '#F4F2EE', color: '#6B665C', borderColor: '#E0DBD2', textDecoration: 'line-through' }
                : s === 'overdue' ? { background: '#FBE4D2', color: '#86390A', borderColor: '#E9B48F' }
                : s === 'due-today' ? { background: '#E1E7FA', color: '#243C8F', borderColor: '#9DB0EA' }
                : { background: '#FFFFFF', borderColor: '#CFCAC0' };
              const who = t.assigneeId === viewer.id ? 'You' : data.profiles.find((p) => p.id === t.assigneeId)?.short;
              return { key: 't' + t.id, sort: effectiveTime(t), time: t.dueTime ? fmtTime(t.dueTime) : 'EOD', title: t.title,
                href: `/tasks/${t.id}`, style, dot: null as string | null, tip: `${STATUS_TEXT[s]} ${dueLabel(t)} · ${t.title} · ${who}` };
            }),
          ].sort((a, b) => a.sort.localeCompare(b.sort));
          const inMonth = d.getMonth() === monthStart.getMonth();
          return (
            <div key={key} role="gridcell" className={`cell${inMonth ? '' : ' out'}${key === todayKey ? ' today' : ''}`} aria-label={`${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${items.length} items`}>
              <span className="dnum">{d.getDate()}</span>
              {items.slice(0, MAX).map((it) => {
                const inner = (
                  <>
                    {it.dot && <span className="cal-dot" style={{ background: it.dot, borderRadius: 2 }} />}
                    <span className="t">{it.time}</span>
                    <span>{it.title}</span>
                  </>
                );
                return it.href
                  ? <Link key={it.key} to={it.href} className="item" style={it.style} title={it.tip}>{inner}</Link>
                  : <span key={it.key} className="item" style={it.style} title={it.tip}>{inner}</span>;
              })}
              {items.length > MAX && <button type="button" className="more link-btn" onClick={() => onOpenWeek(d)}>+{items.length - MAX} more</button>}
            </div>
          );
        })}
      </div>
      <div className="legend" aria-label="Legend">
        <span><i style={{ background: '#FBE4D2', borderColor: '#E9B48F' }} />Overdue deadline</span>
        <span><i style={{ background: '#E1E7FA', borderColor: '#9DB0EA' }} />Due today</span>
        <span><i style={{ background: '#FFFFFF' }} />Upcoming deadline</span>
        <span><i style={{ background: '#F4F2EE' }} />Done</span>
        <span><i style={{ background: '#E6E2DA' }} />Calendar event</span>
      </div>
    </>
  );
}

function Sidebar({ data, viewer, activeTags, onToggleTag, onClearTags, onToggleCalendar }: {
  data: AppData; viewer: Profile; activeTags: string[];
  onToggleTag(id: string): void; onClearTags(): void; onToggleCalendar(id: string, on: boolean): void;
}) {
  const manage = canManageCalendars(viewer);
  return (
    <>
      <section aria-labelledby="cal-h">
        <h2 className="eyebrow" id="cal-h">
          Calendars
          {manage && <Link to="/calendars" aria-label="Manage calendar sync" style={{ color: 'var(--muted)' }}><Icon name="sync" size={16} /></Link>}
        </h2>
        {manage ? (
          <>
            {data.accounts.map((a) => (
              <div key={a.id}>
                <p className="side-account">{a.provider === 'google' ? 'Google' : 'Microsoft 365'} · {a.email}</p>
                <ul className="side-list">
                  {data.calendars.filter((c) => c.accountId === a.id).map((c) => (
                    <li key={c.id}>
                      <label>
                        <input type="checkbox" className="check" checked={c.showEvents} onChange={(e) => onToggleCalendar(c.id, e.target.checked)} style={{ accentColor: c.color }} />
                        <span className="cal-dot" style={{ background: c.color }} />{c.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data.accounts.length === 0 && <p className="side-note">No calendars connected yet.</p>}
            <p className="side-note hide-narrow">Team members only see an event once you assign it to them in the week view.</p>
            <Link to="/calendars" className="hide-narrow" style={{ fontSize: 14 }}>Manage calendar sync</Link>
          </>
        ) : (
          <p className="side-note">You only see calendar events a manager has assigned to you.</p>
        )}
      </section>
      <section aria-labelledby="tags-h">
        <h2 className="eyebrow" id="tags-h">
          Tags
          {activeTags.length > 0 && <button type="button" className="link-btn" style={{ fontSize: 12, textTransform: 'none', letterSpacing: 0 }} onClick={onClearTags}>Clear</button>}
        </h2>
        <ul className="side-list">
          {data.tags.map((t) => (
            <li key={t.id}>
              <label>
                <input type="checkbox" className="check" checked={activeTags.includes(t.id)} onChange={() => onToggleTag(t.id)} />
                <span className="tag-pill" style={{ background: t.bg, color: t.fg, padding: '2px 10px' }}>{t.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
