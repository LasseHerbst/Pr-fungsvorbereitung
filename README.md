Supabase setup: login_events table

This project records local login events in localStorage and attempts to sync them to a Supabase table named `login_events`.

Run the SQL below in Supabase SQL editor (or via psql) to create the table:

-- Create table for login events
CREATE TABLE public.login_events (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL,
  display_name text,
  action text NOT NULL DEFAULT 'login',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Recommended index for queries by profile and time
CREATE INDEX IF NOT EXISTS idx_login_events_profile_ts ON public.login_events (profile_id, timestamp DESC);

Notes
- The app attempts to POST to the REST endpoint `/rest/v1/login_events` using the configured SUPABASE_URL and SUPABASE_KEY in script.js. Ensure your Supabase project's REST settings and RLS policies allow inserts from the key you use.
- If you use Row Level Security (RLS), either disable it for this table or create a policy that allows the service key to insert rows.

Troubleshooting
- If events are not appearing in the Supabase table, check browser console for errors and run the `syncPendingLoginEvents()` function in the console to retry.
- The app stores events locally under the `loginEvents` key in localStorage; unsynced events have `synced:false`.

Example: verify with SQL
SELECT * FROM public.login_events ORDER BY timestamp DESC LIMIT 50;