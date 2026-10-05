import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Icon } from '../components/ui';
import { canManageCalendars } from '../lib/permissions';
import { useApp } from '../lib/store';
import { NoAccess } from './NoAccess';

export function CalendarsPage() {
  const { viewer, data, actions, mode, notify } = useApp();
  if (!canManageCalendars(viewer)) return <NoAccess what="Calendar sync" who="managers and admins" />;

  const connect = (provider: string) => notify({
    kind: 'info',
    text: mode === 'demo'
      ? `Demo mode: connecting a real ${provider} account isn't available. The sample calendars show how it will look.`
      : `Connecting ${provider} calendars needs the calendar sync service, which is the next build phase (see the roadmap in docs/APP_GUIDE.md).`,
  });

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <Link to="/" className="back-link"><Icon name="back" size={16} />Back to week view</Link>
            <h1 className="page-title">Calendar sync</h1>
            <p className="lede">Managers and admins only. Connect team members&apos; Google or Microsoft calendars and pick which ones show up next to tasks.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => connect('Google')}><Icon name="plus" />Connect Google account</button>
            <button type="button" className="btn btn-outline" onClick={() => connect('Microsoft')}><Icon name="plus" />Connect Microsoft account</button>
          </div>
        </div>

        {data.accounts.length === 0 && (
          <div className="card card-pad empty">No calendar accounts connected yet.</div>
        )}

        <div className="grid-2">
          {data.accounts.map((a) => (
            <section key={a.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10,
                  background: a.provider === 'google' ? '#E1E7FA' : '#ECE3F8', color: a.provider === 'google' ? '#243C8F' : '#523887' }}>
                  <Icon name="calendar" size={20} />
                </span>
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="eyebrow">{a.provider === 'google' ? 'Google' : 'Microsoft 365 (Outlook)'}</span>
                  <span style={{ fontWeight: 600 }}>{a.email}</span>
                  <span style={{ fontSize: 13, color: 'var(--ok)' }}>Connected · last sync {a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : 'not yet'}</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Calendar</th><th style={{ width: 110 }}>Show events</th><th style={{ width: 130 }}>Send deadlines</th></tr>
                  </thead>
                  <tbody>
                    {data.calendars.filter((c) => c.accountId === a.id).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span className="cal-dot" style={{ width: 12, height: 12, background: c.color }} />{c.name}
                            {c.shared && <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>shared</span>}
                          </span>
                        </td>
                        <td>
                          <input type="checkbox" className="check" checked={c.showEvents} aria-label={`Show ${c.name} events`}
                            onChange={(e) => void actions.updateCalendar(c.id, { showEvents: e.target.checked }).catch(() => undefined)} />
                        </td>
                        <td>
                          <input type="radio" name="deadlines" className="check" checked={c.sendDeadlines} aria-label={`Send deadlines to ${c.name}`}
                            onChange={() => void actions.updateCalendar(c.id, { sendDeadlines: true }).catch(() => undefined)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <section className="card card-pad grid-3">
          <div>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>How sync works</h2>
            <p className="small" style={{ color: 'var(--ink-2)' }}>Events show read-only in the week view, next to that day&apos;s tasks. If you choose a calendar under “Send deadlines”, each task with “Add deadline to a synced calendar” turned on also lands there as an event.</p>
          </div>
          <div>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>Who connects what</h2>
            <p className="small" style={{ color: 'var(--ink-2)' }}>Only managers and admins connect and sync calendars. Regular users can&apos;t connect or change anything, and they only see an event after a manager or admin assigns it to them in the week view. Events can also be put on a shop TV.</p>
          </div>
          <div>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>Status</h2>
            <p className="small" style={{ color: 'var(--ink-2)' }}>
              The calendar settings, event sharing and the week view are working. Pulling events from Google and Microsoft and
              pushing deadlines out is the next build phase (Google/Microsoft sign-in and a scheduled sync).
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
