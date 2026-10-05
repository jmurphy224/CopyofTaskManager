import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Backend } from './backend';
import { IS_DEMO } from './config';
import { createDemoBackend, demoProfiles, demoViewer, resetDemo } from './demoBackend';
import { createLiveBackend, supabase } from './liveBackend';
import type { AppData, Profile } from './types';

type Status = 'loading' | 'signed-out' | 'no-profile' | 'ready' | 'error';

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

type Bound<F> = F extends (viewer: Profile, ...args: infer A) => Promise<infer R> ? (...args: A) => Promise<R> : never;
export type Actions = { [K in Exclude<keyof Backend, 'load' | 'subscribe'>]: Bound<Backend[K]> };

interface StoreValue {
  mode: 'demo' | 'live';
  status: Status;
  error: string | null;
  viewer: Profile | null;
  data: AppData | null;
  actions: Actions;
  notice: Notice | null;
  notify(n: Notice | null): void;
  signOut(): Promise<void>;
  /** Email of a live session that has no active profile (e.g. switched off). */
  sessionEmail: string | null;
  demo: { people: Profile[]; switchTo(id: string): void; reset(): void } | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [demoViewerId, setDemoViewerId] = useState<string | null>(() => (IS_DEMO ? demoViewer.get() : null));
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(IS_DEMO);
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const viewerIdRef = useRef(demoViewerId);
  viewerIdRef.current = IS_DEMO ? demoViewerId : sessionUserId;

  const backend = useMemo<Backend>(
    () => (IS_DEMO ? createDemoBackend(() => viewerIdRef.current) : createLiveBackend()),
    [],
  );

  // Live mode: follow the Supabase session.
  useEffect(() => {
    if (IS_DEMO) return;
    const auth = supabase().auth;
    void auth.getSession().then(({ data: { session } }) => {
      setSessionUserId(session?.user.id ?? null);
      setSessionEmail(session?.user.email ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
      setSessionEmail(session?.user.email ?? null);
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const viewerId = IS_DEMO ? demoViewerId : sessionUserId;

  const reload = useCallback(async () => {
    if (!viewerIdRef.current) return;
    try {
      const next = await backend.load();
      setData(next);
      setError(null);
      const me = next.profiles.find((p) => p.id === viewerIdRef.current);
      setStatus(me && me.active ? 'ready' : 'no-profile');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, [backend]);

  useEffect(() => {
    if (!authChecked) return;
    if (!viewerId) { setStatus('signed-out'); setData(null); return; }
    setStatus('loading');
    void reload();
    return backend.subscribe(() => { void reload(); });
  }, [authChecked, viewerId, backend, reload]);

  const viewer = data?.profiles.find((p) => p.id === viewerId) ?? null;
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;

  const actions = useMemo(() => {
    const out: Record<string, unknown> = {};
    const names = Object.keys(backend).filter((k) => k !== 'load' && k !== 'subscribe') as (keyof Actions)[];
    for (const name of names) {
      out[name] = async (...args: unknown[]) => {
        const me = viewerRef.current;
        if (!me) throw new Error('Not signed in');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (backend[name] as any)(me, ...args);
          await reload();
          return result;
        } catch (e) {
          setNotice({ kind: 'error', text: (e as Error).message });
          throw e;
        }
      };
    }
    return out as Actions;
  }, [backend, reload]);

  const signOut = useCallback(async () => {
    if (IS_DEMO) {
      demoViewer.set(null);
      setDemoViewerId(null);
    } else {
      await supabase().auth.signOut();
    }
  }, []);

  const demo = useMemo(() => (IS_DEMO ? {
    people: demoProfiles(),
    switchTo(id: string) { demoViewer.set(id); setDemoViewerId(id); },
    reset() { resetDemo(); },
  } : null), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: StoreValue = {
    mode: IS_DEMO ? 'demo' : 'live',
    status, error, viewer, data, actions, notice,
    notify: setNotice,
    signOut, sessionEmail, demo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

/** For screens that only render once data has loaded and someone is signed in. */
export function useApp(): StoreValue & { viewer: Profile; data: AppData } {
  const s = useStore();
  if (!s.viewer || !s.data) throw new Error('useApp used before data loaded');
  return s as StoreValue & { viewer: Profile; data: AppData };
}
