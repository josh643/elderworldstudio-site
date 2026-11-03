-- Allow the $99 one-time plan on sites / products. D1 remains the sellable source of truth;
-- this keeps the optional Supabase client-area schema in sync.
alter table public.sites drop constraint if exists sites_plan_check;
alter table public.sites add constraint sites_plan_check check (plan in ('starter','business','plus','take_it'));
alter table public.products drop constraint if exists products_plan_check;
alter table public.products add constraint products_plan_check check (plan in ('starter','business','plus','take_it') or plan is null);
