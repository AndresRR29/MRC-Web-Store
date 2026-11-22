# Supabase setup

On a new Supabase project, run the complete `schema.sql` in the SQL Editor. It creates inventory, private orders, store settings, admin authorization, transactional checkout functions, and the product photo bucket.

Create your staff user from Authentication → Users. Copy the user ID and run this in the SQL Editor after replacing the placeholder.

```sql
insert into public.store_admins (user_id)
values ('YOUR-STAFF-USER-UUID'::uuid);
```

Use the project URL and public client key for the two Vite variables documented in the root README. Keep privileged server keys out of the storefront. In the admin dashboard, save the delivery settings before accepting orders, then upload your inventory.

Reservation expiry runs when the store reads the catalogue or orders and during checkout. To release expired reservations independently of store activity, schedule `select public.expire_store_orders();` in Supabase Cron every minute.
