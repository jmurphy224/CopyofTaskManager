import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Avatar, Icon } from '../components/ui';
import { ALLOWED_EMAIL_DOMAINS, isAllowedEmail } from '../lib/config';
import { canManagePeople, PERMISSION_MATRIX, ROLE_LABEL } from '../lib/permissions';
import { useApp } from '../lib/store';
import type { Profile, Role } from '../lib/types';
import { NoAccess } from './NoAccess';

const ROLES: Role[] = ['admin', 'manager', 'user'];

function cellClass(v: string) {
  if (v === 'Yes' || v === 'Any task') return 'yes';
  if (v === 'No') return 'no';
  return 'partial';
}

export function PeoplePage() {
  const { viewer, data, actions, mode } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [newTag, setNewTag] = useState('');
  if (!canManagePeople(viewer)) return <NoAccess what="Roles & permissions" who="admins" />;

  const groupName = (id: string) => data.groups.find((g) => g.id === id)?.name ?? '?';

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <Link to="/" className="back-link"><Icon name="back" size={16} />Back to week view</Link>
            <h1 className="page-title">Roles &amp; permissions</h1>
            <p className="lede">Only admins can see this page. Three roles plus view-only shop TVs, and one rule for closing tasks: the assignee, or any manager or admin.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setInviteOpen((v) => !v)} aria-expanded={inviteOpen}>
            <Icon name="plus" />Invite person
          </button>
        </div>

        {inviteOpen && <InviteForm onDone={() => setInviteOpen(false)} mode={mode} />}

        <div className="two-panel">
          <section className="card" style={{ padding: '8px 24px 16px' }}>
            <div className="table-wrap">
              <table className="table">
                <caption>What each role can do</caption>
                <thead>
                  <tr><th scope="col">Permission</th><th scope="col">Admin</th><th scope="col">Manager</th><th scope="col">User</th><th scope="col">Shop TV</th></tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {[r.admin, r.manager, r.user, r.tv].map((v, i) => <td key={i} className={cellClass(v)}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ padding: '8px 24px 16px' }}>
            <table className="table">
              <caption>People</caption>
              <thead><tr><th scope="col">Name</th><th scope="col" style={{ width: 132 }}>Role</th></tr></thead>
              <tbody>
                {data.profiles.map((p) => (
                  <PersonRow key={p.id} person={p} isMe={p.id === viewer.id} groupName={groupName}
                    editing={editing === p.id} onEdit={() => setEditing(editing === p.id ? null : p.id)} />
                ))}
              </tbody>
            </table>
            {data.invites.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>Invited, not signed in yet</h3>
                <ul className="side-list">
                  {data.invites.map((i) => (
                    <li key={i.email} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, fontSize: 14 }}>
                      <span style={{ flexGrow: 1 }}>{i.name} · {i.email} · {ROLE_LABEL[i.role]}</span>
                      <button type="button" className="btn btn-sm" onClick={() => void actions.deleteInvite(i.email).catch(() => undefined)}>Cancel invite</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <section className="card card-pad grid-2">
          <div>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Groups</h2>
            <p className="small">Teams of people. Sharing a task with a group lets everyone in it see the task. Each shop TV shows one group.</p>
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.groups.map((g) => <span key={g.id} className="chip" style={{ background: 'var(--chip)', fontSize: 13 }}>{g.name} · {data.profiles.filter((p) => p.groupIds.includes(g.id)).length}</span>)}
            </p>
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (newGroup.trim()) void actions.createGroup(newGroup).then(() => setNewGroup('')).catch(() => undefined); }}>
              <div className="field"><label htmlFor="new-group">New group</label><input id="new-group" className="input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="e.g. Electricians" /></div>
              <button type="submit" className="btn">Add group</button>
            </form>
          </div>
          <div>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tags</h2>
            <p className="small">Labels for filtering the week view. A task can have several.</p>
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.tags.map((t) => <span key={t.id} className="chip" style={{ background: t.bg, color: t.fg, fontSize: 13 }}>{t.name}</span>)}
            </p>
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (newTag.trim()) void actions.createTag(newTag).then(() => setNewTag('')).catch(() => undefined); }}>
              <div className="field"><label htmlFor="new-tag">New tag</label><input id="new-tag" className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="e.g. Safety" /></div>
              <button type="submit" className="btn">Add tag</button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PersonRow({ person, isMe, groupName, editing, onEdit }: {
  person: Profile; isMe: boolean; groupName(id: string): string; editing: boolean; onEdit(): void;
}) {
  const { data, actions } = useApp();
  return (
    <>
      <tr style={{ opacity: person.active ? 1 : 0.55 }}>
        <td>
          <div className="person">
            <Avatar person={person} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>{person.name}{isMe ? ' (you)' : ''}{person.active ? '' : ' · switched off'}</span>
              <span className="sub">{person.groupIds.map(groupName).join(', ') || 'No groups'}</span>
              <button type="button" className="link-btn" style={{ fontSize: 12, alignSelf: 'flex-start' }} onClick={onEdit} aria-expanded={editing}>
                {editing ? 'Close' : 'Groups and access'}
              </button>
            </div>
          </div>
        </td>
        <td>
          <select aria-label={`Role for ${person.name}`} className="select" style={{ minHeight: 40, width: 120 }} value={person.role}
            disabled={isMe} title={isMe ? "You can't change your own role" : undefined}
            onChange={(e) => void actions.updateProfile(person.id, { role: e.target.value as Role }).catch(() => undefined)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={2} style={{ background: 'var(--surface-muted)', padding: 12 }}>
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Groups for {person.short}</legend>
              <div className="tag-picker">
                {data.groups.map((g) => {
                  const on = person.groupIds.includes(g.id);
                  return (
                    <label key={g.id} style={{ borderColor: 'var(--line-strong)', background: on ? 'var(--accent-soft)' : 'var(--surface)' }}>
                      <input type="checkbox" checked={on} onChange={() => void actions.updateProfile(person.id, {
                        groupIds: on ? person.groupIds.filter((x) => x !== g.id) : [...person.groupIds, g.id],
                      }).catch(() => undefined)} />
                      {g.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {!isMe && (
              <button type="button" className="btn btn-sm" style={{ marginTop: 10 }}
                onClick={() => void actions.updateProfile(person.id, { active: !person.active }).catch(() => undefined)}>
                {person.active ? 'Switch off access' : 'Turn access back on'}
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function InviteForm({ onDone, mode }: { onDone(): void; mode: 'demo' | 'live' }) {
  const { data, actions } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Enter their name.'); return; }
    if (mode === 'live' && !isAllowedEmail(email)) { setError(`Only ${ALLOWED_EMAIL_DOMAINS.map((d) => '@' + d).join(' or ')} email addresses can be invited.`); return; }
    if (mode === 'demo' && !email.includes('@')) { setError('Enter an email address.'); return; }
    try { await actions.createInvite({ email, name, role, groupIds }); onDone(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <form className="card card-pad" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18 }}>Invite a person</h2>
      <p className="small">
        {mode === 'live'
          ? 'They sign in with their Fogarty account. When they do, they get this role and these groups automatically.'
          : 'Demo mode: the person is added straight away so you can preview as them.'}
      </p>
      <div className="two-col">
        <div className="field"><label htmlFor="inv-name">Name</label><input id="inv-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="inv-email">Fogarty email</label><input id="inv-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${ALLOWED_EMAIL_DOMAINS[0] ?? 'fogarty.com'}`} /></div>
        <div className="field">
          <label htmlFor="inv-role">Role</label>
          <select id="inv-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Groups</legend>
        <div className="tag-picker">
          {data.groups.map((g) => (
            <label key={g.id} style={{ borderColor: 'var(--line-strong)', background: groupIds.includes(g.id) ? 'var(--accent-soft)' : 'var(--surface)' }}>
              <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => setGroupIds((ids) => (ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id]))} />
              {g.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--overdue)', fontWeight: 600 }}>{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary">Send invite</button>
      </div>
    </form>
  );
}
