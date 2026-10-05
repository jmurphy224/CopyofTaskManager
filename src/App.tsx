import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './lib/store';
import { CalendarsPage } from './pages/CalendarsPage';
import { DisplaysPage } from './pages/DisplaysPage';
import { LoginPage } from './pages/LoginPage';
import { PeoplePage } from './pages/PeoplePage';
import { ShowsPage } from './pages/ShowsPage';
import { TaskFormPage } from './pages/TaskFormPage';
import { TvPage, TvPairPage } from './pages/TvPage';
import { WeekPage } from './pages/WeekPage';

function SignedIn({ children }: { children: JSX.Element }) {
  const { status, error } = useStore();
  if (status === 'loading') return <div className="login" aria-busy="true"><p className="muted">Loading Runsheet…</p></div>;
  if (status === 'error') {
    return (
      <div className="login">
        <div className="card">
          <h1>Something went wrong</h1>
          <p className="muted">{error}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (status !== 'ready') return <LoginPage />;
  return children;
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Shop TVs work without anyone signed in. */}
        <Route path="/tv" element={<TvPage />} />
        <Route path="/tv/pair" element={<TvPairPage />} />
        <Route path="/" element={<SignedIn><WeekPage /></SignedIn>} />
        <Route path="/tasks/new" element={<SignedIn><TaskFormPage /></SignedIn>} />
        <Route path="/tasks/:id" element={<SignedIn><TaskFormPage key="edit" /></SignedIn>} />
        <Route path="/calendars" element={<SignedIn><CalendarsPage /></SignedIn>} />
        <Route path="/admin/people" element={<SignedIn><PeoplePage /></SignedIn>} />
        <Route path="/admin/tvs" element={<SignedIn><DisplaysPage /></SignedIn>} />
        <Route path="/admin/shows" element={<SignedIn><ShowsPage /></SignedIn>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
