// Demo mode: all data lives in this browser's localStorage. The permission
// checks here mirror the database rules, so the demo behaves like the real app.
import { PermissionError, type Backend, type DisplayBackend } from './backend';
import { nextOccurrence } from './dates';
import {
  canAssignOthers, canCompleteTask, canEditTask, canManageCalendars, canManageDisplays,
  canManagePeople, canManageTagsAndGroups, canSeeTask, isManagerOrAdmin,
} from './permissions';
import { buildSeed } from './seed';
import type { AppData, DisplayFeed, Profile, Task, TaskInput } from './types';

const STORAGE_KEY = 'runsheet-demo-data-v1';
const VIEWER_KEY = 'runsheet-demo-viewer';
const CHANNEL = 'runsheet-demo';

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage unavailable (private window): demo still works until reload */ }
}

let memory: AppData | null = null;

function all(): AppData {
  if (memory) return memory;
  const raw = readStorage(STORAGE_KEY);
  if (raw) {
    try { memory = JSON.parse(raw) as AppData; return memory; } catch { /* fall through to a fresh seed */ }
  }
  memory = buildSeed();
  return memory;
}

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => { memory = null; listeners.forEach((l) => l()); };
} catch { /* BroadcastChannel unsupported */ }

function commit(next: AppData): void {
  memory = next;
  writeStorage(STORAGE_KEY, JSON.stringify(next));
  channel?.postMessage('changed');
  listeners.forEach((l) => l());
}

function id(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

function pairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id('x');
}

function require(cond: boolean, message: string): void {
  if (!cond) throw new PermissionError(message);
}

/** Data as the given person is allowed to see it (what the database would return). */
function visibleTo(data: AppData, viewer: Profile): AppData {
  const elevated = isManagerOrAdmin(viewer);
  return {
    ...data,
    tasks: data.tasks.filter((t) => canSeeTask(viewer, t)),
    events: elevated ? data.events : data.events.filter((e) => e.visibleToProfileId === viewer.id),
    accounts: elevated ? data.accounts : [],
    calendars: elevated ? data.calendars : data.calendars.filter((c) => data.events.some((e) => e.calendarId === c.id && e.visibleToProfileId === viewer.id)),
    displays: canManageDisplays(viewer) ? data.displays : data.displays.map((d) => ({ ...d, pairingCode: null })),
    invites: canManagePeople(viewer) ? data.invites : [],
  };
}

export const demoViewer = {
  get(): string | null { return readStorage(VIEWER_KEY); },
  set(profileId: string | null): void { writeStorage(VIEWER_KEY, profileId); },
};

export function resetDemo(): void {
  writeStorage(STORAGE_KEY, null);
  memory = null;
  commit(buildSeed());
}

export function demoProfiles(): Profile[] {
  return all().profiles;
}

export function demoGroupName(id: string): string {
  return all().groups.find((g) => g.id === id)?.name ?? id;
}

export function createDemoBackend(viewerId: () => string | null): Backend {
  const viewerProfile = () => all().profiles.find((p) => p.id === viewerId());

  return {
    async load() {
      const viewer = viewerProfile();
      if (!viewer) throw new Error('No demo person selected');
      return visibleTo(all(), viewer);
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => { listeners.delete(onChange); };
    },

    async saveTask(viewer, input: TaskInput, taskId) {
      const data = all();
      require(input.title.trim().length > 0, 'A task needs a title.');
      require(canAssignOthers(viewer) || input.assigneeId === viewer.id, 'Users can only create tasks for themselves.');
      if (taskId) {
        const existing = data.tasks.find((t) => t.id === taskId);
        require(!!existing && canEditTask(viewer, existing), "You can't edit this task.");
        const updated: Task = { ...existing!, ...input, title: input.title.trim() };
        require(canEditTask(viewer, updated), "You can't move this task to a group you don't manage.");
        commit({ ...data, tasks: data.tasks.map((t) => (t.id === taskId ? updated : t)) });
        return taskId;
      }
      const task: Task = {
        ...input,
        title: input.title.trim(),
        id: id('t'),
        done: false, doneBy: null, doneAt: null,
        createdBy: viewer.id, createdAt: new Date().toISOString(),
      };
      commit({ ...data, tasks: [...data.tasks, task] });
      return task.id;
    },

    async deleteTask(viewer, taskId) {
      const data = all();
      const task = data.tasks.find((t) => t.id === taskId);
      require(!!task && canEditTask(viewer, task), "You can't delete this task.");
      commit({ ...data, tasks: data.tasks.filter((t) => t.id !== taskId) });
    },

    async setTaskDone(viewer, taskId, done) {
      const data = all();
      const task = data.tasks.find((t) => t.id === taskId);
      require(!!task && canCompleteTask(viewer, task), 'Only the assignee, a manager or an admin can mark this complete.');
      let tasks = data.tasks.map((t) => (t.id === taskId
        ? { ...t, done, doneBy: done ? viewer.id : null, doneAt: done ? new Date().toISOString() : null }
        : t));
      // Recurring tasks: finishing one creates the next copy (once).
      if (done && task!.recurrence !== 'none' && !task!.spawnedNext) {
        const nextDate = nextOccurrence(task!.dueDate, task!.recurrence, new Date());
        if (nextDate) {
          tasks = tasks.map((t) => (t.id === taskId ? { ...t, spawnedNext: true } : t));
          tasks.push({
            ...task!, id: id('t'), dueDate: nextDate, done: false, doneBy: null, doneAt: null,
            createdAt: new Date().toISOString(), spawnedNext: false,
          });
        }
      }
      commit({ ...data, tasks });
    },

    async setEventVisibility(viewer, eventId, visibility) {
      require(canManageCalendars(viewer), 'Only managers and admins can share calendar events.');
      const data = all();
      commit({
        ...data,
        events: data.events.map((e) => (e.id === eventId ? {
          ...e,
          visibleToProfileId: visibility.kind === 'profile' ? visibility.id : null,
          visibleToDisplayId: visibility.kind === 'display' ? visibility.id : null,
        } : e)),
      });
    },

    async updateCalendar(viewer, calId, patch) {
      require(canManageCalendars(viewer), 'Only managers and admins can change calendar sync.');
      const data = all();
      commit({
        ...data,
        calendars: data.calendars.map((c) => {
          if (c.id === calId) return { ...c, ...patch };
          // Only one calendar receives deadlines.
          return patch.sendDeadlines ? { ...c, sendDeadlines: false } : c;
        }),
      });
    },

    async updateProfile(viewer, profileId, patch) {
      require(canManagePeople(viewer), 'Only admins can change people and roles.');
      require(!(profileId === viewer.id && patch.role && patch.role !== 'admin'), "You can't remove your own admin role. Ask another admin.");
      const data = all();
      commit({ ...data, profiles: data.profiles.map((p) => (p.id === profileId ? { ...p, ...patch } : p)) });
    },

    async createInvite(viewer, input) {
      require(canManagePeople(viewer), 'Only admins can invite people.');
      const data = all();
      const email = input.email.trim().toLowerCase();
      // In demo mode the invite immediately becomes a person you can preview as.
      const parts = input.name.trim().split(/\s+/);
      const profile: Profile = {
        id: id('p'), email, name: input.name.trim(),
        short: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0],
        initials: parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
        role: input.role, groupIds: input.groupIds, color: '#45423C', active: true,
      };
      commit({
        ...data,
        profiles: [...data.profiles, profile],
        invites: [...data.invites.filter((i) => i.email !== email), { ...input, email, createdAt: new Date().toISOString() }],
      });
    },

    async deleteInvite(viewer, email) {
      require(canManagePeople(viewer), 'Only admins can manage invites.');
      const data = all();
      commit({ ...data, invites: data.invites.filter((i) => i.email !== email) });
    },

    async createTag(viewer, name) {
      require(canManageTagsAndGroups(viewer), 'Only managers and admins can add tags.');
      const data = all();
      commit({ ...data, tags: [...data.tags, { id: slug(name), name: name.trim(), bg: '#E6E3DC', fg: '#45423C' }] });
    },

    async createGroup(viewer, name) {
      require(canManageTagsAndGroups(viewer), 'Only managers and admins can add groups.');
      const data = all();
      commit({ ...data, groups: [...data.groups, { id: slug(name), name: name.trim() }] });
    },

    async createDisplay(viewer, name, groupId) {
      require(canManageDisplays(viewer), 'Only admins can add shop TVs.');
      const data = all();
      commit({
        ...data,
        displays: [...data.displays, {
          id: id('tv'), name: name.trim(), groupId, pairingCode: pairingCode(), paired: false, active: true, lastSeenAt: null,
        }],
      });
    },

    async newPairingCode(viewer, displayId) {
      require(canManageDisplays(viewer), 'Only admins can manage shop TVs.');
      const data = all();
      commit({ ...data, displays: data.displays.map((d) => (d.id === displayId ? { ...d, pairingCode: pairingCode(), paired: false } : d)) });
    },

    async setDisplayActive(viewer, displayId, active) {
      require(canManageDisplays(viewer), 'Only admins can manage shop TVs.');
      const data = all();
      commit({ ...data, displays: data.displays.map((d) => (d.id === displayId ? { ...d, active } : d)) });
    },

    async deleteDisplay(viewer, displayId) {
      require(canManageDisplays(viewer), 'Only admins can manage shop TVs.');
      const data = all();
      commit({
        ...data,
        displays: data.displays.filter((d) => d.id !== displayId),
        events: data.events.map((e) => (e.visibleToDisplayId === displayId ? { ...e, visibleToDisplayId: null } : e)),
      });
    },

    async syncShows(viewer) {
      require(canManagePeople(viewer), 'Only admins can sync Airtable.');
      return 'Demo mode: Airtable is not connected, so the sample shows were kept.';
    },
  };
}

/** Demo TVs: the "token" is just the display id. */
export const demoDisplayBackend: DisplayBackend = {
  async pair(code) {
    const data = all();
    const display = data.displays.find((d) => d.pairingCode && d.pairingCode === code.trim().toUpperCase());
    if (!display) throw new Error('That code is not valid. Check the code on the Shop TVs page.');
    commit({ ...data, displays: data.displays.map((d) => (d.id === display.id ? { ...d, pairingCode: null, paired: true } : d)) });
    return display.id;
  },

  async feed(token, from, to): Promise<DisplayFeed> {
    const data = all();
    const display = data.displays.find((d) => d.id === token);
    if (!display || !display.active) throw new Error('This display has been switched off or removed.');
    const group = data.groups.find((g) => g.id === display.groupId) ?? { id: display.groupId, name: display.name };
    const tasks = data.tasks.filter((t) => t.groupId === display.groupId && t.dueDate >= from && t.dueDate <= to);
    const peopleIds = new Set(tasks.map((t) => t.assigneeId));
    return {
      display: { id: display.id, name: display.name },
      group,
      people: data.profiles.filter((p) => peopleIds.has(p.id)).map(({ id: pid, name, short, initials, color }) => ({ id: pid, name, short, initials, color })),
      tasks: tasks.map(({ id: tid, title, assigneeId, showNumber, dueDate, dueTime, done }) => ({ id: tid, title, assigneeId, showNumber, dueDate, dueTime, done })),
      events: data.events
        .filter((e) => e.visibleToDisplayId === display.id && e.date >= from && e.date <= to)
        .map(({ id: eid, title, date, time }) => ({ id: eid, title, date, time })),
    };
  },
};
