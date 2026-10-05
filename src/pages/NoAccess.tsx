import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';

export function NoAccess({ what, who }: { what: string; who: string }) {
  return (
    <AppShell>
      <div className="page">
        <div className="card card-pad">
          <h1 className="page-title" style={{ fontSize: 26 }}>{what}</h1>
          <p className="muted">Only {who} can open this page.</p>
          <Link to="/">Back to week view</Link>
        </div>
      </div>
    </AppShell>
  );
}
