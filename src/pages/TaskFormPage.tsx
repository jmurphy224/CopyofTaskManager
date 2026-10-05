import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Icon } from '../components/ui';
import { mondayOf, parseYmd, taskStatus, ymd } from '../lib/dates';
import {
  canAssignOthers, canCompleteTask, canDeleteTask, canEditTask, completeLockReason, isManagerOrAdmin,
} from '../lib/permissions';
import { useApp } from '../lib/store';
import type { Recurrence, TaskInput } from '../lib/types';

const RECURRENCE: { id: Recurrence; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { id: 'weekly', label: 'Every week' },
];

export function TaskFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { viewer, data, actions } = useApp();
  const existing = id ? data.tasks.find((t) => t.id === id) : undefined;
  const elevated = isManagerOrAdmin(viewer);

  const [form, setForm] = useState<TaskInput>(() => existing ? {
    title: existing.title, notes: existing.notes, assigneeId: existing.assigneeId, groupId: existing.groupId,
    tagIds: existing.tagIds, showNumber: existing.showNumber, dueDate: existing.dueDate, dueTime: existing.dueTime,
    pushToCalendar: existing.pushToCalendar, recurrence: existing.recurrence,
  } : {
    title: '', notes: '', assigneeId: viewer.id, groupId: null, tagIds: [], showNumber: null,
    dueDate: params.get('date') ?? ymd(new Date()), dueTime: null, pushToCalendar: false, recurrence: 'none',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = !!existing && !canEditTask(viewer, existing);
  const assignee = data.profiles.find((p) => p.id === form.assigneeId);
  const group = form.groupId ? data.groups.find((g) => g.id === form.groupId) : null;
  const deadlineCal = data.calendars.find((c) => c.sendDeadlines);
  const showNumber = form.showNumber?.trim() ?? '';
  const show = showNumber ? data.shows.find((s) => s.number === showNumber) : undefined;
  const groupOptions = useMemo(
    () => (elevated ? data.groups : data.groups.filter((g) => viewer.groupIds.includes(g.id) || g.id === form.groupId)),
    [elevated, data.groups, viewer.groupIds, form.groupId],
  );

  if (id && !existing) {
    return (
      <AppShell>
        <div className="page">
          <Link to="/" className="back-link"><Icon name="back" size={16} />Back to week view</Link>
          <div className="card card-pad">
            <h1 className="page-title" style={{ fontSize: 26 }}>Task not found</h1>
            <p className="muted">It may have been deleted, or it isn&apos;t shared with you.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const up = (patch: Partial<TaskInput>) => setForm((f) => ({ ...f, ...patch }));
  const backTo = `/?week=${ymd(mondayOf(parseYmd(form.dueDate)))}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    if (!form.title.trim()) { setError('Give the task a title.'); return; }
    if (!form.dueDate) { setError('Pick a deadline date.'); return; }
    setSaving(true);
    try {
      await actions.saveTask({ ...form, showNumber: form.showNumber?.trim() || null }, existing?.id);
      navigate(backTo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || !confirm(`Delete “${existing.title}”? This can't be undone.`)) return;
    try { await actions.deleteTask(existing.id); navigate(backTo); } catch { /* notice shown */ }
  }

  const status = existing ? taskStatus(existing, new Date()) : null;
  const doneBy = existing?.doneBy ? data.profiles.find((p) => p.id === existing.doneBy) : null;

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1040 }}>
        <div>
          <Link to={backTo} className="back-link"><Icon name="back" size={16} />Back to week view</Link>
          <h1 className="page-title">{existing ? (readOnly ? 'Task' : 'Edit task') : 'New task'}</h1>
        </div>

        <div className="form-grid">
          <form className="card form-card" onSubmit={submit} noValidate>
            <fieldset disabled={readOnly || saving} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <div className="field">
                <label htmlFor="f-title">Title</label>
                <input id="f-title" className="input" value={form.title} onChange={(e) => up({ title: e.target.value })}
                  placeholder="e.g. Confirm truck and driver for load-in" required autoFocus={!existing} />
              </div>
              <div className="field">
                <label htmlFor="f-notes">Notes <span className="opt">(optional)</span></label>
                <textarea id="f-notes" className="textarea" rows={3} value={form.notes} onChange={(e) => up({ notes: e.target.value })}
                  placeholder="Details, links, who to call" />
              </div>

              <div className="two-col">
                <div className="field">
                  <label htmlFor="f-assignee">Assigned to</label>
                  <select id="f-assignee" className="select" value={form.assigneeId} onChange={(e) => up({ assigneeId: e.target.value })}
                    disabled={!canAssignOthers(viewer)}>
                    {(canAssignOthers(viewer) ? data.profiles.filter((p) => p.active || p.id === form.assigneeId) : [viewer]).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.id === viewer.id ? ' (you)' : ''}</option>
                    ))}
                  </select>
                  <span className="hint">
                    {canAssignOthers(viewer)
                      ? `${assignee?.name ?? 'The assignee'}, or any manager or admin, can mark this complete.`
                      : 'As a user you can create tasks for yourself. Ask a manager to assign work to others.'}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="f-group">Share with group <span className="opt">(optional)</span></label>
                  <select id="f-group" className="select" value={form.groupId ?? ''} onChange={(e) => up({ groupId: e.target.value || null })}>
                    <option value="">No group</option>
                    {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <span className="hint">
                    {group ? `Everyone in ${group.name} can see it${data.displays.some((d) => d.groupId === group.id) ? ', and it shows on the ' + data.displays.filter((d) => d.groupId === group.id).map((d) => d.name).join(' and ') : ''}.`
                      : 'Only the assignee, managers and admins can see it.'}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="f-date">Deadline date</label>
                  <input id="f-date" type="date" className="input" value={form.dueDate} onChange={(e) => up({ dueDate: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="f-time">Deadline time <span className="opt">(optional)</span></label>
                  <input id="f-time" type="time" className="input" value={form.dueTime ?? ''} onChange={(e) => up({ dueTime: e.target.value || null })} />
                  <span className="hint">Blank means due by end of business day (4:00 PM). Set a time to override.</span>
                </div>
              </div>

              <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
                <legend className="label" style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, padding: 0 }}>Tags</legend>
                <div className="tag-picker">
                  {data.tags.map((t) => {
                    const on = form.tagIds.includes(t.id);
                    return (
                      <label key={t.id} style={{ background: on ? t.bg : 'var(--surface)', color: on ? t.fg : 'var(--ink-2)', borderColor: on ? t.bg : 'var(--line-strong)' }}>
                        <input type="checkbox" checked={on}
                          onChange={() => up({ tagIds: on ? form.tagIds.filter((x) => x !== t.id) : [...form.tagIds, t.id] })} />
                        {t.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="two-col">
                <div className="field">
                  <label htmlFor="f-show">Show number <span className="opt">(optional)</span></label>
                  <input id="f-show" className="input mono" list="show-list" value={form.showNumber ?? ''} inputMode="numeric"
                    onChange={(e) => up({ showNumber: e.target.value || null })} placeholder="e.g. 2417" />
                  <datalist id="show-list">
                    {data.shows.map((s) => <option key={s.number} value={s.number}>{s.name}</option>)}
                  </datalist>
                  <span className="hint">
                    {show ? `${show.name}${show.startDate ? ' · starts ' + show.startDate : ''}`
                      : form.showNumber ? 'Not in the Airtable show list. Check the number.'
                      : data.shows.length ? 'Start typing to search the show numbers from Airtable. Leave blank for shop tasks.'
                      : 'Type the show number. Leave blank for shop and cleaning tasks.'}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="f-repeat">Repeats</label>
                  <select id="f-repeat" className="select" value={form.recurrence} onChange={(e) => up({ recurrence: e.target.value as Recurrence })}>
                    {RECURRENCE.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <span className="hint">For cleaning and routine shop jobs. Checking it off creates the next one.</span>
                </div>
              </div>

              <label className="toggle-row" htmlFor="f-cal">
                <input id="f-cal" type="checkbox" className="check" checked={form.pushToCalendar}
                  onChange={(e) => up({ pushToCalendar: e.target.checked })} disabled={!deadlineCal} />
                <span style={{ flexGrow: 1 }}>Add deadline to a synced calendar</span>
                {deadlineCal
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="cal-dot" style={{ background: deadlineCal.color }} />{deadlineCal.name}</span>
                  : <span className="muted">No calendar chosen yet</span>}
              </label>
            </fieldset>

            {error && <p role="alert" style={{ margin: 0, color: 'var(--overdue)', fontWeight: 600 }}>{error}</p>}

            <div className="form-actions">
              {existing && canDeleteTask(viewer, existing) && (
                <button type="button" className="btn btn-danger left" onClick={() => void remove()}>Delete task</button>
              )}
              <Link to={backTo} className="btn">{readOnly ? 'Back' : 'Cancel'}</Link>
              {!readOnly && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : existing ? 'Save task' : 'Create task'}</button>}
            </div>
          </form>

          <div className="aside">
            {existing && (
              <section className="card">
                <h2>Status</h2>
                <label htmlFor="f-done" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, fontSize: 14, cursor: 'pointer' }}>
                  <input id="f-done" type="checkbox" className="check" style={{ width: 22, height: 22 }} checked={existing.done}
                    disabled={!canCompleteTask(viewer, existing)}
                    onChange={(e) => void actions.setTaskDone(existing.id, e.target.checked).catch(() => undefined)} />
                  Mark complete
                </label>
                <p className="small">
                  {existing.done
                    ? `Done${doneBy ? ' by ' + doneBy.name : ''}${existing.doneAt ? ' on ' + new Date(existing.doneAt).toLocaleString() : ''}.`
                    : status === 'overdue' ? 'This task is overdue.' : status === 'due-today' ? 'Due today.' : 'Not done yet.'}
                  {' '}
                  {!canCompleteTask(viewer, existing) ? completeLockReason(assignee) + '.'
                    : existing.assigneeId !== viewer.id ? `You're ${viewer.role === 'admin' ? 'an admin' : 'a manager'}, so you can check this off for ${assignee?.name ?? 'them'}.` : ''}
                </p>
              </section>
            )}
            {readOnly && (
              <section className="card">
                <h2>View only</h2>
                <p className="small">You can see this task because it&apos;s assigned to you or shared with your group. Only its creator, a manager of the group, or an admin can change it.</p>
              </section>
            )}
            <section className="card">
              <h2>Who can do what</h2>
              <ul>
                <li><strong>Assignee</strong>: marks it complete</li>
                <li><strong>Managers and admins</strong>: create, assign, reassign, edit deadlines, mark any task complete</li>
                <li><strong>Group members</strong>: can see it</li>
              </ul>
              {viewer.role === 'admin' && <Link to="/admin/people" style={{ fontSize: 13, fontWeight: 500 }}>See all permissions</Link>}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
