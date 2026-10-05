import type {
  AppData, Calendar, DisplayFeed, EventVisibility, Profile, Role, TaskInput,
} from './types';

export interface InviteInput {
  email: string;
  name: string;
  role: Role;
  groupIds: string[];
}

/**
 * Everything the screens can ask for. Implemented by the demo backend
 * (browser-only sample data) and the live backend (Supabase).
 */
export interface Backend {
  /** Loads everything the signed-in person is allowed to see. */
  load(): Promise<AppData>;
  /** Calls `onChange` when data changes elsewhere (other people, other tabs). */
  subscribe(onChange: () => void): () => void;

  saveTask(viewer: Profile, input: TaskInput, id?: string): Promise<string>;
  deleteTask(viewer: Profile, id: string): Promise<void>;
  setTaskDone(viewer: Profile, id: string, done: boolean): Promise<void>;

  setEventVisibility(viewer: Profile, eventId: string, visibility: EventVisibility): Promise<void>;
  updateCalendar(viewer: Profile, id: string, patch: Partial<Pick<Calendar, 'showEvents' | 'sendDeadlines'>>): Promise<void>;

  updateProfile(viewer: Profile, id: string, patch: Partial<Pick<Profile, 'role' | 'groupIds' | 'active'>>): Promise<void>;
  createInvite(viewer: Profile, input: InviteInput): Promise<void>;
  deleteInvite(viewer: Profile, email: string): Promise<void>;
  createTag(viewer: Profile, name: string): Promise<void>;
  createGroup(viewer: Profile, name: string): Promise<void>;

  createDisplay(viewer: Profile, name: string, groupId: string): Promise<void>;
  newPairingCode(viewer: Profile, id: string): Promise<void>;
  setDisplayActive(viewer: Profile, id: string, active: boolean): Promise<void>;
  deleteDisplay(viewer: Profile, id: string): Promise<void>;

  /** Pulls show numbers from Airtable. Returns a message for the admin. */
  syncShows(viewer: Profile): Promise<string>;
}

/** What a shop TV uses. TVs have no person signed in. */
export interface DisplayBackend {
  /** Exchanges a pairing code for a long-lived display token. */
  pair(code: string): Promise<string>;
  /** The display's group, tasks and events for today and the next 5 days. */
  feed(token: string, from: string, to: string): Promise<DisplayFeed>;
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
