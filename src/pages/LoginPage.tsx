import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon } from '../components/ui';
import { ALLOWED_EMAIL_DOMAINS, AUTH_PROVIDERS, isAllowedEmail } from '../lib/config';
import { demoGroupName } from '../lib/demoBackend';
import { supabase } from '../lib/liveBackend';
import { ROLE_LABEL } from '../lib/permissions';
import { useStore } from '../lib/store';

const domainsText = () => ALLOWED_EMAIL_DOMAINS.map((d) => '@' + d).join(' or ');

export function LoginPage() {
  const { demo, status, sessionEmail, signOut, groupsFor } = useLoginContext();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (demo) {
    const featured = ['joe', 'dana', 'priya', 'tom'];
    const people = [...demo.people].sort((a, b) => (featured.indexOf(a.id) + 1 || 99) - (featured.indexOf(b.id) + 1 || 99));
    return (
      <div className="login">
        <div className="card">
          <div>
            <span className="eyebrow">Demo mode</span>
            <h1>Runsheet</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Pick someone to sign in as. Each role sees and can do different things. The data is sample data saved only in this browser.
            </p>
          </div>
          <div className="demo-people">
            {people.map((p) => (
              <button key={p.id} type="button" onClick={() => demo.switchTo(p.id)}>
                <Avatar person={p} size={36} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{p.name}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{groupsFor(p.groupIds)}</span>
                </span>
                <span className="role">{ROLE_LABEL[p.role]}</span>
              </button>
            ))}
          </div>
          <Link to="/tv" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="tv" />Open the shop TV screen</Link>
        </div>
      </div>
    );
  }

  if (status === 'no-profile') {
    return (
      <div className="login">
        <div className="card">
          <h1>No access</h1>
          <p className="muted">
            {sessionEmail ?? 'This account'} is signed in, but doesn&apos;t have access to Runsheet. Access may have been switched off.
            Ask an admin.
          </p>
          <button type="button" className="btn" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  async function oauth(provider: 'google' | 'azure') {
    setError(null);
    const { error: err } = await supabase().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: provider === 'azure' ? 'email' : undefined,
        queryParams: provider === 'google' && ALLOWED_EMAIL_DOMAINS.length === 1 ? { hd: ALLOWED_EMAIL_DOMAINS[0] } : undefined,
      },
    });
    if (err) setError(err.message);
  }

  async function magicLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isAllowedEmail(email)) { setError(`Only Fogarty email addresses (${domainsText()}) can sign in.`); return; }
    const { error: err } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (err) setError(err.message.includes('Database error') ? 'Only Fogarty email addresses can sign in to Runsheet.' : err.message);
    else setSent(true);
  }

  return (
    <div className="login">
      <div className="card">
        <div>
          <h1>Runsheet</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Sign in with your Fogarty work account. Only {domainsText()} addresses can sign in.</p>
        </div>
        {AUTH_PROVIDERS.includes('google') && <button type="button" className="btn btn-block" onClick={() => void oauth('google')}>Sign in with Google</button>}
        {AUTH_PROVIDERS.includes('azure') && <button type="button" className="btn btn-block" onClick={() => void oauth('azure')}>Sign in with Microsoft</button>}
        {AUTH_PROVIDERS.includes('email') && (
          <>
            {(AUTH_PROVIDERS.includes('google') || AUTH_PROVIDERS.includes('azure')) && <div className="divider">or get a sign-in link by email</div>}
            {sent ? (
              <p role="status">Check {email} for a sign-in link.</p>
            ) : (
              <form onSubmit={magicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label htmlFor="email">Work email</label>
                  <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={`name@${ALLOWED_EMAIL_DOMAINS[0] ?? 'fogarty.com'}`} />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Email me a sign-in link</button>
              </form>
            )}
          </>
        )}
        {error && <p role="alert" style={{ margin: 0, color: 'var(--overdue)', fontWeight: 600 }}>{error}</p>}
        <Link to="/tv" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}><Icon name="tv" size={16} />This is a shop TV</Link>
      </div>
    </div>
  );
}

function useLoginContext() {
  const s = useStore();
  const groupsFor = (ids: string[]) => ids.map(demoGroupName).join(', ') || 'No groups';
  return { ...s, groupsFor };
}
