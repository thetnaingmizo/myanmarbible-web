-- ============================================================
-- Bible bundles (3.0 M18): each Bible as one gzip'd JSON file in
-- public Storage, so a phone downloads it in ONE request (~3 MB for
-- Judson instead of 78 requests / 21 MB of uncompressed rows).
-- Written by scripts/export-bible-bundles.ts; the app falls back to
-- per-book rows when a bundle is missing.
-- ============================================================
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('bibles', 'bibles', true, array['application/gzip'])
on conflict (id) do update set public = true;
