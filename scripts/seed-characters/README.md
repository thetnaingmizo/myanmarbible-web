# seed-characters

Generates ~50 major Bible character profiles using Google Gemini (JSON mode) and seeds the Supabase `characters` table.

## Usage

```bash
npm run db:seed-characters
```

## Prerequisites

- **Supabase running** with migrations applied (`npm run db:start`)
- **Bible data seeded** — the script resolves verse references against the `books` and `verses` tables, so `npm run db:seed-bible` must have been run first
- **`GEMINI_API_KEY`** in `.env.local`

## How It Works

```
seed.ts (entry point)
  │
  ├─ character-list.ts  → Static list of characters with names & testament
  │
  └─ For each character:
       1. Call Gemini (JSON mode) to generate bilingual content
       2. Parse verse references from Gemini output
       3. Look up verse IDs in Supabase (books → verses)
       4. Upsert into characters table
       5. Wait 1s (rate limiting)
```

### Gemini Generation

For each character, the script sends a prompt to `gemini-2.0-flash` with `responseMimeType: "application/json"` requesting:

| Field | Description |
|-------|-------------|
| `name_my` | Myanmar/Burmese name (traditional Bible name) |
| `description_en` | One-line English tagline (max 100 chars) |
| `description_my` | Same tagline in Myanmar |
| `bio_en` | 2-3 paragraph English biography |
| `bio_my` | Same biography in Myanmar |
| `key_verses` | 3-5 verse references (e.g. "Genesis 1:27") |

### Verse Resolution

Verse references from Gemini (e.g. "Genesis 1:27") are resolved to UUIDs:
1. Normalize book name via `BOOK_NAME_MAP` (handles variations like "Psalm" → "Psalms")
2. Query `books` table by `name_en` (case-insensitive)
3. Query `verses` table by `book_id + chapter_number + verse_number`
4. Unresolved references are logged as warnings but don't fail the script

### Idempotency

Uses `upsert` with `onConflict: "slug"`. Re-running regenerates content from Gemini and overwrites existing rows.

## Character List

`character-list.ts` exports `CHARACTERS` — an array of `{ name, testament }` entries:

**Old Testament (33):** Adam, Eve, Noah, Abraham, Sarah, Isaac, Rebekah, Jacob, Rachel, Joseph, Moses, Aaron, Miriam, Joshua, Deborah, Gideon, Samson, Ruth, Hannah, Samuel, Saul, David, Solomon, Elijah, Elisha, Isaiah, Jeremiah, Ezekiel, Daniel, Esther, Nehemiah, Job, Jonah

**New Testament (18):** Jesus Christ, Mary (Mother of Jesus), Joseph of Nazareth, John the Baptist, Simon Peter, Andrew, James (Son of Zebedee), John the Apostle, Matthew, Thomas, Paul, Barnabas, Mary Magdalene, Martha, Lazarus, Stephen, Timothy, Luke

### Adding New Characters

Add entries to the `CHARACTERS` array in `character-list.ts`:
```typescript
{ name: "Elkanah", testament: "OT" },
```

Then re-run `npm run db:seed-characters`. Existing characters are updated; new ones are inserted.

## Database Table

```
characters
  ├── id (uuid, PK)
  ├── name_en (text, NOT NULL)
  ├── name_my (text)
  ├── slug (text, UNIQUE)        ← kebab-case from name_en
  ├── description_en (text)      ← One-line tagline
  ├── description_my (text)
  ├── bio_en (text)              ← Full biography
  ├── bio_my (text)
  ├── testament (text)           ← "OT" or "NT" (CHECK constraint)
  ├── key_verse_ids (uuid[])     ← FK references to verses.id
  ├── image_url (text)           ← Reserved for future use
  ├── status (content_status)    ← "draft" | "published" | "archived"
  ├── created_at (timestamptz)
  └── updated_at (timestamptz)
```

**Important**: The `testament` column has a CHECK constraint that only accepts `"OT"` or `"NT"` — not "old"/"new".

## Rate Limiting

- 1-second delay between Gemini API calls
- ~50 characters takes ~3-5 minutes depending on API response time
- Gemini free tier: 15 RPM for `gemini-2.0-flash` (this script uses ~1 RPM)

## Error Handling

- Individual character failures are logged and skipped (the script continues)
- The script exits with code 1 if any characters failed
- Common issues:
  - **Gemini JSON parse error**: Retry by re-running (idempotent)
  - **Verse not found**: Book name mismatch or verse doesn't exist in seeded data — logged as warning
  - **Testament CHECK constraint**: Ensure `character-list.ts` uses `"OT"`/`"NT"`, not `"old"`/`"new"`

## Output

```
=== Bible Characters Seed ===

Loaded environment from .env.local
Characters to process: 51

[1/51] Adam (adam)
  Generating content via Gemini...
  Resolving 4 verse references...
  Resolved 4/4 verses
  Done.

[2/51] Eve (eve)
  ...

=== Done in 180.5s — 51 succeeded, 0 failed ===
```
