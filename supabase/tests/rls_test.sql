-- Tests for the permission rules in supabase/migrations/0001_schema.sql.
-- Run with scripts/test-db.sh (needs a local Postgres 15+). Each check prints
-- PASS or stops with FAIL.
\set ON_ERROR_STOP 1
\set QUIET 1
-- helper: run a statement and report whether it failed
create or replace function pg_temp.fails(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;

-- 1. Sign-in domain
select pg_temp.ok(pg_temp.fails($q$insert into auth.users (email) values ('someone@gmail.com')$q$), 'gmail address is rejected');
select pg_temp.ok(pg_temp.fails($q$insert into auth.users (email) values ('x@fogarty.com.evil.com')$q$), 'look-alike domain is rejected');

-- 2. Profiles: first person becomes admin; invites apply role and groups
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a', 'joe.murphy@fogarty.com', '{"full_name":"Joseph Murphy"}');
select pg_temp.ok((select role from profiles where email='joe.murphy@fogarty.com') = 'admin', 'first sign-in becomes admin');
insert into invites (email, name, role, group_ids) select 'dana@fogarty.com', 'Dana Reyes', 'manager', array[id] from groups where name='Production';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'Dana@Fogarty.com');
select pg_temp.ok((select role from profiles where email='dana@fogarty.com') = 'manager', 'invite role applied (email case ignored)');
select pg_temp.ok(exists (select 1 from group_members gm join groups g on g.id=gm.group_id where profile_id='00000000-0000-0000-0000-00000000000d' and g.name='Production'), 'invite groups applied');
select pg_temp.ok(not exists (select 1 from invites where email='dana@fogarty.com'), 'invite used up');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000b', 'priya@fogarty.com', '{"name":"Priya Shah"}');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000c', 'marcus@fogarty.com', '{"name":"Marcus Lee"}');
select pg_temp.ok((select role from profiles where email='priya@fogarty.com') = 'user', 'uninvited sign-in starts as user');
select pg_temp.ok((select short_name || '|' || initials from profiles where email='priya@fogarty.com') = 'Priya S.|PS', 'short name and initials built');
insert into group_members select id, '00000000-0000-0000-0000-00000000000b' from groups where name='Production';
insert into group_members select id, '00000000-0000-0000-0000-00000000000c' from groups where name='Creative';

-- Seed tasks as the database owner
insert into tasks (id, title, assignee_id, group_id, due_date, created_by, recurrence) values
 ('10000000-0000-0000-0000-000000000001', 'Production task for Priya', '00000000-0000-0000-0000-00000000000b', (select id from groups where name='Production'), current_date, '00000000-0000-0000-0000-00000000000d', 'none'),
 ('10000000-0000-0000-0000-000000000002', 'Creative task for Marcus', '00000000-0000-0000-0000-00000000000c', (select id from groups where name='Creative'), current_date, '00000000-0000-0000-0000-00000000000a', 'none'),
 ('10000000-0000-0000-0000-000000000003', 'Production task for Dana', '00000000-0000-0000-0000-00000000000d', (select id from groups where name='Production'), current_date, '00000000-0000-0000-0000-00000000000d', 'none'),
 ('10000000-0000-0000-0000-000000000004', 'Sweep floor', '00000000-0000-0000-0000-00000000000b', (select id from groups where name='Production'), current_date - 3, '00000000-0000-0000-0000-00000000000d', 'daily');
insert into task_tags select '10000000-0000-0000-0000-000000000004', id from tags where name='Cleaning';

-- 3. As Priya (user, Production)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from tasks) = 3, 'user sees own + Production tasks only (3)');
select pg_temp.ok(not exists (select 1 from tasks where title like 'Creative%'), 'user cannot see other group''s task');
select pg_temp.ok(pg_temp.fails($q$insert into tasks (title, assignee_id, due_date) values ('x', '00000000-0000-0000-0000-00000000000c', current_date)$q$), 'user cannot assign a task to someone else');
select pg_temp.ok(not pg_temp.fails($q$insert into tasks (title, assignee_id, due_date) values ('My own task', '00000000-0000-0000-0000-00000000000b', current_date)$q$), 'user can create a task for themselves');
update tasks set title = 'hacked' where id = '10000000-0000-0000-0000-000000000003';
select pg_temp.ok((select title from tasks where id='10000000-0000-0000-0000-000000000003') <> 'hacked', 'user cannot edit someone else''s task');
update tasks set done = true where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.ok((select not done from tasks where id='10000000-0000-0000-0000-000000000001'), 'user cannot complete by direct update (must use set_task_done)');
select pg_temp.ok(pg_temp.fails($q$select set_task_done('10000000-0000-0000-0000-000000000003', true)$q$), 'user cannot complete a task assigned to someone else');
select set_task_done('10000000-0000-0000-0000-000000000001', true);
select pg_temp.ok((select done and done_by = '00000000-0000-0000-0000-00000000000b' from tasks where id='10000000-0000-0000-0000-000000000001'), 'assignee can complete their task');
select set_task_done('10000000-0000-0000-0000-000000000004', true);
select set_task_done('10000000-0000-0000-0000-000000000004', false);
select set_task_done('10000000-0000-0000-0000-000000000004', true);
select pg_temp.ok((select count(*) from tasks where title='Sweep floor') = 2, 'recurring task makes exactly one next copy');
select pg_temp.ok((select due_date from tasks where title='Sweep floor' and not done) = current_date, 'next copy of an overdue daily task is due today');
select pg_temp.ok((select count(*) from task_tags tt join tasks t on t.id=tt.task_id where t.title='Sweep floor') = 2, 'next copy keeps its tags');
select pg_temp.ok(pg_temp.fails($q$update profiles set role='admin' where id='00000000-0000-0000-0000-00000000000b' returning 1$q$) or (select role from profiles where id='00000000-0000-0000-0000-00000000000b')='user', 'user cannot make themselves admin');
select pg_temp.ok(pg_temp.fails($q$insert into invites (email, name) values ('a@fogarty.com','A')$q$), 'user cannot invite people');
select pg_temp.ok((select count(*) from calendar_events) = 0, 'user sees no unassigned calendar events');
reset role;

-- 4. As Dana (manager, Production)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select count(*) from tasks) >= 5, 'manager sees everyone''s tasks');
update tasks set title = 'renamed by manager' where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.ok((select title from tasks where id='10000000-0000-0000-0000-000000000002') <> 'renamed by manager', 'manager cannot edit a task in a group they are not in');
update tasks set title = 'Production task for Priya (edited)' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.ok((select title from tasks where id='10000000-0000-0000-0000-000000000001') like '%(edited)', 'manager can edit tasks in their group');
select set_task_done('10000000-0000-0000-0000-000000000002', true);
select pg_temp.ok((select done from tasks where id='10000000-0000-0000-0000-000000000002'), 'manager can complete any task');
select pg_temp.ok(not pg_temp.fails($q$insert into tasks (title, assignee_id, due_date) values ('Assigned by Dana', '00000000-0000-0000-0000-00000000000c', current_date)$q$), 'manager can assign to anyone');
select pg_temp.ok(not pg_temp.fails($q$insert into tags (name) values ('Safety')$q$), 'manager can add tags');
select pg_temp.ok(pg_temp.fails($q$insert into displays (name, group_id) select 'TV', id from groups limit 1$q$), 'manager cannot add shop TVs');
reset role;

-- 5. As Joe (admin): shop TVs and calendars
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into displays (name, group_id) select 'Warehouse TV', id from groups where name='Warehouse';
select pg_temp.ok((select length(pairing_code) from displays where name='Warehouse TV') = 6, 'new TV gets a 6-character pairing code');
select pg_temp.ok(pg_temp.fails($q$select token_hash from displays$q$), 'token hash cannot be read through the API');
insert into calendar_accounts (provider, email) values ('google', 'team@fogarty.com');
insert into calendars (account_id, name) select id, 'Production schedule' from calendar_accounts;
insert into calendar_events (calendar_id, title, date, visible_to_profile_id) select id, 'Pick up trailer', current_date, '00000000-0000-0000-0000-00000000000b' from calendars;
insert into calendar_events (calendar_id, title, date, visible_to_display_id) select c.id, 'Vendor drop-off', current_date, d.id from calendars c, displays d;
insert into tasks (title, assignee_id, group_id, due_date) select 'Load truck 1', '00000000-0000-0000-0000-00000000000b', id, current_date from groups where name='Warehouse';
select pg_temp.ok(not pg_temp.fails($q$update profiles set active = false where id = '00000000-0000-0000-0000-00000000000c'$q$), 'admin can switch someone off');
reset role;
select set_config('test.code', (select pairing_code from displays where name='Warehouse TV'), false);

-- 6. A TV with no one signed in
set role anon; set request.jwt.claim.sub = '';
select pg_temp.ok(pg_temp.fails($q$select pair_display('WRONG1')$q$), 'wrong pairing code is rejected');
select set_config('test.token', pair_display(current_setting('test.code')), false);
select pg_temp.ok(length(current_setting('test.token')) = 64, 'TV gets a long token');
select pg_temp.ok(pg_temp.fails(format('select pair_display(%L)', current_setting('test.code'))), 'pairing code only works once');
select pg_temp.ok((select (display_feed(current_setting('test.token'), current_date, current_date + 5) -> 'group' ->> 'name')) = 'Warehouse', 'feed shows the TV''s group');
select pg_temp.ok((select jsonb_array_length(display_feed(current_setting('test.token'), current_date, current_date + 5) -> 'tasks')) = 1, 'feed has only that group''s tasks');
select pg_temp.ok((select display_feed(current_setting('test.token'), current_date, current_date + 5) -> 'events' -> 0 ->> 'title') = 'Vendor drop-off', 'feed has only events put on this TV');
select pg_temp.ok(pg_temp.fails($q$select display_feed('not-a-token', current_date, current_date)$q$), 'bad token is rejected');
select pg_temp.ok((select count(*) from tasks) = 0, 'anonymous visitors see no tasks');
reset role;

-- 7. Back as Priya: the event assigned to her
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from calendar_events) = 1, 'user sees only the event assigned to them');
reset role;

-- 8. Marcus was switched off
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select count(*) from tasks) = 0 and (select count(*) from profiles) = 0, 'switched-off person sees nothing');
select pg_temp.ok(pg_temp.fails($q$select set_task_done('10000000-0000-0000-0000-000000000002', false)$q$), 'switched-off person cannot complete tasks');
reset role;
\echo ALL RLS TESTS PASSED
