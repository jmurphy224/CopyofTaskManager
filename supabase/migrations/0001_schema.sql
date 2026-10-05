-- Runsheet database: tables, sign-in rules and permissions.
--
-- Every rule on the "Roles & permissions" screen is enforced here with
-- row-level security (RLS), so it holds no matter how someone talks to the
-- database. The web app only hides buttons; this file is what actually
-- decides.

-- pgcrypto (digest, gen_random_bytes). Supabase installs it in the
-- "extensions" schema; the functions below look there too.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  -- Email domains allowed to sign in, without the @. CONFIRM THE REAL DOMAIN.
  allowed_domains text[] not null default array['fogarty.com'],
  -- true: only invited emails can sign in. false: any allowed-domain email
  -- can sign in and starts as a User with no groups.
  require_invite boolean not null default false
);
insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- People, groups, tags
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'manager', 'user');
create type public.recurrence as enum ('none', 'daily', 'weekdays', 'weekly');
create type public.calendar_provider as enum ('google', 'microsoft');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  short_name text not null,
  initials text not null,
  role public.app_role not null default 'user',
  color text not null default '#45423C',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, profile_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bg text not null default '#E6E3DC',
  fg text not null default '#45423C'
);

create table public.invites (
  email text primary key check (email = lower(email)),
  name text not null,
  role public.app_role not null default 'user',
  group_ids uuid[] not null default '{}',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shows (from Airtable) and tasks
-- ---------------------------------------------------------------------------

create table public.shows (
  number text primary key,
  name text not null default '',
  start_date date,
  venue text,
  airtable_record_id text,
  synced_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  notes text not null default '',
  assignee_id uuid not null references public.profiles (id),
  group_id uuid references public.groups (id) on delete set null,
  show_number text,
  due_date date not null,
  due_time time, -- null = end of business day (4:00 PM)
  done boolean not null default false,
  done_by uuid references public.profiles (id),
  done_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  push_to_calendar boolean not null default false,
  recurrence public.recurrence not null default 'none',
  spawned_next boolean not null default false
);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_group_idx on public.tasks (group_id);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Calendars
-- ---------------------------------------------------------------------------

create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  provider public.calendar_provider not null,
  email text not null,
  connected_by uuid references public.profiles (id) on delete set null,
  last_sync_at timestamptz
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.calendar_accounts (id) on delete cascade,
  external_id text,
  name text not null,
  color text not null default '#2F4DB3',
  shared boolean not null default false,
  show_events boolean not null default true,
  send_deadlines boolean not null default false
);
-- Only one calendar receives task deadlines.
create unique index calendars_one_deadline_target on public.calendars (send_deadlines) where send_deadlines;

-- ---------------------------------------------------------------------------
-- Shop TVs
-- ---------------------------------------------------------------------------

create or replace function public.random_pairing_code() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

create table public.displays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_id uuid not null references public.groups (id) on delete cascade,
  pairing_code text unique default public.random_pairing_code(),
  -- sha256 of the long-lived token the TV keeps. The token itself is never stored.
  token_hash text unique,
  paired boolean generated always as (token_hash is not null) stored,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  external_id text,
  title text not null,
  date date not null,
  time time, -- null = all day
  visible_to_profile_id uuid references public.profiles (id) on delete set null,
  visible_to_display_id uuid references public.displays (id) on delete set null,
  unique (calendar_id, external_id)
);
create index calendar_events_date_idx on public.calendar_events (date);

-- ---------------------------------------------------------------------------
-- Helper functions used by the policies
-- ---------------------------------------------------------------------------

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.is_manager_or_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'manager'), false);
$$;

create or replace function public.is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and profile_id = auth.uid());
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null;
$$;

-- Mirrors canEditTask() in src/lib/permissions.ts.
create or replace function public.can_edit_task(t public.tasks) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'admin' then true
    when 'manager' then
      case when t.group_id is not null then public.is_member(t.group_id)
           else t.created_by = auth.uid() or t.assignee_id = auth.uid() end
    when 'user' then t.created_by = auth.uid() and t.assignee_id = auth.uid()
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-in: Fogarty emails only
-- ---------------------------------------------------------------------------

-- Runs before Supabase creates any account. Rejects any email outside the
-- allowed domains (and, if require_invite is on, anyone not invited).
create or replace function public.enforce_allowed_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.app_settings;
  domain text := lower(split_part(new.email, '@', 2));
begin
  select * into s from public.app_settings where id = 1;
  if new.email is null or not (domain = any (s.allowed_domains)) then
    raise exception 'Only Fogarty email addresses can sign in to Runsheet.';
  end if;
  if s.require_invite and not exists (select 1 from public.invites where email = lower(new.email)) then
    raise exception 'You have not been invited to Runsheet yet. Ask an admin.';
  end if;
  return new;
end;
$$;

create trigger enforce_allowed_email before insert on auth.users
  for each row execute function public.enforce_allowed_email();

-- Creates the person's profile, applying their invite (role and groups) if any.
-- The very first person to sign in becomes an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
  full_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''));
  parts text[];
  first_admin boolean := not exists (select 1 from public.profiles);
begin
  select * into inv from public.invites where email = lower(new.email);
  full_name := coalesce(inv.name, full_name, split_part(new.email, '@', 1));
  parts := regexp_split_to_array(trim(full_name), '\s+');
  insert into public.profiles (id, email, name, short_name, initials, role)
  values (
    new.id, lower(new.email), full_name,
    case when array_length(parts, 1) > 1 then parts[1] || ' ' || left(parts[array_length(parts, 1)], 1) || '.' else parts[1] end,
    upper(left(parts[1], 1) || coalesce(left(parts[2], 1), '')),
    case when first_admin then 'admin' else coalesce(inv.role, 'user') end
  );
  if inv.email is not null then
    insert into public.group_members (group_id, profile_id)
      select unnest(inv.group_ids), new.id on conflict do nothing;
    delete from public.invites where email = inv.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tags enable row level security;
alter table public.invites enable row level security;
alter table public.shows enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.calendar_accounts enable row level security;
alter table public.calendars enable row level security;
alter table public.calendar_events enable row level security;
alter table public.displays enable row level security;

-- Settings: admins only.
create policy "admins read settings" on public.app_settings for select using (public.is_admin());
create policy "admins change settings" on public.app_settings for update using (public.is_admin());

-- People: every active person can see the team list (names, avatars).
-- Only admins change roles or switch people off.
create policy "team can see people" on public.profiles for select using (public.is_active_user());
create policy "admins change people" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Groups and tags: everyone sees them; managers and admins create and rename.
create policy "team can see groups" on public.groups for select using (public.is_active_user());
create policy "managers manage groups" on public.groups for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "team can see tags" on public.tags for select using (public.is_active_user());
create policy "managers manage tags" on public.tags for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

-- Group membership: everyone sees it; admins change it.
create policy "team can see memberships" on public.group_members for select using (public.is_active_user());
create policy "admins manage memberships" on public.group_members for all using (public.is_admin()) with check (public.is_admin());

-- Invites: admins only.
create policy "admins manage invites" on public.invites for all using (public.is_admin()) with check (public.is_admin());

-- Shows: everyone reads. Written only by the Airtable sync (service role).
create policy "team can see shows" on public.shows for select using (public.is_active_user());

-- Tasks: see own + groups' (users) or all (managers, admins).
create policy "see tasks" on public.tasks for select using (
  public.is_manager_or_admin()
  or (public.is_active_user() and (assignee_id = auth.uid() or (group_id is not null and public.is_member(group_id))))
);
-- Create: managers and admins for anyone; users only for themselves.
create policy "create tasks" on public.tasks for insert with check (
  created_by = auth.uid()
  and (public.is_manager_or_admin() or (public.is_active_user() and assignee_id = auth.uid()))
);
-- Edit and delete: see can_edit_task(). Completing goes through set_task_done().
create policy "edit tasks" on public.tasks for update using (public.can_edit_task(tasks)) with check (public.can_edit_task(tasks));
create policy "delete tasks" on public.tasks for delete using (public.can_edit_task(tasks));

create policy "see task tags" on public.task_tags for select using (
  exists (select 1 from public.tasks t where t.id = task_id)
);
create policy "edit task tags" on public.task_tags for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_task(t))
) with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_task(t))
);

-- Calendars: managers and admins manage; users see only calendars that hold
-- an event assigned to them (for its color).
create policy "managers manage calendar accounts" on public.calendar_accounts for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "see calendars" on public.calendars for select using (
  public.is_manager_or_admin()
  or exists (select 1 from public.calendar_events e where e.calendar_id = calendars.id and e.visible_to_profile_id = auth.uid())
);
create policy "managers manage calendars" on public.calendars for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "see events" on public.calendar_events for select using (
  public.is_manager_or_admin() or (public.is_active_user() and visible_to_profile_id = auth.uid())
);
create policy "managers manage events" on public.calendar_events for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

-- Shop TVs: admins only. TVs themselves use display_feed() below.
create policy "admins manage displays" on public.displays for all using (public.is_admin()) with check (public.is_admin());
-- Managers need the TV names for the event "Visible on ... TV" menu.
create policy "managers see displays" on public.displays for select using (public.is_manager_or_admin());
-- Nobody reads the token hash through the API: grant every column except it.
revoke select on public.displays from anon, authenticated;
grant select (id, name, group_id, pairing_code, paired, active, last_seen_at, created_at) on public.displays to authenticated;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Mark a task complete or not. The assignee, or any manager or admin.
-- Finishing a recurring task creates its next copy (once).
create or replace function public.set_task_done(p_task_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  next_date date;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if not (public.is_manager_or_admin() or (public.is_active_user() and t.assignee_id = auth.uid())) then
    raise exception 'Only the assignee, a manager or an admin can mark this complete.';
  end if;

  update public.tasks
     set done = p_done,
         done_by = case when p_done then auth.uid() end,
         done_at = case when p_done then now() end
   where id = p_task_id;

  if p_done and t.recurrence <> 'none' and not t.spawned_next then
    -- Same rule as nextOccurrence() in src/lib/dates.ts.
    next_date := t.due_date;
    loop
      if t.recurrence = 'weekly' then
        next_date := next_date + 7;
      else
        next_date := next_date + 1;
        if t.recurrence = 'weekdays' then
          while extract(isodow from next_date) > 5 loop next_date := next_date + 1; end loop;
        end if;
      end if;
      exit when next_date >= current_date;
    end loop;

    with copy as (
      insert into public.tasks (title, notes, assignee_id, group_id, show_number, due_date, due_time,
                                created_by, push_to_calendar, recurrence)
      values (t.title, t.notes, t.assignee_id, t.group_id, t.show_number, next_date, t.due_time,
              t.created_by, t.push_to_calendar, t.recurrence)
      returning id
    )
    insert into public.task_tags (task_id, tag_id)
      select copy.id, tt.tag_id from copy, public.task_tags tt where tt.task_id = t.id;

    update public.tasks set spawned_next = true where id = p_task_id;
  end if;
end;
$$;

-- Admin: give a TV a fresh pairing code (and unlink whatever TV used it before).
create or replace function public.new_pairing_code(p_display_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_admin() then raise exception 'Only admins can manage shop TVs.'; end if;
  code := public.random_pairing_code();
  update public.displays set pairing_code = code, token_hash = null where id = p_display_id;
  return code;
end;
$$;

-- A TV types in its pairing code once and gets a long-lived token back.
-- Callable without signing in.
create or replace function public.pair_display(p_code text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  d public.displays;
  token text := encode(gen_random_bytes(32), 'hex');
begin
  select * into d from public.displays where pairing_code = upper(trim(p_code)) and active;
  if not found then raise exception 'That code is not valid. Check the code on the Shop TVs page.'; end if;
  update public.displays
     set pairing_code = null, token_hash = encode(digest(token, 'sha256'), 'hex'), last_seen_at = now()
   where id = d.id;
  return token;
end;
$$;

-- What a TV shows: its group's tasks and its assigned events between two dates.
-- Callable without signing in, but only with a valid display token.
create or replace function public.display_feed(p_token text, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  d public.displays;
  result jsonb;
begin
  select * into d from public.displays
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') and active;
  if not found then raise exception 'This display has been switched off or removed.'; end if;
  update public.displays set last_seen_at = now() where id = d.id;

  select jsonb_build_object(
    'display', jsonb_build_object('id', d.id, 'name', d.name),
    'group', (select jsonb_build_object('id', g.id, 'name', g.name) from public.groups g where g.id = d.group_id),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'assigneeId', t.assignee_id, 'showNumber', t.show_number,
        'dueDate', t.due_date, 'dueTime', to_char(t.due_time, 'HH24:MI'), 'done', t.done)
        order by t.due_date, coalesce(t.due_time, '16:00'))
      from public.tasks t
      where t.group_id = d.group_id and t.due_date between p_from and p_to), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'short', p.short_name, 'initials', p.initials, 'color', p.color))
      from public.profiles p
      where p.id in (select assignee_id from public.tasks t where t.group_id = d.group_id and t.due_date between p_from and p_to)), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'date', e.date, 'time', to_char(e.time, 'HH24:MI')))
      from public.calendar_events e
      where e.visible_to_display_id = d.id and e.date between p_from and p_to), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.pair_display(text) from public;
revoke all on function public.display_feed(text, date, date) from public;
grant execute on function public.pair_display(text) to anon, authenticated;
grant execute on function public.display_feed(text, date, date) to anon, authenticated;
grant execute on function public.set_task_done(uuid, boolean) to authenticated;
grant execute on function public.new_pairing_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates for open screens
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.tasks, public.calendar_events;

-- ---------------------------------------------------------------------------
-- Starting groups and tags (rename or delete freely)
-- ---------------------------------------------------------------------------

insert into public.groups (name) values ('Production'), ('Creative'), ('Operations'), ('Warehouse'), ('Carpenters');
insert into public.tags (name, bg, fg) values
  ('Production', '#E1E7FA', '#243C8F'),
  ('Logistics', '#FBE4D2', '#86390A'),
  ('Creative', '#ECE3F8', '#523887'),
  ('Finance', '#DDF0E3', '#1F5A35'),
  ('Admin', '#E6E3DC', '#45423C'),
  ('Shop', '#F3E9C9', '#6A4F06'),
  ('Cleaning', '#D8EEF0', '#1D5560');
