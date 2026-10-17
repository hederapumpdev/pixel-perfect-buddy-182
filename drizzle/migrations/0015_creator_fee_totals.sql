-- Lifetime creator fees: 30% of every trade fee goes to the coin creator.
-- Returns the total HBAR a creator has made (claimed + still claimable).
create or replace function public.creator_fee_totals(creators text[])
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(tr.fee), 0) * 0.3
  from public.trades tr
  join public.tokens tk on tk.address = tr.token and tk.network = tr.network
  where tk.creator = any(creators)
$$;

grant execute on function public.creator_fee_totals(text[]) to anon, authenticated, service_role;
