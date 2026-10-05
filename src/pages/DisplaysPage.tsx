import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Icon } from '../components/ui';
import { canManageDisplays } from '../lib/permissions';
import { useApp } from '../lib/store';
import { NoAccess } from './NoAccess';

export function DisplaysPage() {
  const { viewer, data, actions, mode } = useApp();
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? '');
  if (!canManageDisplays(viewer)) return <NoAccess what="Shop TVs" who="admins" />;

  const pairUrl = `${window.location.origin}${window.location.pathname}#/tv/pair`;

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <Link to="/" className="back-link"><Icon name="back" size={16} />Back to week view</Link>
            <h1 className="page-title">Shop TVs</h1>
            <p className="lede">
              View-only screens for the shop floor. Each TV shows one group&apos;s tasks for today and the rest of the week,
              plus calendar events you put on it. TVs don&apos;t need an email or password: you link each one once with a pairing code.
            </p>
          </div>
        </div>

        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 16 }}>Set up a TV</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--ink-2)' }}>
            <li>Add the TV below and pick the group it shows.</li>
            <li>On the TV&apos;s web browser, open <code>{pairUrl}</code></li>
            <li>Type the six-character code shown here. The TV stays linked and refreshes on its own.</li>
            <li>To unlink a TV, give it a new code or switch it off.</li>
          </ol>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (name.trim() && groupId) void actions.createDisplay(name, groupId).then(() => setName('')).catch(() => undefined); }}>
            <div className="field"><label htmlFor="tv-name">TV name</label><input id="tv-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paint shop TV" /></div>
            <div className="field">
              <label htmlFor="tv-group">Shows group</label>
              <select id="tv-group" className="select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary"><Icon name="plus" />Add TV</button>
          </form>
        </section>

        <section className="card" style={{ padding: '8px 24px 16px' }}>
          <div className="table-wrap">
            <table className="table">
              <caption>Your TVs</caption>
              <thead><tr><th>TV</th><th>Group</th><th>Status</th><th>Pairing code</th><th>Last seen</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.displays.map((d) => (
                  <tr key={d.id}>
                    <th scope="row"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="tv" size={18} />{d.name}</span></th>
                    <td>{data.groups.find((g) => g.id === d.groupId)?.name ?? '?'}</td>
                    <td>
                      <span className="status-dot" style={{ color: !d.active ? 'var(--muted-2)' : d.paired ? 'var(--ok)' : 'var(--partial)' }}>
                        {!d.active ? 'Switched off' : d.paired ? 'Linked' : 'Waiting for pairing'}
                      </span>
                    </td>
                    <td>{d.pairingCode ? <span className="code">{d.pairingCode}</span> : <span className="muted">—</span>}</td>
                    <td className="muted">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}</td>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {mode === 'demo' && <Link className="btn btn-sm" to={`/tv?display=${d.id}`}>Preview</Link>}
                      <button type="button" className="btn btn-sm" onClick={() => void actions.newPairingCode(d.id).catch(() => undefined)}>New code</button>
                      <button type="button" className="btn btn-sm" onClick={() => void actions.setDisplayActive(d.id, !d.active).catch(() => undefined)}>{d.active ? 'Switch off' : 'Switch on'}</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => { if (confirm(`Remove ${d.name}?`)) void actions.deleteDisplay(d.id).catch(() => undefined); }}>Remove</button>
                    </td>
                  </tr>
                ))}
                {data.displays.length === 0 && <tr><td colSpan={6} className="muted">No TVs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
