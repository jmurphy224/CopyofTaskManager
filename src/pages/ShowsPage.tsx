import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Icon } from '../components/ui';
import { canManageAirtable } from '../lib/permissions';
import { useApp } from '../lib/store';
import { NoAccess } from './NoAccess';

export function ShowsPage() {
  const { viewer, data, actions, notify } = useApp();
  const [busy, setBusy] = useState(false);
  if (!canManageAirtable(viewer)) return <NoAccess what="Airtable show numbers" who="admins" />;

  async function sync() {
    setBusy(true);
    try {
      const message = await actions.syncShows();
      notify({ kind: 'info', text: message });
    } catch { /* notice shown */ } finally { setBusy(false); }
  }

  const taskCount = (n: string) => data.tasks.filter((t) => t.showNumber === n).length;

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <Link to="/" className="back-link"><Icon name="back" size={16} />Back to week view</Link>
            <h1 className="page-title">Airtable show numbers</h1>
            <p className="lede">
              Show numbers come from our Airtable base, so tasks always point at a real show. The list refreshes on a schedule;
              use “Sync now” after adding a show in Airtable.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void sync()} disabled={busy}>
            <Icon name="sync" />{busy ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        <section className="card" style={{ padding: '8px 24px 16px' }}>
          <div className="table-wrap">
            <table className="table">
              <caption>{data.shows.length} shows</caption>
              <thead><tr><th>Show number</th><th>Name</th><th>Starts</th><th>Venue</th><th>Tasks</th></tr></thead>
              <tbody>
                {data.shows.map((s) => (
                  <tr key={s.number}>
                    <th scope="row" style={{ fontFamily: 'var(--font-mono)' }}>{s.number}</th>
                    <td>{s.name}</td>
                    <td>{s.startDate ?? '—'}</td>
                    <td>{s.venue ?? '—'}</td>
                    <td>{taskCount(s.number)}</td>
                  </tr>
                ))}
                {data.shows.length === 0 && <tr><td colSpan={5} className="muted">No shows yet. Run a sync once Airtable is connected.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Connection settings</h2>
          <p className="small" style={{ color: 'var(--ink-2)' }}>
            The Airtable key is stored as a secret on the server (Supabase Edge Function secrets), never in the browser.
            Settings: <code>AIRTABLE_TOKEN</code>, <code>AIRTABLE_BASE_ID</code>, <code>AIRTABLE_TABLE</code>, and the field names for the
            show number, name, start date and venue. See <code>docs/SETUP.md</code> in the repo.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
