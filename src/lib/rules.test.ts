import { describe, expect, it } from 'vitest';
import { isAllowedEmail } from './config';
import { dueAt, mondayOf, nextOccurrence, taskStatus, ymd } from './dates';
import { createDemoBackend, resetDemo } from './demoBackend';
import { canCompleteTask, canEditTask, canSeeTask } from './permissions';
import { buildSeed } from './seed';
import type { Profile, Task } from './types';

const base: Task = {
  id: 't', title: 'Load truck 1', notes: '', assigneeId: 'priya', groupId: 'production', tagIds: [],
  showNumber: '2417', dueDate: '2026-09-29', dueTime: null, done: false, doneBy: null, doneAt: null,
  createdBy: 'dana', createdAt: '', pushToCalendar: false, recurrence: 'none',
};
const person = (id: string, role: Profile['role'], groupIds: string[]): Profile => ({
  id, email: `${id}@fogarty.com`, name: id, short: id, initials: id.slice(0, 2), role, groupIds, color: '#000', active: true,
});
const admin = person('joe', 'admin', []);
const manager = person('dana', 'manager', ['production']);
const priya = person('priya', 'user', ['production']);
const marcus = person('marcus', 'user', ['creative']);

describe('deadlines', () => {
  it('treats a blank time as 4:00 PM end of business day', () => {
    expect(dueAt(base).getHours()).toBe(16);
    expect(dueAt({ ...base, dueTime: '09:30' }).getHours()).toBe(9);
  });

  it('works out the status', () => {
    const noon = new Date(2026, 8, 29, 12, 0);
    expect(taskStatus(base, noon)).toBe('due-today');
    expect(taskStatus({ ...base, dueTime: '11:00' }, noon)).toBe('overdue');
    expect(taskStatus(base, new Date(2026, 8, 29, 16, 1))).toBe('overdue');
    expect(taskStatus({ ...base, dueDate: '2026-09-30' }, noon)).toBe('upcoming');
    expect(taskStatus({ ...base, dueTime: '11:00', done: true }, noon)).toBe('done');
  });

  it('starts weeks on Monday', () => {
    expect(ymd(mondayOf(new Date(2026, 9, 4)))).toBe('2026-09-28'); // Sunday
    expect(ymd(mondayOf(new Date(2026, 8, 28)))).toBe('2026-09-28'); // Monday
  });
});

describe('recurring tasks', () => {
  const today = new Date(2026, 8, 29, 10); // Tuesday
  it('schedules the next copy', () => {
    expect(nextOccurrence('2026-09-29', 'daily', today)).toBe('2026-09-30');
    expect(nextOccurrence('2026-09-29', 'weekly', today)).toBe('2026-10-06');
    expect(nextOccurrence('2026-10-02', 'weekdays', today)).toBe('2026-10-05'); // Fri -> Mon
    expect(nextOccurrence('2026-09-29', 'none', today)).toBeNull();
  });
  it('never schedules the next copy in the past', () => {
    expect(nextOccurrence('2026-09-21', 'daily', today)).toBe('2026-09-29');
    expect(nextOccurrence('2026-09-14', 'weekly', today)).toBe('2026-10-05'); // keeps its weekday (Mon)
  });
});

describe('sign-in domain', () => {
  it('only allows the configured domains', () => {
    expect(isAllowedEmail('Priya.Shah@Fogarty.com', ['fogarty.com'])).toBe(true);
    expect(isAllowedEmail('someone@gmail.com', ['fogarty.com'])).toBe(false);
    expect(isAllowedEmail('fogarty.com@gmail.com', ['fogarty.com'])).toBe(false);
    expect(isAllowedEmail('x@notfogarty.com', ['fogarty.com'])).toBe(false);
    expect(isAllowedEmail('not-an-email', ['fogarty.com'])).toBe(false);
  });
});

describe('permissions', () => {
  it('lets users see their own and their groups’ tasks only', () => {
    expect(canSeeTask(priya, base)).toBe(true);
    expect(canSeeTask(marcus, base)).toBe(false);
    expect(canSeeTask(marcus, { ...base, assigneeId: 'marcus', groupId: null })).toBe(true);
    expect(canSeeTask(manager, { ...base, groupId: 'creative' })).toBe(true);
  });

  it('lets the assignee, managers and admins complete a task', () => {
    expect(canCompleteTask(priya, base)).toBe(true);
    expect(canCompleteTask(admin, base)).toBe(true);
    expect(canCompleteTask(manager, { ...base, groupId: 'creative' })).toBe(true);
    expect(canCompleteTask(person('lena', 'user', ['production']), base)).toBe(false);
  });

  it('limits editing', () => {
    expect(canEditTask(admin, base)).toBe(true);
    expect(canEditTask(manager, base)).toBe(true);
    expect(canEditTask(manager, { ...base, groupId: 'creative' })).toBe(false);
    expect(canEditTask(priya, base)).toBe(false);
    expect(canEditTask(priya, { ...base, createdBy: 'priya' })).toBe(true);
  });
});

describe('demo backend enforces the same rules', () => {
  it('blocks a user from completing someone else’s task and allows the assignee', async () => {
    resetDemo();
    const seed = buildSeed();
    const lena = seed.profiles.find((p) => p.id === 'lena')!;
    const priyaP = seed.profiles.find((p) => p.id === 'priya')!;
    let viewer = 'lena';
    const backend = createDemoBackend(() => viewer);
    await expect(backend.setTaskDone(lena, 't4', true)).rejects.toThrow(/assignee/);
    viewer = 'priya';
    await backend.setTaskDone(priyaP, 't4', true);
    expect((await backend.load()).tasks.find((t) => t.id === 't4')!.done).toBe(true);
  });

  it('stops users assigning work to others', async () => {
    resetDemo();
    const seed = buildSeed();
    const priyaP = seed.profiles.find((p) => p.id === 'priya')!;
    const backend = createDemoBackend(() => 'priya');
    const input = { ...base, assigneeId: 'marcus' };
    await expect(backend.saveTask(priyaP, input)).rejects.toThrow(/themselves/);
  });

  it('creates the next copy when a recurring task is finished', async () => {
    resetDemo();
    const seed = buildSeed();
    const tom = seed.profiles.find((p) => p.id === 'tom')!;
    const backend = createDemoBackend(() => 'tom');
    const before = (await backend.load()).tasks.filter((t) => t.title === 'Sweep warehouse floor').length;
    await backend.setTaskDone(tom, 'w9', true);
    await backend.setTaskDone(tom, 'w9', false);
    await backend.setTaskDone(tom, 'w9', true); // finishing again does not make a second copy
    const after = (await backend.load()).tasks.filter((t) => t.title === 'Sweep warehouse floor');
    expect(after.length).toBe(before + 1);
  });

  it('hides other people’s tasks from a user', async () => {
    resetDemo();
    const backend = createDemoBackend(() => 'marcus');
    const visible = (await backend.load()).tasks;
    expect(visible.every((t) => t.assigneeId === 'marcus' || t.groupId === 'creative')).toBe(true);
  });
});
