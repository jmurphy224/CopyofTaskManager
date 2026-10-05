export type Role = 'admin' | 'manager' | 'user';

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface Profile {
  id: string;
  email: string;
  name: string;
  /** Short display name, e.g. "Priya S." */
  short: string;
  initials: string;
  role: Role;
  groupIds: string[];
  /** Avatar background color */
  color: string;
  active: boolean;
}

export interface Group {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
  bg: string;
  fg: string;
}

/** A show pulled from Airtable. */
export interface Show {
  number: string;
  name: string;
  startDate: string | null;
  venue: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  assigneeId: string;
  groupId: string | null;
  tagIds: string[];
  showNumber: string | null;
  /** YYYY-MM-DD */
  dueDate: string;
  /** HH:MM (24h). Null means end of business day. */
  dueTime: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
  pushToCalendar: boolean;
  recurrence: Recurrence;
  /** Set once a finished recurring task has created its next copy. */
  spawnedNext?: boolean;
}

export type TaskInput = Pick<
  Task,
  | 'title'
  | 'notes'
  | 'assigneeId'
  | 'groupId'
  | 'tagIds'
  | 'showNumber'
  | 'dueDate'
  | 'dueTime'
  | 'pushToCalendar'
  | 'recurrence'
>;

export type CalendarProvider = 'google' | 'microsoft';

export interface CalendarAccount {
  id: string;
  provider: CalendarProvider;
  email: string;
  lastSyncAt: string | null;
}

export interface Calendar {
  id: string;
  accountId: string;
  name: string;
  color: string;
  shared: boolean;
  showEvents: boolean;
  sendDeadlines: boolean;
}

export interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, or null for all-day */
  time: string | null;
  /** Person who can see this event (besides managers and admins). */
  visibleToProfileId: string | null;
  /** Shop TV that shows this event. */
  visibleToDisplayId: string | null;
}

export interface Display {
  id: string;
  name: string;
  groupId: string;
  /** Six-character code a TV types in once to link itself. Null once used. */
  pairingCode: string | null;
  paired: boolean;
  active: boolean;
  lastSeenAt: string | null;
}

export interface Invite {
  email: string;
  name: string;
  role: Role;
  groupIds: string[];
  createdAt: string;
}

/** Everything the signed-in person is allowed to see. */
export interface AppData {
  profiles: Profile[];
  groups: Group[];
  tags: Tag[];
  shows: Show[];
  tasks: Task[];
  accounts: CalendarAccount[];
  calendars: Calendar[];
  events: CalEvent[];
  displays: Display[];
  invites: Invite[];
}

/** What a shop TV receives. */
export interface DisplayFeed {
  display: { id: string; name: string };
  group: Group;
  people: Pick<Profile, 'id' | 'name' | 'short' | 'initials' | 'color'>[];
  tasks: Pick<Task, 'id' | 'title' | 'assigneeId' | 'showNumber' | 'dueDate' | 'dueTime' | 'done'>[];
  events: Pick<CalEvent, 'id' | 'title' | 'date' | 'time'>[];
}

export type EventVisibility =
  | { kind: 'none' }
  | { kind: 'profile'; id: string }
  | { kind: 'display'; id: string };
