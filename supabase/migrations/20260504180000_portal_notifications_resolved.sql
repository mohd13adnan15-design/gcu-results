-- Track Super Admin resolution of faculty/admin issue reports.
alter table public.portal_notifications
  add column if not exists is_resolved boolean not null default false;

alter table public.portal_notifications
  add column if not exists resolved_at timestamptz;

create index if not exists portal_notifications_super_admin_unresolved_idx
  on public.portal_notifications (created_at desc)
  where recipient_portal = 'super_admin' and is_resolved = false;
