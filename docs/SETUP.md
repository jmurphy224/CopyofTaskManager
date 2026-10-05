# Setting up Runsheet

There are three ways to run Runsheet:

| | What you get | Needs |
|---|---|---|
| [A. Demo on your computer](#a-demo-on-your-computer) | The full app with sample data, in your browser only | Node.js 20+ |
| [B. Demo on GitHub Pages](#b-demo-on-github-pages) | The same demo at a web address you can share, plus the mockup | GitHub Pages turned on |
| [C. Live for the team](#c-live-for-the-team) | Real sign-in, shared data, shop TVs, Airtable | A Supabase project and a host |

---

## A. Demo on your computer

```bash
npm install
npm run dev          # http://localhost:5173
```

Leave `.env` empty (or don't create it) and the app runs in demo mode. Pick a
person to sign in as, and use **Preview as** in the top bar to switch roles.
**Reset demo data** puts the sample data back.

Other commands:

```bash
npm run typecheck    # TypeScript checks
npm test             # unit tests (deadlines, recurrence, email domain, permissions)
npm run build        # production build into dist/
scripts/test-db.sh   # database permission tests (needs a local Postgres)
```

## B. Demo on GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes on every push to
`main`:

- `https://<owner>.github.io/<repo>/`: the app in demo mode
- `https://<owner>.github.io/<repo>/mockup/`: the original design mockup

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**.

> GitHub Pages on a **private** repository needs a paid GitHub plan (Pro, Team
> or Enterprise). On a free plan, either make the repo public (the demo
> contains only sample data) or run the demo locally (option A). The page is
> public to anyone with the link even when the repo is private.

## C. Live for the team

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com). The free tier is
   enough for a small team.
2. Install the Supabase CLI and link the repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
3. **Set the email domain first.** Open
   `supabase/migrations/0001_schema.sql` and check the line:
   ```sql
   allowed_domains text[] not null default array['fogarty.com'],
   ```
   Put the real Fogarty domain(s) here. You can also change it later in the
   `app_settings` table.
4. Apply the schema:
   ```bash
   npx supabase db push
   ```
   This creates every table, the permission rules, the sign-in check, the
   starting groups (Production, Creative, Operations, Warehouse, Carpenters)
   and the starting tags.

### 2. Turn on sign-in

In the Supabase dashboard under **Authentication**:

- **URL configuration:** set the **Site URL** to where the app will live (e.g.
  `https://runsheet.example.com`) and add it to **Redirect URLs**.
- **Providers**, depending on where Fogarty email lives:
  - **Google** (Google Workspace): create an OAuth client in Google Cloud
    Console (type *Web application*), add Supabase's callback URL shown on the
    provider page, and paste the client ID and secret into Supabase. Setting
    the OAuth consent screen to **Internal** limits it to your Workspace.
  - **Azure** (Microsoft 365): register an app in Microsoft Entra ID, add the
    Supabase callback URL as a redirect URI, create a client secret, and paste
    the application ID, secret and tenant URL into Supabase. Using your tenant
    URL (not "common") limits it to your organization.
  - **Email**: on by default. Sends sign-in links. For real use, set up custom
    SMTP under *Authentication → Emails* so links don't hit Supabase's low
    sending limits.
- Whichever providers you use, the **database** still refuses any email
  outside `allowed_domains`.

**The first person to sign in becomes an admin.** Sign in yourself first.

Optional: to allow **only invited** people (rather than anyone with a Fogarty
email), run in the SQL editor:

```sql
update app_settings set require_invite = true;
```

### 3. Configure the app

Copy `.env.example` to `.env` and fill it in. Values are on Supabase's
**Project Settings → API** page:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_ALLOWED_EMAIL_DOMAINS=fogarty.com      # same list as app_settings
VITE_AUTH_PROVIDERS=google,azure,email      # which sign-in buttons to show
```

The anon key is safe to put in the web app. The permission rules in the
database are what protect the data. **Never** put the `service_role` key in
`.env` or anywhere in the web app.

### 4. Host the app

`npm run build` produces a static site in `dist/` that can be hosted anywhere:

- **Vercel** or **Netlify**: import the repo, build command `npm run build`,
  output folder `dist`, and add the `VITE_…` values as environment variables.
- **Cloudflare Pages**: same settings.

Add the final address to Supabase's **Redirect URLs**.

> Keep the GitHub Pages demo separate. It deliberately has no Supabase
> settings, so it always shows sample data.

### 5. Connect Airtable (show numbers)

1. In Airtable, create a **personal access token** with the
   `data.records:read` scope, limited to the base that holds the shows.
2. Note the **base ID** (starts with `app…`, it's in the base's API docs or
   URL), the **table name**, and the names of the fields for show number,
   show name, start date and venue.
3. Store them as function secrets and deploy the function:
   ```bash
   npx supabase secrets set \
     AIRTABLE_TOKEN=pat... \
     AIRTABLE_BASE_ID=app... \
     AIRTABLE_TABLE="Shows" \
     AIRTABLE_FIELD_NUMBER="Show Number" \
     AIRTABLE_FIELD_NAME="Show Name" \
     AIRTABLE_FIELD_START="Start Date" \
     AIRTABLE_FIELD_VENUE="Venue"
   # optional: AIRTABLE_VIEW="Active shows"
   npx supabase functions deploy sync-shows --no-verify-jwt
   ```
   (`--no-verify-jwt` is fine because the function checks the caller itself:
   only an admin's sign-in or the service key is accepted.)
4. In the app, open **Airtable show numbers** and press **Sync now**.
5. **Sync on a schedule** (hourly). In Supabase, enable the `pg_cron` and
   `pg_net` extensions (*Database → Extensions*), store the service key in
   Vault (*Project Settings → Vault*, name it `service_role_key`), then run in
   the SQL editor:
   ```sql
   select cron.schedule('sync-shows-hourly', '5 * * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/sync-shows',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
         'Content-Type', 'application/json'),
       body := '{}'::jsonb);
   $$);
   ```

### 6. Set up people

As the first admin, open **Roles & permissions**:

1. Check the groups (rename or add as needed).
2. **Invite person** for each team member, with their role and groups. Or let
   people sign in and then set their role and groups.
3. Add tags if you need more.

### 7. Set up shop TVs

1. Open **Shop TVs**, add a TV (e.g. "Warehouse TV") and pick its group.
2. On the TV's browser, open `https://<your app address>/#/tv/pair` and type
   the six-character code.
3. Set the browser to full screen / kiosk mode and to open that address on
   start-up. The TV stays linked and refreshes every 30 seconds.

Hardware that works well: a Fire TV Stick with the Silk browser, a smart-TV
browser, or a small PC or Raspberry Pi running Chromium in kiosk mode
(`chromium --kiosk https://…/#/tv`).

---

## Checklist before going live

- [ ] `allowed_domains` contains the real Fogarty domain(s), and matches
      `VITE_ALLOWED_EMAIL_DOMAINS`
- [ ] Google and/or Microsoft sign-in configured and limited to Fogarty
- [ ] Custom SMTP set up if email sign-in links are used
- [ ] Site URL and Redirect URLs point to the real app address
- [ ] You signed in first (you're the admin)
- [ ] Airtable secrets set, `sync-shows` deployed, hourly schedule added
- [ ] Team invited, groups set, TVs paired
