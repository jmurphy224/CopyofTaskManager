# How Runsheet is built

A short technical tour for whoever maintains the code.

## Overview

```
Browser (phones, laptops, shop TVs)
  └─ React single-page app (Vite, TypeScript)          src/
       ├─ demo backend: sample data in localStorage    src/lib/demoBackend.ts
       └─ live backend: Supabase                       src/lib/liveBackend.ts
             ├─ Postgres + row-level security          supabase/migrations/0001_schema.sql
             ├─ Auth (Google, Microsoft, email link)
             ├─ Realtime (tasks, calendar events)
             └─ Edge Function: sync-shows ──► Airtable API
```

- **No custom server.** The app is static files. Supabase provides the
  database, sign-in and live updates. The one piece of server code is the
  Airtable sync function.
- **The database is the security boundary.** Every rule on the Roles &
  permissions screen is a Postgres row-level-security policy or a checked
  database function. The React code only decides what to show and enable.

## Code layout

```
src/
  main.tsx, App.tsx          entry point and routes (hash routing, so it works on GitHub Pages)
  styles.css                 all styles; tokens at the top follow the mockup
  lib/
    types.ts                 data types (Profile, Task, Display, ...)
    config.ts                environment settings, demo/live switch, email domain check
    dates.ts                 weeks, 4:00 PM default deadline, statuses, recurrence
    permissions.ts           the permission rules for the screens + the matrix text
    backend.ts               the Backend interface both modes implement
    demoBackend.ts           demo mode (enforces the same rules as the database)
    liveBackend.ts           Supabase reads/writes and realtime subscription
    seed.ts                  demo sample data (from the mockup), shifted to today
    store.tsx                React context: session, data, actions, notices
    useNow.ts                ticking clock so statuses stay current
    rules.test.ts            unit tests
  components/
    AppShell.tsx             top bar, sidebar, demo banner, notices
    ui.tsx                   icons, avatars, chips, segmented control
  pages/
    WeekPage.tsx             week list + month calendar
    TaskFormPage.tsx         new / edit task
    CalendarsPage.tsx        calendar sync settings
    PeoplePage.tsx           roles & permissions, invites, groups, tags
    DisplaysPage.tsx         shop TV admin
    ShowsPage.tsx            Airtable show numbers
    TvPage.tsx               shop TV display + pairing screen
    LoginPage.tsx            sign-in (demo picker or Fogarty sign-in)
supabase/
  migrations/0001_schema.sql tables, policies, functions, triggers, starting groups/tags
  functions/sync-shows/      Airtable → shows table
  tests/                     database permission tests (run by scripts/test-db.sh)
mockup/                      the original design: source, static pages, screenshots
docs/                        this documentation
```

## Data model

| Table | Holds | Notes |
|---|---|---|
| `app_settings` | Allowed email domains, require-invite switch | One row |
| `profiles` | One row per person: name, role, colour, active | Created by trigger on first sign-in |
| `groups`, `group_members` | Teams and who's in them | |
| `tags` | Labels with colours | |
| `invites` | Pending invites: email, role, groups | Applied and deleted on first sign-in |
| `shows` | Show number, name, start date, venue | Written only by `sync-shows` |
| `tasks` | Title, notes, assignee, group, show number, due date/time, done info, recurrence | `due_time` null = 4:00 PM |
| `task_tags` | Task ↔ tag | |
| `calendar_accounts`, `calendars` | Connected accounts; per-calendar *show events* / *send deadlines* | Only one calendar can receive deadlines (unique index) |
| `calendar_events` | Events, plus who they're shared with (a person or a TV) | |
| `displays` | Shop TVs: name, group, pairing code, hashed token, active | Token hash is not readable through the API |

## Security model

- **Sign-in:** a `before insert` trigger on `auth.users` rejects any email
  whose domain isn't in `app_settings.allowed_domains` (and, if
  `require_invite` is on, anyone not invited). An `after insert` trigger
  creates the profile and applies the invite. The first profile becomes admin.
- **Reading:** policies limit tasks to own + groups for users (all for
  managers and admins), events to those shared with the user, and settings,
  invites and TVs to admins.
- **Writing:** `create tasks` requires users to assign themselves.
  `can_edit_task()` decides edits and deletes.
- **Completing tasks** goes only through `set_task_done()`, which checks
  assignee-or-manager, records who and when, and creates the next copy of a
  recurring task once.
- **Switched-off people:** every helper treats an inactive profile as having
  no role, so they see and can do nothing.
- **Shop TVs** never sign in. `pair_display(code)` swaps a one-time code for a
  random 64-character token. Only its SHA-256 hash is stored.
  `display_feed(token, from, to)` returns that TV's group tasks and events and
  nothing else. Both are callable without signing in, and are useless without
  a valid code or token.
- **Airtable key** is a function secret. The function accepts only an admin's
  session or the service key.

## Testing

| What | Where | Run |
|---|---|---|
| Deadlines, statuses, weeks, recurrence, email domain, permission helpers, demo backend rule enforcement | `src/lib/rules.test.ts` | `npm test` |
| Every database permission rule, sign-in domain check, invites, recurrence, TV pairing and feed (43 checks) | `supabase/tests/rls_test.sql` | `scripts/test-db.sh` |
| Typecheck and build | | `npm run typecheck`, `npm run build` |

All of these run on every push (`.github/workflows/ci.yml`). The database
tests run against a real Postgres 16 with small stand-ins for Supabase's
`auth` schema and API roles (`supabase/tests/00_supabase_stub.sql`).

## Design

Colours, type (Bricolage Grotesque headings, IBM Plex Sans body, IBM Plex Mono
times and numbers), spacing and layouts follow the mockup in `mockup/`. The
style tokens are at the top of `src/styles.css`.
