-- New portal_type enum labels: admin_1, admin_2, head_of_coe.
-- MUST be in its own migration: PostgreSQL does not allow using new enum values
-- in the same transaction that added them (55P04). The follow-up migration
-- 20260505120100_portal_rename_auth_profiles.sql runs after this commits.

alter type public.portal_type add value if not exists 'admin_1';
alter type public.portal_type add value if not exists 'admin_2';
alter type public.portal_type add value if not exists 'head_of_coe';
