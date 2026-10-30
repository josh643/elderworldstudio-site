-- EWS client area (private preview). Every table has RLS; users only see their own rows.
-- The service-role key is never shipped to the browser; the browser uses the publishable/anon key + the user's JWT.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  business_name text check (char_length(business_name) <= 150),
  phone text check (char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('web_builder','receptionist','review_assistant','photo_studio','pos')),
  status text not null default 'not_active' check (status in ('not_active','trial','active','paused','canceled')),
  plan text check (plan in ('starter','business','plus') or plan is null),
  -- integration slot: external system id (e.g. ews-agentkit receptionist agent id)
  external_ref text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 150),
  domain text check (char_length(domain) <= 253),
  plan text not null default 'starter' check (plan in ('starter','business','plus')),
  status text not null default 'draft' check (status in ('draft','preview','live','paused')),
  builder_lead_id text,           -- link to the web builder's BUILD_LEADS record
  preview_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_invoice_id text unique,  -- filled by a server-side Stripe webhook only
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft','open','paid','void','uncollectible')),
  description text,
  hosted_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 150),
  category text not null default 'general' check (category in ('general','website','receptionist','billing','pos','add-ons')),
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'open' check (status in ('open','pending','closed')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sites enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;

create policy "profiles self select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles self insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles self update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- products/sites/invoices: read-only to customers; writes happen server-side (service role / webhooks)
create policy "products own select" on public.products for select to authenticated using ((select auth.uid()) = user_id);
create policy "sites own select" on public.sites for select to authenticated using ((select auth.uid()) = user_id);
create policy "invoices own select" on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy "tickets own select" on public.support_tickets for select to authenticated using ((select auth.uid()) = user_id);
create policy "tickets own insert" on public.support_tickets for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open');

create index if not exists products_user_idx on public.products(user_id);
create index if not exists sites_user_idx on public.sites(user_id);
create index if not exists invoices_user_idx on public.invoices(user_id);
create index if not exists tickets_user_idx on public.support_tickets(user_id, created_at desc);

-- new users get a profile and the five product slots in 'not_active'
create or replace function public.handle_new_client() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.products (user_id, kind)
    select new.id, k from unnest(array['web_builder','receptionist','review_assistant','photo_studio','pos']) k
    on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_client() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_client on auth.users;
create trigger on_auth_user_created_client after insert on auth.users for each row execute function public.handle_new_client();
