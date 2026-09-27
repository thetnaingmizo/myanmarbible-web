-- ============================================================
-- JUDSON is now the real Judson Bible (1840, public domain) — the text
-- Myanmar Bible v2.1 bundled — instead of the Common Language Bible 2005
-- (eBible `mya`, © Bible Society of Myanmar inside Myanmar) that was seeded
-- under that name. Founder decision 2026-09-27: BCL is dropped until the
-- Bible Society gives permission. Verse text itself is (re)seeded by
-- scripts/seed-bible (`--only judson --prune`).
-- ============================================================

update public.translation_sources
   set name_local = 'ယုဒသန် မြန်မာကျမ်းစာ',
       name_en = 'Judson Bible (1840)',
       license = 'Public domain',
       source = 'Adoniram Judson, 1840 (as in Myanmar Bible v2.1)',
       approx_mb = 5.8
 where code = 'judson';

-- The separate "Judson 1840" entry is now the same Bible.
delete from public.translation_sources where code = 'myajvb';

-- The Common Language Bible can be requested; it needs the publisher's permission.
insert into public.translation_sources
  (code, name_local, name_en, language, language_group, scope, approx_mb, license, source, availability, note, sort_order)
values
  ('bcl', 'ခေတ်သုံး မြန်မာ ကျမ်းစာ', 'Burmese Common Language Bible (2005)', 'my', 'myanmar', 'full', null,
   '© Bible Society of Myanmar', 'Bible Society of Myanmar', 'needs_permission', null, 2)
on conflict (code) do nothing;

-- AI results cached from the old text no longer match the words people read.
delete from public.ai_verse_explanations
 where translation_id in (select id from public.translations where code = 'judson');
delete from public.ai_study_guides
 where translation_id in (select id from public.translations where code = 'judson');
delete from public.ai_verse_comparisons where translations like '%judson%';
delete from public.ai_word_renderings where translations like '%judson%';
