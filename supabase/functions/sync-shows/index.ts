// Supabase Edge Function: copies show numbers from Airtable into the `shows` table.
//
// Called two ways:
//   - by an admin pressing "Sync now" (the request carries their sign-in token)
//   - on a schedule (pg_cron), using the service role key
//
// Secrets (set with `supabase secrets set NAME=value`):
//   AIRTABLE_TOKEN          personal access token with data.records:read on the base
//   AIRTABLE_BASE_ID        e.g. appXXXXXXXXXXXXXX
//   AIRTABLE_TABLE          table name or id, e.g. "Shows"
//   AIRTABLE_VIEW           optional view to limit which shows come across
//   AIRTABLE_FIELD_NUMBER   default "Show Number"
//   AIRTABLE_FIELD_NAME     default "Show Name"
//   AIRTABLE_FIELD_START    default "Start Date"
//   AIRTABLE_FIELD_VENUE    default "Venue"
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const env = (name: string, fallback?: string): string => {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined) throw new Error(`Missing secret ${name}`);
  return v;
};

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const base = env('AIRTABLE_BASE_ID');
  const table = encodeURIComponent(env('AIRTABLE_TABLE'));
  const view = Deno.env.get('AIRTABLE_VIEW');
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${table}`);
    url.searchParams.set('pageSize', '100');
    if (view) url.searchParams.set('view', view);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${env('AIRTABLE_TOKEN')}` } });
    if (!res.ok) throw new Error(`Airtable returned ${res.status}: ${await res.text()}`);
    const page = await res.json() as { records: AirtableRecord[]; offset?: string };
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length ? text(v[0]) : null; // lookup / linked fields
  const s = String(v).trim();
  return s || null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' });

  try {
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(env('SUPABASE_URL'), serviceKey, { auth: { persistSession: false } });

    // Only admins (or the scheduled job using the service key) may sync.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token !== serviceKey) {
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) return reply(401, { error: 'Sign in first.' });
      const { data: profile } = await db.from('profiles').select('role, active').eq('id', user.id).single();
      if (!profile || !profile.active || profile.role !== 'admin') return reply(403, { error: 'Only admins can sync Airtable.' });
    }

    const f = {
      number: env('AIRTABLE_FIELD_NUMBER', 'Show Number'),
      name: env('AIRTABLE_FIELD_NAME', 'Show Name'),
      start: env('AIRTABLE_FIELD_START', 'Start Date'),
      venue: env('AIRTABLE_FIELD_VENUE', 'Venue'),
    };
    const records = await fetchAllRecords();
    const now = new Date().toISOString();
    const rows = new Map<string, Record<string, unknown>>();
    for (const r of records) {
      const number = text(r.fields[f.number]);
      if (!number) continue; // rows without a show number are skipped
      rows.set(number, {
        number,
        name: text(r.fields[f.name]) ?? '',
        start_date: text(r.fields[f.start])?.slice(0, 10) ?? null,
        venue: text(r.fields[f.venue]),
        airtable_record_id: r.id,
        synced_at: now,
      });
    }

    const all = [...rows.values()];
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await db.from('shows').upsert(all.slice(i, i + 500), { onConflict: 'number' });
      if (error) throw new Error(error.message);
    }

    const skipped = records.length - all.length;
    return reply(200, {
      message: `Synced ${all.length} show${all.length === 1 ? '' : 's'} from Airtable${skipped ? ` (${skipped} rows had no show number and were skipped)` : ''}.`,
      count: all.length,
    });
  } catch (e) {
    return reply(500, { error: (e as Error).message });
  }
});
