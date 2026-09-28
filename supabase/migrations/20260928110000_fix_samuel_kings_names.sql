-- 1–2 Samuel and 1–2 Kings were seeded as "ဋ္ဌမ္မရာဇဝင်…" (a typo; the book is
-- ဓမ္မရာဇဝင် "Kings/Chronicles of the kingdom"). Fixes every Bible's rows.
update public.books
set name_my = replace(name_my, 'ဋ္ဌမ္မ', 'ဓမ္မ')
where book_number between 9 and 12 and name_my like 'ဋ္ဌမ္မ%';
