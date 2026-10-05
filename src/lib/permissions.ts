// The permission rules from the Roles & permissions screen.
// The database enforces the same rules (supabase/migrations/0001_schema.sql);
// these helpers only decide what the screens show and enable.
import type { Profile, Role, Task } from './types';

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', manager: 'Manager', user: 'User' };

export function isManagerOrAdmin(p: Pick<Profile, 'role'>): boolean {
  return p.role === 'admin' || p.role === 'manager';
}

/** Admins and managers see every task; users see their own plus their groups'. */
export function canSeeTask(viewer: Profile, task: Task): boolean {
  if (isManagerOrAdmin(viewer)) return true;
  return task.assigneeId === viewer.id || (task.groupId !== null && viewer.groupIds.includes(task.groupId));
}

/** The assignee, or any manager or admin, can mark a task complete. */
export function canCompleteTask(viewer: Profile, task: Task): boolean {
  return isManagerOrAdmin(viewer) || task.assigneeId === viewer.id;
}

/**
 * Admins edit anything. Managers edit tasks in their groups, plus ungrouped
 * tasks they created or are assigned. Users edit tasks they created for
 * themselves.
 */
export function canEditTask(viewer: Profile, task: Task): boolean {
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'manager') {
    if (task.groupId) return viewer.groupIds.includes(task.groupId);
    return task.createdBy === viewer.id || task.assigneeId === viewer.id;
  }
  return task.createdBy === viewer.id && task.assigneeId === viewer.id;
}

export const canDeleteTask = canEditTask;

/** Managers and admins can assign tasks to anyone; users only to themselves. */
export function canAssignOthers(viewer: Pick<Profile, 'role'>): boolean {
  return isManagerOrAdmin(viewer);
}

export const canManageTagsAndGroups = isManagerOrAdmin;
export const canManageCalendars = isManagerOrAdmin;

export function canManagePeople(viewer: Pick<Profile, 'role'>): boolean {
  return viewer.role === 'admin';
}

export const canManageDisplays = canManagePeople;
export const canManageAirtable = canManagePeople;

/** Explanation shown on a locked checkbox. */
export function completeLockReason(assignee: Profile | undefined): string {
  return `Only ${assignee?.name ?? 'the assignee'}, a manager or an admin can mark this complete`;
}

/** The matrix shown on the Roles & permissions page. */
export const PERMISSION_MATRIX: { label: string; admin: string; manager: string; user: string; tv: string }[] = [
  { label: 'See own assigned tasks', admin: 'Yes', manager: 'Yes', user: 'Yes', tv: 'No' },
  { label: "See their groups' tasks", admin: 'Yes', manager: 'Yes', user: 'Yes', tv: 'Its one group' },
  { label: "See everyone's tasks", admin: 'Yes', manager: 'Yes', user: 'No', tv: 'No' },
  { label: 'Create tasks', admin: 'Yes', manager: 'Yes', user: 'For self only', tv: 'No' },
  { label: 'Assign and reassign tasks', admin: 'Yes', manager: 'Yes', user: 'No', tv: 'No' },
  { label: 'Mark a task complete', admin: 'Any task', manager: 'Any task', user: 'If assignee', tv: 'No' },
  { label: 'Edit or delete any task', admin: 'Yes', manager: 'Their groups', user: 'Own tasks only', tv: 'No' },
  { label: 'Manage tags and groups', admin: 'Yes', manager: 'Yes', user: 'No', tv: 'No' },
  { label: 'Connect and sync Google or Microsoft calendars', admin: 'Yes', manager: 'Yes', user: 'No', tv: 'No' },
  { label: 'Assign calendar events to team members', admin: 'Yes', manager: 'Yes', user: 'No', tv: 'No' },
  { label: 'See synced calendar events', admin: 'Yes', manager: 'Yes', user: 'Only events assigned to them', tv: 'Only events assigned to it' },
  { label: 'Manage people, roles and shop TVs', admin: 'Yes', manager: 'No', user: 'No', tv: 'No' },
  { label: 'Airtable connection settings', admin: 'Yes', manager: 'No', user: 'No', tv: 'No' },
];
