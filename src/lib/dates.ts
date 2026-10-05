import { END_OF_DAY } from './config';
import type { Recurrence, Task } from './types';

export const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local date as YYYY-MM-DD. */
export function ymd(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Parses YYYY-MM-DD as a local date at midnight. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** The Monday on or before the given date. Weeks run Monday–Sunday. */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** "14:00" -> "2:00 PM" */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM');
}

/** The time a task is actually due: its own time, or end of business day. */
export function effectiveTime(task: Pick<Task, 'dueTime'>): string {
  return task.dueTime || END_OF_DAY;
}

export function dueAt(task: Pick<Task, 'dueDate' | 'dueTime'>): Date {
  const d = parseYmd(task.dueDate);
  const [h, m] = effectiveTime(task).split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export type TaskStatus = 'done' | 'overdue' | 'due-today' | 'upcoming';

export function taskStatus(task: Pick<Task, 'done' | 'dueDate' | 'dueTime'>, now: Date): TaskStatus {
  if (task.done) return 'done';
  if (dueAt(task) < now) return 'overdue';
  if (task.dueDate === ymd(now)) return 'due-today';
  return 'upcoming';
}

/** "end of day" or "3:00 PM" */
export function dueLabel(task: Pick<Task, 'dueTime'>): string {
  return task.dueTime ? fmtTime(task.dueTime) : 'end of day';
}

/**
 * Date of the next copy of a recurring task, or null for one-off tasks.
 * Steps forward from the due date, skipping dates before today, so finishing
 * an overdue daily task puts the next copy on today rather than in the past.
 */
export function nextOccurrence(dueDate: string, recurrence: Recurrence, today: Date): string | null {
  if (recurrence === 'none') return null;
  const todayMidnight = parseYmd(ymd(today));
  const step = (d: Date): Date => {
    if (recurrence === 'weekly') return addDays(d, 7);
    let n = addDays(d, 1);
    if (recurrence === 'weekdays') while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1);
    return n;
  };
  let next = step(parseYmd(dueDate));
  while (next < todayMidnight) next = step(next);
  return ymd(next);
}
