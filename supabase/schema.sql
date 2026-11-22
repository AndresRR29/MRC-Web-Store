-- Run once on a fresh Supabase project.
begin;

create table public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.store_admins enable row level security;
create function public.is_store_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.store_admins where user_id = auth.uid());
$$;
create table public.products (
  id uuid primary key,
  name text not null check (trim(name) <> ''),
  description text not null default '',
  category text not null,
  condition text not null,
  size text not null,
  color text not null,
  brand text not null default '',
  measurements text not null default '',
  material text not null default '',
  price numeric(12,2) not null check (price > 0),
  images text[] not null check (cardinality(images) > 0),
  status text not null default 'available' check (status in ('available','reserved','sold')),
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "Public catalogue" on public.products for select using (true);
create policy "Staff adds pieces" on public.products for insert to authenticated with check (public.is_store_admin() and status = 'available');
create policy "Staff edits pieces" on public.products for update to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create table public.store_settings (
  id boolean primary key default true check (id),
  data jsonb not null
);
insert into public.store_settings values (true,'{
  "storeName":"Tienda","phone":"","whatsapp":"","baseLatitude":19.4326,"baseLongitude":-99.1332,
  "homeMinimum":500,"meetingPoints":[],"transferHours":24,"bankInstructions":""
}');
alter table public.store_settings enable row level security;
create policy "Staff configures store" on public.store_settings for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create function public.read_store_settings() returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_store_admin() then data else data || '{"bankInstructions":""}'::jsonb end
  from public.store_settings where id;
$$;

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null check(status in ('awaiting_payment','confirmed','delivered','cancelled','expired')),
  customer_name text not null,
  phone text not null,
  delivery text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  payment text not null,
  total numeric(12,2) not null,
  bank_instructions text not null default '',
  items jsonb not null
);
create index store_orders_pending on public.store_orders(expires_at) where status='awaiting_payment';
alter table public.store_orders enable row level security;
create policy "Staff reads orders" on public.store_orders for select to authenticated using (public.is_store_admin());

-- Revoke implicit project-level grants; expose only the required paths.
revoke all on public.store_admins, public.products, public.store_orders, public.store_settings from anon,authenticated;
grant select on public.products to anon,authenticated;
grant insert, update(name,description,category,condition,size,color,brand,measurements,material,price,images) on public.products to authenticated;
grant select on public.store_orders to authenticated;
grant select, update(data) on public.store_settings to authenticated;

create function public.store_distance(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
returns float8 language sql immutable set search_path = '' as $$
  select 12742 * asin(sqrt(least(1.0, power(sin(radians(lat2-lat1)/2),2)
    +cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2))));
$$;

create function public.expire_store_orders() returns void
language plpgsql security definer set search_path = '' as $$
declare expired_order record;
begin
  for expired_order in
    select id,items from public.store_orders where status='awaiting_payment' and expires_at<=now()
    order by id for update skip locked
  loop
    update public.products set status='available' where status='reserved'
      and id in (select (item->>'id')::uuid from jsonb_array_elements(expired_order.items) item);
    update public.store_orders set status='expired' where id=expired_order.id;
  end loop;
end; $$;

create function public.order_receipt(o public.store_orders) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',o.id,'total',o.total,'payment',o.payment,'bankInstructions',o.bank_instructions,'expiresAt',o.expires_at);
$$;

create function public.place_store_order(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  request_key uuid := (input->>'requestId')::uuid;
  cfg jsonb; point jsonb; destination text; lat float8; lon float8;
  ordered public.store_orders; selected_ids uuid[]; snapshots jsonb; amount numeric;
  payment_method text := input->>'payment'; delivery_method text := input->>'delivery';
begin
  if request_key is null then raise exception 'Solicitud inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
  select * into ordered from public.store_orders where request_id=request_key;
  if found then return public.order_receipt(ordered); end if;

  if not coalesce(length(trim(input->>'customerName')) between 2 and 120,false)
    or not coalesce(regexp_replace(input->>'phone','[^0-9]','','g') ~ '^[0-9]{10,15}$',false)
    or not coalesce(payment_method in ('delivery','transfer'),false)
    or not coalesce(delivery_method in ('home','meeting'),false)
    then raise exception 'Revisa los datos de contacto, entrega y pago.'; end if;
  if not coalesce(jsonb_array_length(input->'productIds') between 1 and 100,false)
    then raise exception 'La bolsa debe contener entre 1 y 100 prendas.'; end if;
  select array_agg(distinct value::uuid) into selected_ids from jsonb_array_elements_text(input->'productIds');
  if cardinality(selected_ids)<>jsonb_array_length(input->'productIds') then raise exception 'Hay prendas repetidas.'; end if;
  perform public.expire_store_orders();
  perform id from public.products where id=any(selected_ids) order by id for update;
  select sum(price), jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price) order by id)
    into amount,snapshots from public.products where id=any(selected_ids) and status='available';
  if coalesce(jsonb_array_length(snapshots),0)<>cardinality(selected_ids)
    then raise exception 'Una prenda ya no está disponible. Revisa tu bolsa.'; end if;
  select data into strict cfg from public.store_settings where id for share;
  if delivery_method='meeting' then
    select value into point from jsonb_array_elements(cfg->'meetingPoints') where value->>'id'=input->>'meetingPointId';
    if point is null then raise exception 'Selecciona un punto de encuentro aprobado.'; end if;
    destination := concat(point->>'name',' · ',point->>'address');
    lat := (point->>'latitude')::float8; lon := (point->>'longitude')::float8;
  else
    if amount < (cfg->>'homeMinimum')::numeric then raise exception 'No se alcanza el mínimo para entrega a domicilio.'; end if;
    destination := trim(input->>'address');
    if not coalesce(length(destination) between 5 and 500,false) then raise exception 'Escribe tu dirección completa.'; end if;
    lat := (input->>'latitude')::float8; lon := (input->>'longitude')::float8;
  end if;
  if lat is null or lon is null or abs(lat)>90 or abs(lon)>180 or public.store_distance(
    (cfg->>'baseLatitude')::float8,(cfg->>'baseLongitude')::float8,lat,lon)>5
    then raise exception 'La ubicación debe estar a un máximo de 5 km de nuestra base.'; end if;
  if payment_method='transfer' and coalesce(trim(cfg->>'bankInstructions'),'')='' then raise exception 'La transferencia aún no está configurada.'; end if;
  insert into public.store_orders(request_id,status,expires_at,customer_name,phone,delivery,address,latitude,longitude,payment,total,bank_instructions,items)
    values(request_key,case when payment_method='transfer' then 'awaiting_payment' else 'confirmed' end,
      case when payment_method='transfer' then now()+make_interval(hours=>(cfg->>'transferHours')::int) end,
      trim(input->>'customerName'),trim(input->>'phone'),delivery_method,destination,lat,lon,payment_method,amount,
      case when payment_method='transfer' then cfg->>'bankInstructions' else '' end,snapshots)
    returning * into ordered;
  update public.products set status='reserved' where id=any(selected_ids);
  return public.order_receipt(ordered);
end; $$;

create function public.update_store_order(order_id uuid, next_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.store_orders;
begin
  if not public.is_store_admin() then raise exception 'Se requiere acceso de administración.'; end if;
  perform public.expire_store_orders();
  select * into strict target from public.store_orders where id=order_id for update;
  if target.status=next_status then return; end if;
  if not ((target.status='awaiting_payment' and next_status in ('confirmed','cancelled'))
    or (target.status='confirmed' and next_status in ('delivered','cancelled'))) then raise exception 'El cambio de estado no es válido.'; end if;
  update public.store_orders set status=next_status,expires_at=null where id=order_id;
  if next_status in ('cancelled','delivered') then
    update public.products set status=case when next_status='cancelled' then 'available' else 'sold' end
    where id in (select (item->>'id')::uuid from jsonb_array_elements(target.items) item);
  end if;
end; $$;

revoke execute on function public.update_store_order(uuid,text) from public,anon;
grant execute on function public.update_store_order(uuid,text) to authenticated;
grant execute on function public.expire_store_orders(),public.place_store_order(jsonb), public.read_store_settings(),public.is_store_admin() to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/webp','image/png']);
create policy "Staff uploads product photos" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and public.is_store_admin());


alter table public.store_settings add column configured boolean not null default false;
create function public.store_configured() returns trigger language plpgsql set search_path = '' as $$
begin
  new.configured := true;
  return new;
end; $$;
create trigger store_configured before update of data on public.store_settings
for each row execute function public.store_configured();
create function public.require_store_configuration() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.store_settings where id and configured) then
    raise exception 'La tienda aún está preparando sus entregas.';
  end if;
  return new;
end; $$;
create trigger require_store_configuration before insert on public.store_orders for each row execute function public.require_store_configuration();

create function public.save_store_product(product jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare prior public.products; field_data public.products;
begin
  if not public.is_store_admin() then raise exception 'Se requiere acceso de administración.'; end if;
  select * into field_data from jsonb_populate_record(null::public.products,product);
  select * into prior from public.products where id=field_data.id for update;
  if not found then
    if field_data.status='reserved' then raise exception 'Las reservas se generan al hacer un pedido.'; end if;
    field_data.created_at := now();
    insert into public.products select field_data.*;
  else
    if (prior.status='reserved') <> (field_data.status='reserved') then
      raise exception 'La disponibilidad cambió. Actualiza el catálogo antes de editar.';
    end if;
    update public.products set name=field_data.name,description=field_data.description,
      category=field_data.category,condition=field_data.condition,size=field_data.size,color=field_data.color,
      price=field_data.price,images=field_data.images,brand=field_data.brand,measurements=field_data.measurements,
      material=field_data.material,status=field_data.status where id=field_data.id;
  end if;
end; $$;
revoke insert,update(name,description,category,condition,size,color,brand,measurements,material,price,images)
on public.products from authenticated;
revoke execute on function public.save_store_product(jsonb) from public,anon;
grant execute on function public.save_store_product(jsonb) to authenticated;

commit;
