// Live mode: data in Supabase. The database's row-level security decides what
// each person can see and change; this file only reads and writes.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend, DisplayBackend } from './backend';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type {
  AppData, CalEvent, Calendar, CalendarAccount, Display, DisplayFeed, Group, Invite, Profile, Show, Tag, Task, TaskInput,
} from './types';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

const hm = (t: string | null): string | null => (t ? t.slice(0, 5) : null);

const toProfile = (r: Row): Profile => ({
  id: r.id, email: r.email, name: r.name, short: r.short_name, initials: r.initials, role: r.role,
  color: r.color, active: r.active, groupIds: (r.group_members ?? []).map((m: Row) => m.group_id),
});

const toTask = (r: Row): Task => ({
  id: r.id, title: r.title, notes: r.notes, assigneeId: r.assignee_id, groupId: r.group_id,
  tagIds: (r.task_tags ?? []).map((x: Row) => x.tag_id), showNumber: r.show_number,
  dueDate: r.due_date, dueTime: hm(r.due_time), done: r.done, doneBy: r.done_by, doneAt: r.done_at,
  createdBy: r.created_by, createdAt: r.created_at, pushToCalendar: r.push_to_calendar,
  recurrence: r.recurrence, spawnedNext: r.spawned_next,
});

const fromTaskInput = (i: TaskInput): Row => ({
  title: i.title.trim(), notes: i.notes, assignee_id: i.assigneeId, group_id: i.groupId,
  show_number: i.showNumber || null, due_date: i.dueDate, due_time: i.dueTime || null,
  push_to_calendar: i.pushToCalendar, recurrence: i.recurrence,
});

export function createLiveBackend(): Backend {
  const db = supabase();

  async function setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
    check(await db.from('task_tags').delete().eq('task_id', taskId));
    if (tagIds.length) check(await db.from('task_tags').insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id }))));
  }

  return {
    async load(): Promise<AppData> {
      const [profiles, groups, tags, shows, tasks, accounts, calendars, events, displays, invites] = await Promise.all([
        db.from('profiles').select('*, group_members(group_id)').order('name'),
        db.from('groups').select('id, name').order('name'),
        db.from('tags').select('id, name, bg, fg').order('name'),
        db.from('shows').select('number, name, start_date, venue').order('number', { ascending: false }),
        db.from('tasks').select('*, task_tags(tag_id)').order('due_date'),
        db.from('calendar_accounts').select('id, provider, email, last_sync_at'),
        db.from('calendars').select('*').order('name'),
        db.from('calendar_events').select('*').order('date'),
        db.from('displays').select('id, name, group_id, pairing_code, paired, active, last_seen_at').order('name'),
        db.from('invites').select('*').order('created_at'),
      ]);
      return {
        profiles: check(profiles).map(toProfile),
        groups: check(groups) as Group[],
        tags: check(tags) as Tag[],
        shows: check(shows).map((r: Row): Show => ({ number: r.number, name: r.name, startDate: r.start_date, venue: r.venue })),
        tasks: check(tasks).map(toTask),
        accounts: check(accounts).map((r: Row): CalendarAccount => ({ id: r.id, provider: r.provider, email: r.email, lastSyncAt: r.last_sync_at })),
        calendars: check(calendars).map((r: Row): Calendar => ({
          id: r.id, accountId: r.account_id, name: r.name, color: r.color, shared: r.shared,
          showEvents: r.show_events, sendDeadlines: r.send_deadlines,
        })),
        events: check(events).map((r: Row): CalEvent => ({
          id: r.id, calendarId: r.calendar_id, title: r.title, date: r.date, time: hm(r.time),
          visibleToProfileId: r.visible_to_profile_id, visibleToDisplayId: r.visible_to_display_id,
        })),
        displays: check(displays).map((r: Row): Display => ({
          id: r.id, name: r.name, groupId: r.group_id, pairingCode: r.pairing_code, paired: r.paired,
          active: r.active, lastSeenAt: r.last_seen_at,
        })),
        invites: check(invites).map((r: Row): Invite => ({
          email: r.email, name: r.name, role: r.role, groupIds: r.group_ids, createdAt: r.created_at,
        })),
      };
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const debounced = () => { clearTimeout(timer); timer = setTimeout(onChange, 300); };
      const channel = db.channel('runsheet-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debounced)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, debounced)
        .subscribe();
      return () => { clearTimeout(timer); void db.removeChannel(channel); };
    },

    async saveTask(_viewer, input, id) {
      if (id) {
        check(await db.from('tasks').update(fromTaskInput(input)).eq('id', id));
        await setTaskTags(id, input.tagIds);
        return id;
      }
      const row = check(await db.from('tasks').insert(fromTaskInput(input)).select('id').single()) as Row;
      await setTaskTags(row.id, input.tagIds);
      return row.id as string;
    },

    async deleteTask(_viewer, id) {
      check(await db.from('tasks').delete().eq('id', id));
    },

    async setTaskDone(_viewer, id, done) {
      check(await db.rpc('set_task_done', { p_task_id: id, p_done: done }));
    },

    async setEventVisibility(_viewer, eventId, v) {
      check(await db.from('calendar_events').update({
        visible_to_profile_id: v.kind === 'profile' ? v.id : null,
        visible_to_display_id: v.kind === 'display' ? v.id : null,
      }).eq('id', eventId));
    },

    async updateCalendar(_viewer, id, patch) {
      if (patch.sendDeadlines) {
        // Only one calendar receives deadlines: clear the old one first.
        check(await db.from('calendars').update({ send_deadlines: false }).eq('send_deadlines', true));
      }
      const row: Row = {};
      if (patch.showEvents !== undefined) row.show_events = patch.showEvents;
      if (patch.sendDeadlines !== undefined) row.send_deadlines = patch.sendDeadlines;
      check(await db.from('calendars').update(row).eq('id', id));
    },

    async updateProfile(_viewer, id, patch) {
      const row: Row = {};
      if (patch.role) row.role = patch.role;
      if (patch.active !== undefined) row.active = patch.active;
      if (Object.keys(row).length) check(await db.from('profiles').update(row).eq('id', id));
      if (patch.groupIds) {
        check(await db.from('group_members').delete().eq('profile_id', id));
        if (patch.groupIds.length) {
          check(await db.from('group_members').insert(patch.groupIds.map((group_id) => ({ group_id, profile_id: id }))));
        }
      }
    },

    async createInvite(_viewer, input) {
      check(await db.from('invites').upsert({
        email: input.email.trim().toLowerCase(), name: input.name.trim(), role: input.role, group_ids: input.groupIds,
      }));
    },

    async deleteInvite(_viewer, email) {
      check(await db.from('invites').delete().eq('email', email));
    },

    async createTag(_viewer, name) {
      check(await db.from('tags').insert({ name: name.trim() }));
    },

    async createGroup(_viewer, name) {
      check(await db.from('groups').insert({ name: name.trim() }));
    },

    async createDisplay(_viewer, name, groupId) {
      check(await db.from('displays').insert({ name: name.trim(), group_id: groupId }));
    },

    async newPairingCode(_viewer, id) {
      check(await db.rpc('new_pairing_code', { p_display_id: id }));
    },

    async setDisplayActive(_viewer, id, active) {
      check(await db.from('displays').update({ active }).eq('id', id));
    },

    async deleteDisplay(_viewer, id) {
      check(await db.from('displays').delete().eq('id', id));
    },

    async syncShows() {
      const { data, error } = await db.functions.invoke('sync-shows', { method: 'POST' });
      if (error) throw new Error(error.message);
      return (data as { message?: string })?.message ?? 'Shows synced from Airtable.';
    },
  };
}

export const liveDisplayBackend: DisplayBackend = {
  async pair(code) {
    return check(await supabase().rpc('pair_display', { p_code: code })) as string;
  },
  async feed(token, from, to) {
    return check(await supabase().rpc('display_feed', { p_token: token, p_from: from, p_to: to })) as DisplayFeed;
  },
};
