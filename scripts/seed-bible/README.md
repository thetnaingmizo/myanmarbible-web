# seed-bible

Downloads Bible translations from [eBible.org](https://ebible.org) in USFX XML format, parses them, and seeds the Supabase `translations`, `books`, and `verses` tables.

## Usage

```bash
npm run db:seed-bible                      # Seed all (Judson + KJV)
npm run db:seed-bible -- --only judson     # Myanmar Judson only
npm run db:seed-bible -- --only kjv        # KJV only
npm run db:seed-bible -- --download-only   # Download & parse, skip DB
npm run db:seed-bible:verify               # Verify seeded data
```

## How It Works

```
index.ts (entry point, CLI parsing)
  │
  ├─ download.ts   → Downloads USFX ZIP from eBible.org, extracts XML
  ├─ parse-usfx.ts → Parses USFX XML into { book, chapter, verse, text } records
  └─ seed.ts       → Upserts translations → books → verses into Supabase
```

### Pipeline

1. **Download**: Fetches `https://eBible.org/Scriptures/{ebibleId}_usfx.zip` and caches in `.data/`
2. **Parse**: Regex-based SAX-style parser reads USFX XML, extracts verse text per book/chapter/verse
3. **Seed**: Upserts in order — translation first, then books (matched by `translation_id + book_number`), then verses in batches of 500

### Idempotency

All inserts use `upsert` with conflict resolution:
- `translations` → ON CONFLICT `code`
- `books` → ON CONFLICT `translation_id, book_number`
- `verses` → ON CONFLICT `book_id, chapter_number, verse_number`

Re-running updates existing rows if source data changed.

## Translations

| Code | eBible ID | Language | Name | Verses |
|------|-----------|----------|------|--------|
| `judson` | `mya` | my | Judson Myanmar Bible (1835) | 29,768 |
| `kjv` | `eng-kjv2006` | en | King James Version | 31,102 |

Both are Public Domain.

## Config

`config.ts` contains:

- **`TRANSLATIONS`** — Array of translation sources with eBible IDs
- **`BOOKS`** — All 66 canonical books with metadata:
  - `bookNumber` (1-66), `usfxId` (2-letter USFX code)
  - `nameEn`, `nameMy`, `abbreviationEn`, `abbreviationMy`
  - `testament` ("OT" or "NT"), `chapterCount`
- **`IGNORED_USFX_BOOK_IDS`** — Non-canonical books to skip during parsing
- **Constants**: `INSERT_BATCH_SIZE` (500), `PROJECT_ROOT`, `DOWNLOAD_DIR`

## Database Tables

```
translations
  ├── id (uuid, PK)
  ├── code (unique)
  ├── name_en, name_my
  ├── language
  ├── is_default, is_licensed
  ├── license_info, source_url
  └── created_at, updated_at

books
  ├── id (uuid, PK)
  ├── translation_id (FK → translations)
  ├── book_number
  ├── name_en, name_my
  ├── abbreviation_en, abbreviation_my
  ├── testament ("OT" | "NT")
  ├── chapter_count
  └── UNIQUE(translation_id, book_number)

verses
  ├── id (uuid, PK)
  ├── book_id (FK → books)
  ├── chapter_number, verse_number
  ├── text
  └── UNIQUE(book_id, chapter_number, verse_number)
```

## Adding a New Translation

1. Find the translation on [ebible.org](https://ebible.org) and note its eBible ID
2. Add a new entry to the `TRANSLATIONS` array in `config.ts`:
   ```typescript
   {
     code: "niv",
     ebibleId: "eng-NIV",
     nameEn: "New International Version",
     nameMy: "NIV",
     language: "en",
     isDefault: false,
     licenseInfo: "...",
     sourceUrl: "https://ebible.org/find/details.php?id=eng-NIV",
   }
   ```
3. Run `npm run db:seed-bible -- --only niv`
4. Verify with `npm run db:seed-bible:verify`

> **Note**: Only add Public Domain or properly licensed translations.

## Downloaded Files

USFX XML files are cached in `scripts/seed-bible/.data/` (gitignored). Delete this folder to force re-download.

## Verification

`verify.ts` checks:
- Number of translations, books, and verses per translation
- Samples Genesis 1:1 from each translation to confirm text is present
