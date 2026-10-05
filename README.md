# Runsheet: Work Task Manager

Runsheet is a task manager for the Fogarty team, similar to Asana but built
around how we work. It covers shows, load-ins, shop work and cleaning.

People sign in with their Fogarty email, see the tasks assigned to them and to
their groups, and check them off when they're done. Managers plan the week,
assign work and tie each task to a show number. Shop TVs show the day's work
for the Warehouse and Carpenters on a large, view-only screen.

> **Status: design mockup.** This repo holds the clickable mockup and this
> write-up of how the system works. Nothing is connected to a real database,
> login, calendar or Airtable yet; see [Roadmap](#roadmap). All names,
> tasks and show numbers in the mockup are sample data.

**View the live mockup:** https://claude.ai/artifact/5nokR4iRFrvGcD13A2iGWc

---

## Contents

1. [The big picture](#the-big-picture)
2. [Who uses it: roles](#who-uses-it-roles)
3. [Signing in: Fogarty emails only](#signing-in-fogarty-emails-only)
4. [How a task works](#how-a-task-works)
5. [Screens in the mockup](#screens-in-the-mockup)
6. [Groups and tags](#groups-and-tags)
7. [Show numbers and Airtable](#show-numbers-and-airtable)
8. [Calendar sync (Google and Microsoft)](#calendar-sync-google-and-microsoft)
9. [Shop TV displays](#shop-tv-displays)
10. [Full permissions table](#full-permissions-table)
11. [Everyday workflows](#everyday-workflows)
12. [Planned technology](#planned-technology)
13. [Data model (planned)](#data-model-planned)
14. [Roadmap](#roadmap)
15. [What's in this repo](#whats-in-this-repo)
16. [Open questions](#open-questions)

---

## The big picture

```
            Fogarty staff (phone / laptop)            Shop TVs (view only)
                       │                                      │
                       ▼                                      ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                     Runsheet web app                        │
        │  Week view · Month calendar · Task editor · Roles · TV view │
        └─────────────────────────────────────────────────────────────┘
                       │                 │                    │
                       ▼                 ▼                    ▼
              Database + login     Airtable (show      Google / Microsoft
              (Fogarty emails      numbers, read in)   calendars (events in,
               only)                                    deadlines out)
```

- **Tasks** are the core. Each one has a title, an assignee, a deadline and,
  optionally, a show number, a group and tags.
- **People** have a role (Admin, Manager or User) and belong to one or more
  groups.
- **Shop TVs** are separate display accounts that each show one group's tasks.
- **Airtable** supplies the list of show numbers, so nobody types them by hand.
- **Calendars** put meetings, load-ins and PTO next to the tasks, and can
  receive task deadlines as events.

---

## Who uses it: roles

| Role | Who it's for | In one sentence |
|------|--------------|-----------------|
| **Admin** | Team lead / system owner | Everything a manager can do, plus managing people, roles and the Airtable connection. |
| **Manager** | Department leads, production managers | Plans the work: creates, assigns and reassigns tasks, edits deadlines, closes any task, and manages calendars, tags and groups. |
| **User** | Everyone else | Sees their own and their groups' tasks, creates tasks for themselves, and checks off tasks assigned to them. |
| **Shop TV** | A screen in the warehouse or shop | Shows one group's tasks and assigned events. It can't change anything. |

**The one rule for closing tasks:** a task can be marked complete by **the
person it's assigned to**, or by **any manager or admin**. Nobody else can
close it.

---

## Signing in: Fogarty emails only

*Planned. The mockup doesn't include the sign-in screen yet.*

- People sign in with their Fogarty work account ("Sign in with Google" or
  "Sign in with Microsoft", depending on which Fogarty email runs on), or with
  a one-time email link.
- **Only Fogarty email addresses are accepted.** Any other address is turned
  away at sign-in. The same rule is also enforced in the database, so it
  can't be bypassed by calling the backend directly.
- **Creating users:** an admin uses **Invite person** on the Roles page to add
  someone and pick their role and groups ahead of time. Whether someone with a
  Fogarty email can also sign in *without* an invite (and start as a User) is
  an open question; see [Open questions](#open-questions).
- **Shop TVs don't need an email.** An admin creates a display (for example
  "Warehouse TV"), and the TV is linked once with a pairing code. An admin
  can switch it off at any time.

---

## How a task works

### Fields

| Field | Required? | Notes |
|-------|-----------|-------|
| **Title** | Yes | Short and action-first: "Load truck 1", "Confirm truck and driver for load-in". |
| **Notes** | No | Details, links, who to call. |
| **Assigned to** | Yes | One person. That person, or any manager or admin, can mark it complete. |
| **Share with group** | No | For example Production. Everyone in that group can see the task and comment on it. "No group" keeps it between the assignee and managers. |
| **Deadline date** | Yes | The day it's due. |
| **Deadline time** | No | **Blank means due by end of the business day (4:00 PM).** Set a time to override. |
| **Tags** | No | One or more labels (Production, Logistics, Creative, Finance, Admin) for filtering. |
| **Show number** | No | Ties the task to a show, e.g. `2417`. Typed in for now; later it becomes a search of show numbers from Airtable. Tasks with no show are "Shop task" (cleaning, maintenance, restocking). |
| **Add deadline to a synced calendar** | No | When on, the deadline is also added as an event on the chosen calendar (e.g. "Production schedule"). |

### Life of a task

```
  Created ──► Open ──► (deadline passes) ──► Overdue
    │          │                                │
    │          └──────────► Done ◄──────────────┘
    │                        │
    └── by a manager/admin   └── checked off by the assignee,
        (or a user, for          or by any manager/admin.
         themselves)             It can be un-checked if done by mistake.
```

| Status | When | How it looks |
|--------|------|--------------|
| **Upcoming** | Open, due on a later day | Normal |
| **Due today** | Open, due today, time not yet passed | Blue |
| **Overdue** | Open, deadline (date + time, or 4:00 PM) has passed | Orange/red |
| **Done** | Checked off | Greyed out with a strike-through |

---

## Screens in the mockup

The mockup has five screens. They're interactive, so you can click around in
them.

### 1. Week view: the home screen (`mockup/Main.dc.html`)

This is where everyone starts.

- **Preview as** switcher (mockup only): flips between Admin, Manager and User
  so you can see how the screen changes for each role.
- **Two layouts:** **Week list** (Monday–Sunday columns of tasks) and **Month
  calendar** (a month grid; click a task to open it).
- **Week navigation:** previous and next week, **This week**, and **Jump to**
  a date.
- **Whose tasks to show:**
  - **Assigned to me**: just your tasks.
  - **Me + my groups**: your tasks plus everything shared with your groups.
    This is the default for Users.
  - **Everyone**: all tasks, for managers and admins only. This is their
    default.
- **Filters:** by assignee (managers and admins) and by tag.
- **Counters:** how many tasks are open, done and overdue in the current view.
- **Each task card** shows a checkbox, title, show number, tags, group, due
  text (e.g. "Overdue · Mon 3:00 PM" or "Due Wed end of day") and the
  assignee's initials. If you aren't allowed to check off a task, its checkbox
  is locked and explains who can.
- **Calendar events** from synced calendars appear in each day next to the
  tasks. Managers and admins pick **who can see** each event: a specific user,
  or a shop TV ("Visible on Warehouse TV"). Users only see events that were
  assigned to them.
- **Sidebar:** search, **New task**, the list of connected calendars (with
  toggles), tags, and links to **Roles & permissions** (admins) and to
  calendar sync. There's also a placeholder for the Airtable connection.

### 2. Create / edit task (`mockup/TaskDetail.dc.html`)

This is the form for the fields listed in [How a task works](#fields). On the
right are:
- **Status:** the **Mark complete** checkbox, with a note on who's allowed to
  check it.
- **Who can do what:** a short permissions reminder that links to the full
  Roles page.

### 3. Calendar sync (`mockup/Calendars.dc.html`)

For managers and admins only. See [Calendar sync](#calendar-sync-google-and-microsoft).

### 4. Roles & permissions (`mockup/Roles.dc.html`)

For admins only.
- **What each role can do:** the full matrix (copied in
  [Full permissions table](#full-permissions-table)).
- **People:** everyone with their groups and a role drop-down.
- **Invite person** to add someone new.

### 5. Shop TV display (`mockup/TV.dc.html`)

A 1920×1080 dark screen for the shop floor. See [Shop TV displays](#shop-tv-displays).

---

## Groups and tags

**Groups** are teams of people: for example **Production**, **Creative**,
**Operations**, **Warehouse** and **Carpenters**.
- A person can be in more than one group (e.g. Production and Operations).
- Sharing a task with a group lets everyone in it see the task, which is
  useful for team-wide work like show prep.
- Each shop TV is tied to one group.

**Tags** are labels for sorting and filtering: **Production**, **Logistics**,
**Creative**, **Finance** and **Admin**. A task can have several tags.
Managers and admins create and edit tags and groups.

---

## Show numbers and Airtable

- Shows are identified by a **show number** (for example `2417`, `2421`).
- **Today (mockup):** the show number is typed in by hand.
- **Planned:** Runsheet reads the list of shows from our Airtable base on a
  schedule, plus a "refresh now" button. The show number field becomes a
  searchable drop-down (number + show name), so tasks always match a real show.
- Possible later extras: filter the week view by show, see every task for a
  show in one list, and write completion back to Airtable.
- The Airtable key stays on the server and is never sent to people's browsers.
  Only admins can change the Airtable connection settings.

---

## Calendar sync (Google and Microsoft)

- Managers and admins connect **Google** and **Microsoft 365 (Outlook)**
  accounts, including team members' calendars.
- For each calendar there are two settings:
  - **Show events:** the calendar's events appear read-only in the week view
    next to that day's tasks.
  - **Send deadlines:** choose one calendar that receives task deadlines as
    events (for example "Production schedule").
- Examples in the mockup: My work calendar, Production schedule, Venue holds,
  Team PTO, Load-in / load-out and Holidays.
- **Users can't connect or change calendars.** They only see an event once a
  manager or admin assigns it to them in the week view. That keeps personal and
  manager calendars private by default.
- *Backend (later):* Google and Microsoft sign-in (OAuth), background sync on a
  schedule, and change notifications so updates show up quickly.

---

## Shop TV displays

This covers general work like show prep and cleaning on a big screen.

- **One screen per area:** for example **Warehouse** and **Carpenters**. Each
  TV shows only its group's tasks.
- **Today** (left): the day's tasks in time order with status (Due today,
  Overdue or Done), show number or "Shop task", and who's on it. Calendar
  events assigned to that TV are listed too (e.g. "Vendor drop-off — dock 2",
  "Load-in — Show 2417").
- **Rest of this week** (right): the next five days of tasks and events at a
  glance.
- **Header:** the group name, today's date and a clock.
- **Footer counters:** open today, done and overdue.
- **View only:** *"Nothing can be changed from this screen. Tasks are checked
  off by the assignee on their own login."* People check things off on their
  phones, and the TV updates live.
- **Set-up (planned):** any TV with a full-screen web browser (a Fire Stick, a
  smart-TV browser, or a small PC). It's linked once with a pairing code, then
  stays signed in and refreshes itself.

Examples of TV-friendly tasks: *Stage truss and decking*, *Count and tag cable
trunks*, *Load truck 1*, *Fuel and inspect forklift*, *Restock expendables*,
*Hardware check on rolling risers*. Cleaning and shop jobs (no show number)
show as **Shop task**.

---

## Full permissions table

| Permission | Admin | Manager | User | Shop TV |
|------------|:-----:|:-------:|:----:|:-------:|
| See own assigned tasks | Yes | Yes | Yes | No |
| See their groups' tasks | Yes | Yes | Yes | Its one group |
| See everyone's tasks | Yes | Yes | No | No |
| Create tasks | Yes | Yes | For self only | No |
| Assign and reassign tasks | Yes | Yes | No | No |
| Mark a task complete | Any task | Any task | If assignee | No |
| Edit or delete any task | Yes | Their groups | No | No |
| Manage tags and groups | Yes | Yes | No | No |
| Connect and sync Google or Microsoft calendars | Yes | Yes | No | No |
| Assign calendar events to team members | Yes | Yes | No | No |
| See synced calendar events | Yes | Yes | Only events assigned to them | Only events assigned to it |
| Manage people and roles | Yes | No | No | No |
| Airtable connection settings | Yes | No | No | No |

In the real app these rules are enforced by the database itself, not just
hidden in the screens.

---

## Everyday workflows

**A manager plans show prep for Show 2417**
1. Opens the week view and clicks **New task**.
2. Enters "Confirm truck and driver for load-in", assigns it to Priya, shares
   it with **Production**, sets a deadline of Monday 3:00 PM, tags it
   **Logistics**, and sets the show number to **2417**.
3. Leaves **Add deadline to a synced calendar** on, so the deadline also goes
   on the Production schedule.
4. Saves. Priya and the rest of Production now see it.

**A team member finishes a task**
1. Opens Runsheet on their phone. They land on **Me + my groups**.
2. Ticks the checkbox on their task. It turns to **Done**, the counters update,
   and any shop TV showing it updates too.

**A daily cleaning job on the shop TV**
1. A manager creates "Sweep shop floor", assigns it to a Warehouse team
   member, shares it with the **Warehouse** group, and leaves the time blank
   (due 4:00 PM).
2. It appears on the Warehouse TV under **Today**. If it isn't done by 4:00 PM
   it turns **Overdue**.
3. *Planned:* recurring tasks (daily or weekly) so cleaning jobs don't need to
   be re-entered.

**An admin adds a new hire**
1. Opens **Roles & permissions** and clicks **Invite person**.
2. Enters their Fogarty email and picks their role (usually User) and groups.
3. The new hire signs in with their Fogarty account and sees their tasks right
   away.

---

## Planned technology

| Part | Plan | Why |
|------|------|-----|
| Web app | Next.js (React) | One app for phones, laptops and TVs. |
| Database + login | Supabase (Postgres + Auth) | Built-in Google/Microsoft sign-in, a domain lock to Fogarty emails, and row-level security for the permission rules. |
| Live updates | Supabase Realtime | TVs and other screens update within a second or two when a task changes. |
| Show numbers | Airtable API, server-side scheduled sync | Keeps the show list current without exposing the Airtable key. |
| Calendars | Google Calendar API + Microsoft Graph | Events in, deadlines out. |
| Hosting | Vercel | A free tier is enough for a small team. |

---

## Data model (planned)

```
profiles      id, email (Fogarty only), name, initials, role (admin|manager|user), active
groups        id, name                         e.g. Production, Warehouse, Carpenters
group_members group_id, profile_id
tags          id, name, color
shows         id, show_number, name, dates     synced from Airtable
tasks         id, title, notes, assignee_id, group_id?, show_id?,
              due_date, due_time? (blank = 4:00 PM), done, done_by, done_at,
              created_by, created_at, push_to_calendar
task_tags     task_id, tag_id
comments      id, task_id, author_id, body, created_at
displays      id, name, group_id, pairing_code, active          shop TVs
calendar_accounts  id, provider (google|microsoft), email, connected_by
calendars     id, account_id, name, color, show_events, send_deadlines
calendar_events    id, calendar_id, title, start, all_day, visible_to (profile or display)
```

---

## Roadmap

1. **Mockup** ✅ (this repo): screens, roles and rules agreed with the team.
2. **Core app:** Fogarty-only sign-in, people and roles, groups and tags,
   creating, assigning and completing tasks, week list and month calendar.
3. **Shop TVs:** display accounts with pairing codes, a live-updating TV
   screen, and recurring tasks for cleaning and shop jobs.
4. **Airtable:** show-number sync and a show picker on tasks.
5. **Calendars:** Google and Microsoft connections, events in the week view,
   deadlines sent to a calendar.
6. **Nice-to-haves:** email or phone notifications when assigned or overdue,
   comments, a per-show task list, and writing completion back to Airtable.

---

## What's in this repo

```
README.md                 this document
mockup/
  canvas.json             layout of the mockup canvas (screen list and positions)
  Main.dc.html            Week view (home screen) with role switcher
  TaskDetail.dc.html      Create / edit task
  Calendars.dc.html       Calendar sync settings
  Roles.dc.html           Roles & permissions and the people list
  TV.dc.html              Shop TV display (Warehouse / Carpenters)
```

The `.dc.html` files are the source of the screens in the Claude Design
canvas. They need that canvas's runtime to render, so **open the live link
above to click through them**. They aren't meant to be opened straight from
GitHub. The production app will be built as a standard web app in this repo.

---

## Open questions

- What is the exact Fogarty email domain (or domains)?
- Do Fogarty emails run on Google Workspace or Microsoft 365?
- Should admins invite everyone first, or can anyone with a Fogarty email sign
  in and get the User role automatically?
- Which Airtable base and table hold the show numbers, and which fields
  (number, name, dates, venue) should come across?
- How many shop TVs, which groups, and what hardware will drive them?
- Should the TVs ever allow tapping to complete a task, or stay view-only?
