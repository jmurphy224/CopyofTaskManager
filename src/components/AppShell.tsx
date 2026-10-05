import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { canManageCalendars, canManageDisplays, canManagePeople, ROLE_LABEL } from '../lib/permissions';
import { useApp } from '../lib/store';
import type { Role } from '../lib/types';
import { Avatar, Icon, Segmented } from './ui';

interface Props {
  children: ReactNode;
  /** Sidebar content for this page (the week view puts calendars and tags here). */
  sidebar?: ReactNode;
  search?: string;
  onSearch?(q: string): void;
}

const DEMO_ROLE_PEOPLE: Record<Role, string> = { admin: 'joe', manager: 'dana', user: 'priya' };

export function AppShell({ children, sidebar, search, onSearch }: Props) {
  const { viewer, signOut, demo, notice, notify } = useApp();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(null), 6000);
    return () => clearTimeout(t);
  }, [notice, notify]);

  return (
    <>
      {demo && (
        <div className="demo-banner" role="note">
          <strong>Demo mode.</strong>
          <span>Sample data, saved only in this browser. Nothing is shared with anyone.</span>
          <button type="button" className="link-btn" onClick={() => { if (confirm('Reset all demo data to the original sample?')) demo.reset(); }}>
            Reset demo data
          </button>
        </div>
      )}
      <header className="topbar">
        <Link to="/" className="brand"><Icon name="list" size={24} />Runsheet</Link>
        {onSearch && (
          <div className="search">
            <label htmlFor="search" className="sr-only">Search tasks</label>
            <input
              id="search" type="search" placeholder="Search tasks, show numbers, tags"
              value={search ?? ''} onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        <div className="spacer" />
        {demo && (
          <div className="preview-as">
            <span>Preview as</span>
            <Segmented<Role>
              label="Preview as role"
              options={(['admin', 'manager', 'user'] as Role[]).map((r) => ({ id: r, label: ROLE_LABEL[r] }))}
              value={viewer.role}
              onChange={(r) => demo.switchTo(DEMO_ROLE_PEOPLE[r])}
            />
          </div>
        )}
        <div className="me">
          <Avatar person={viewer} size={36} />
          <div className="who">
            <strong>{viewer.name}</strong>
            <span>{ROLE_LABEL[viewer.role]}</span>
            <button type="button" onClick={() => void signOut()}>{demo ? 'Switch person' : 'Sign out'}</button>
          </div>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar" aria-label="Sidebar">
          <Link to="/tasks/new" className="btn btn-primary btn-block"><Icon name="plus" />New task</Link>
          {sidebar}
          <nav aria-label="Pages">
            <h2 className="eyebrow">Go to</h2>
            <ul className="side-list">
              <li><NavLink to="/">Week view</NavLink></li>
              {canManageCalendars(viewer) && <li><NavLink to="/calendars">Calendar sync</NavLink></li>}
              {canManagePeople(viewer) && <li><NavLink to="/admin/people">Roles &amp; permissions</NavLink></li>}
              {canManageDisplays(viewer) && <li><NavLink to="/admin/tvs">Shop TVs</NavLink></li>}
              {canManagePeople(viewer) && <li><NavLink to="/admin/shows">Airtable show numbers</NavLink></li>}
              <li><NavLink to="/tv">Open TV screen</NavLink></li>
            </ul>
          </nav>
        </aside>
        <main className="main" id="main">{children}</main>
      </div>
      {notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => notify(null)}>Dismiss</button>
        </div>
      )}
    </>
  );
}
