# Client area database (Supabase)
`migrations/` holds the schema for the EWS client area: profiles, products, sites, invoices, support_tickets, each with RLS.
Customers can read only their own rows; they may insert support tickets (status `open`) and edit their own profile.
Products, sites and invoices are written server-side only (service role / Stripe webhook), never from the browser.

Enable on a project: `supabase db push` (or apply the SQL), turn on Email (magic link) in Auth, set the Site URL / redirect to
`https://<preview>.elderworldstudio.pages.dev/account/`, then set Pages env vars `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`
(publishable/anon key only; `/api/client-config` refuses secret or service_role keys). Without them the client area runs in demo mode.

Receptionist integration slot: `products.kind = 'receptionist'`, `external_ref` = ews-agentkit agent id, `settings` jsonb for its config.
