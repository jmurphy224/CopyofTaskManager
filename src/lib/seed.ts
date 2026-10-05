// Sample data for demo mode, taken from the mockup. The mockup's "today"
// (Tue Sep 29, 2026) is shifted onto the real today so the demo always has
// tasks due today, overdue and coming up. Names are made up.
import { addDays, parseYmd, ymd } from './dates';
import type { AppData, Profile, Task } from './types';

const MOCKUP_TODAY = '2026-09-29';

function person(
  id: string, name: string, role: Profile['role'], groupIds: string[], color: string,
): Profile {
  const parts = name.split(' ');
  return {
    id,
    email: `${id}@fogarty.example`,
    name,
    short: `${parts[0]} ${parts[parts.length - 1][0]}.`,
    initials: parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    role,
    groupIds,
    color,
    active: true,
  };
}

export function buildSeed(now: Date = new Date()): AppData {
  const offset = Math.round((parseYmd(ymd(now)).getTime() - parseYmd(MOCKUP_TODAY).getTime()) / 86400000);
  const d = (mockupDate: string) => ymd(addDays(parseYmd(mockupDate), offset));
  const created = new Date(now.getTime() - 7 * 86400000).toISOString();

  const profiles: Profile[] = [
    person('joe', 'Joseph Murphy', 'admin', ['production', 'operations'], '#2F4DB3'),
    person('dana', 'Dana Reyes', 'manager', ['production', 'warehouse', 'carpenters'], '#8A4B0F'),
    person('priya', 'Priya Shah', 'user', ['production'], '#5B3E96'),
    person('marcus', 'Marcus Lee', 'user', ['creative'], '#23603A'),
    person('lena', 'Lena Park', 'user', ['creative', 'operations'], '#7A3B5E'),
    person('tom', 'Tom Baker', 'user', ['warehouse'], '#3D5BA9'),
    person('rosa', 'Rosa Martinez', 'user', ['warehouse'], '#A3470F'),
    person('andre', 'Andre King', 'user', ['warehouse'], '#2E6B45'),
    person('sam', 'Sam Wilson', 'user', ['carpenters'], '#6A4A9C'),
    person('nia', 'Nia Okafor', 'user', ['carpenters'], '#8C3F2B'),
    person('luis', 'Luis Garcia', 'user', ['carpenters'], '#2F5F8A'),
  ];

  const t = (
    id: string, title: string, date: string, time: string, assigneeId: string,
    groupId: string | null, tagIds: string[], showNumber: string | null, done = false,
    extra: Partial<Task> = {},
  ): Task => ({
    id, title, notes: '', assigneeId, groupId, tagIds, showNumber,
    dueDate: d(date), dueTime: time || null, done,
    doneBy: done ? assigneeId : null, doneAt: done ? created : null,
    createdBy: 'dana', createdAt: created, pushToCalendar: false, recurrence: 'none',
    ...extra,
  });

  const tasks: Task[] = [
    // Office / production (mockup week view)
    t('t1', 'Send final floor plan to venue', '2026-09-24', '', 'dana', 'production', ['production'], '2417', true),
    t('t2', 'Reconcile September vendor invoices', '2026-09-25', '12:00', 'joe', null, ['finance'], null, true, { createdBy: 'joe' }),
    t('t3', 'Update crew contact sheet', '2026-09-25', '16:00', 'priya', 'production', ['admin'], '2417'),
    t('t4', 'Confirm truck and driver for load-in', '2026-09-28', '15:00', 'priya', 'production', ['logistics'], '2417', false, { pushToCalendar: true }),
    t('t5', 'Approve stage graphics proofs', '2026-09-29', '11:00', 'marcus', 'creative', ['creative'], '2417'),
    t('t6', 'Book hotel block for crew', '2026-09-29', '', 'priya', null, ['logistics'], '2421'),
    t('t7', 'Review Q4 budget draft', '2026-09-30', '10:00', 'joe', null, ['finance', 'admin'], null, false, { createdBy: 'joe' }),
    t('t8', 'Final run-of-show walkthrough', '2026-09-30', '14:00', 'dana', 'production', ['production'], '2417'),
    t('t9', 'Print badges and lanyards', '2026-10-01', '09:00', 'lena', 'operations', ['logistics', 'creative'], '2417'),
    t('t10', 'Pack AV kit and test mics', '2026-10-01', '16:00', 'priya', 'production', ['production'], '2417'),
    t('t11', 'Collect signed crew timesheets', '2026-10-02', '', 'joe', 'operations', ['admin'], '2417'),
    t('t12', 'Post-show wrap notes', '2026-10-02', '18:00', 'dana', 'production', ['production'], '2417'),
    t('t13', 'Social recap post', '2026-10-03', '12:00', 'marcus', 'creative', ['creative'], '2417'),
    t('t14', 'Kickoff call for Show 2421', '2026-10-05', '10:00', 'dana', 'production', ['production'], '2421'),
    t('t15', 'Venue site visit', '2026-10-06', '13:00', 'priya', 'production', ['logistics'], '2421'),
    t('t16', 'Draft event poster', '2026-10-07', '', 'lena', 'creative', ['creative'], '2421'),
    t('t17', 'Renew software licenses', '2026-10-08', '12:00', 'joe', null, ['admin', 'finance'], null, false, { createdBy: 'joe' }),
    // Warehouse (mockup TV)
    t('w1', 'Stage truss and decking', '2026-09-29', '07:30', 'andre', 'warehouse', ['production'], '2417', true),
    t('w2', 'Count and tag cable trunks', '2026-09-29', '10:00', 'rosa', 'warehouse', ['logistics'], '2417'),
    t('w3', 'Load truck 1', '2026-09-29', '14:00', 'tom', 'warehouse', ['logistics'], '2417'),
    t('w4', 'Fuel and inspect forklift', '2026-09-29', '16:30', 'rosa', 'warehouse', ['shop'], null, false, { recurrence: 'weekly' }),
    t('w5', 'Receive rental lighting delivery', '2026-09-30', '13:00', 'andre', 'warehouse', ['logistics'], '2417'),
    t('w6', 'Restock expendables', '2026-10-01', '15:00', 'tom', 'warehouse', ['shop'], null),
    t('w7', 'Unload truck 1 return', '2026-10-02', '19:00', 'tom', 'warehouse', ['logistics'], '2417'),
    t('w8', 'Returns check-in and damage report', '2026-10-03', '10:00', 'rosa', 'warehouse', ['logistics'], '2417'),
    t('w9', 'Sweep warehouse floor', '2026-09-29', '', 'tom', 'warehouse', ['cleaning'], null, false, { recurrence: 'weekdays' }),
    // Carpenters (mockup TV)
    t('c1', 'Cut platform legs', '2026-09-29', '08:00', 'sam', 'carpenters', ['production'], '2417', true),
    t('c2', 'Build stage facing frames', '2026-09-29', '11:00', 'nia', 'carpenters', ['production'], '2417'),
    t('c3', 'Paint and seal stair units', '2026-09-29', '15:00', 'sam', 'carpenters', ['production'], '2417'),
    t('c4', 'Hardware check on rolling risers', '2026-09-29', '16:00', 'luis', 'carpenters', ['shop'], null),
    t('c5', 'Assemble podium', '2026-09-30', '09:00', 'nia', 'carpenters', ['production'], '2421'),
    t('c6', 'Pack touch-up kit for load-in', '2026-10-01', '10:00', 'luis', 'carpenters', ['production'], '2417'),
    t('c7', 'Start scenic flats', '2026-10-02', '13:00', 'sam', 'carpenters', ['production'], '2421'),
    t('c8', 'Clean paint station and wash brushes', '2026-10-02', '', 'luis', 'carpenters', ['cleaning'], null, false, { recurrence: 'weekly' }),
  ];

  return {
    profiles,
    groups: [
      { id: 'production', name: 'Production' },
      { id: 'creative', name: 'Creative' },
      { id: 'operations', name: 'Operations' },
      { id: 'warehouse', name: 'Warehouse' },
      { id: 'carpenters', name: 'Carpenters' },
    ],
    tags: [
      { id: 'production', name: 'Production', bg: '#E1E7FA', fg: '#243C8F' },
      { id: 'logistics', name: 'Logistics', bg: '#FBE4D2', fg: '#86390A' },
      { id: 'creative', name: 'Creative', bg: '#ECE3F8', fg: '#523887' },
      { id: 'finance', name: 'Finance', bg: '#DDF0E3', fg: '#1F5A35' },
      { id: 'admin', name: 'Admin', bg: '#E6E3DC', fg: '#45423C' },
      { id: 'shop', name: 'Shop', bg: '#F3E9C9', fg: '#6A4F06' },
      { id: 'cleaning', name: 'Cleaning', bg: '#D8EEF0', fg: '#1D5560' },
    ],
    shows: [
      { number: '2417', name: '[Sample] Show 2417', startDate: d('2026-10-01'), venue: '[Venue]' },
      { number: '2421', name: '[Sample] Show 2421', startDate: d('2026-10-12'), venue: '[Venue]' },
    ],
    tasks,
    accounts: [
      { id: 'acc-google', provider: 'google', email: '[you@company.com]', lastSyncAt: null },
      { id: 'acc-ms', provider: 'microsoft', email: '[team@company.com]', lastSyncAt: null },
    ],
    calendars: [
      { id: 'work', accountId: 'acc-google', name: 'My work calendar', color: '#2F4DB3', shared: false, showEvents: true, sendDeadlines: false },
      { id: 'prod', accountId: 'acc-google', name: 'Production schedule', color: '#C2560F', shared: true, showEvents: true, sendDeadlines: true },
      { id: 'venue', accountId: 'acc-google', name: 'Venue holds', color: '#23603A', shared: true, showEvents: true, sendDeadlines: false },
      { id: 'pto', accountId: 'acc-ms', name: 'Team PTO', color: '#7A7468', shared: false, showEvents: true, sendDeadlines: false },
      { id: 'load', accountId: 'acc-ms', name: 'Load-in / load-out', color: '#5B3E96', shared: false, showEvents: true, sendDeadlines: false },
      { id: 'holidays', accountId: 'acc-ms', name: 'Holidays', color: '#A8A298', shared: false, showEvents: false, sendDeadlines: false },
    ],
    events: [
      ['e1', 'prod', 'Production standup', '2026-09-28', '09:30'],
      ['e2', 'pto', 'Lena out', '2026-09-28', ''],
      ['e3', 'prod', 'Production standup', '2026-09-29', '09:30'],
      ['e4', 'work', 'Vendor call — staging', '2026-09-29', '13:00'],
      ['e5', 'work', 'Pick up tractor and trailer', '2026-09-30', '08:00', 'priya'],
      ['e6', 'venue', 'Venue hold — Hall B', '2026-09-30', ''],
      ['e7', 'work', '1:1 with Dana', '2026-09-30', '15:00'],
      ['e8', 'load', 'Load-in — Show 2417', '2026-10-01', '07:00', null, 'tv-warehouse'],
      ['e9', 'prod', 'Production standup', '2026-10-01', '09:30'],
      ['e10', 'load', 'Load-out — Show 2417', '2026-10-02', '18:00'],
      ['e11', 'prod', 'Production standup', '2026-10-05', '09:30'],
      ['e12', 'venue', 'Venue hold — Hall A', '2026-10-06', ''],
      ['e13', 'work', 'Vendor drop-off — dock 2', '2026-09-29', '13:00', null, 'tv-warehouse'],
      ['e14', 'work', 'Lumber delivery', '2026-09-30', '14:00', null, 'tv-carpenters'],
    ].map(([id, calendarId, title, date, time, profileId, displayId]) => ({
      id: id!, calendarId: calendarId!, title: title!, date: d(date!), time: time || null,
      visibleToProfileId: profileId ?? null, visibleToDisplayId: displayId ?? null,
    })),
    displays: [
      { id: 'tv-warehouse', name: 'Warehouse TV', groupId: 'warehouse', pairingCode: null, paired: true, active: true, lastSeenAt: null },
      { id: 'tv-carpenters', name: 'Carpenters TV', groupId: 'carpenters', pairingCode: null, paired: true, active: true, lastSeenAt: null },
    ],
    invites: [],
  };
}
