import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs` so statuses like "Overdue" stay current. */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
