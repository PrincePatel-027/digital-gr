# Digital GR — Project Context

> A single-file, hand-off-ready briefing on this repository. Paste or attach this to
> Claude (or any coding agent) to give it full context on what the project is, how it
> is built, and how every pipeline and module fits together.

Last compiled from source: covers all app/API routes, OCR and voice pipelines,
components, tests, Supabase migrations, and setup/provisioning scripts.

---

## 1. What this project is

**Digital GR** is a **multi-tenant web application that digitizes school General
Registers (GR)** — the official, handwritten student-admission ledgers (જનરલ રજિસ્ટર)
kept by primary schools in Gujarat, India.

The core idea: instead of relying on fragile paper registers (vulnerable to fire,
flood, termites, and decay), a staff member either **photographs a register page** for
Gujarati OCR/AI extraction or uses **English voice entry**: either four guided groups for
one student or one free-form recording for several students. Gemini returns English and
ગુજરાતી values together from the same audio response; clerks can switch scripts without a
second conversion request and must view AI-sourced required names in Gujarati before save.
Every path requires the staff member to verify/correct values and explicitly save them to a
secure, searchable, cloud-backed database. Multi-student voice results receive an editable
batch review and are inserted sequentially so one bad row does not roll back successful
rows. Scans remain attached; voice-only records intentionally have no image and submitted
audio is never stored.

- **Domain language:** Gujarati (with English sub-labels throughout the UI).
- **Scale target:** small — under ~500 records per school to start; hundreds of rows,
  not millions. No heavy performance engineering needed at this scale.
- **Cost target (original):** run on genuinely free infrastructure tiers.
- **Users:** school staff, principals, school admins, and a cross-tenant super admin.

The canonical product spec lives at [`assests/PRD-Digital-GR-System.md`](assests/PRD-Digital-GR-System.md)
(note: the `assests/` folder name is misspelled in the repo). A whole-project audit and
pipeline test report lives at [`AUDIT_REPORT.md`](AUDIT_REPORT.md).

### The physical register (domain knowledge that drives the code)

A GR is an open two-page spread. The extraction code encodes this layout explicitly:

- **Left page — પત્રક ૪ (Patrak 4), "મુખ્ય વિગતો" / main details**:
  register number, full name (`પુરૂં નામ`, written as *given · father's · surname*),
  religion + caste (`જાત તથા પેટા જાત`), birth place, date of birth, and previous school.
- **Right page — પત્રક ૫ (Patrak 5), "શૈક્ષણિક વિગતો" / academic details**:
  admission date and admission standard are the first two unstarred columns; the starred
  leaving section follows with leaving date, standard at leaving, progress & conduct,
  reason for leaving, and leaving-certificate remarks.

Correctly separating **admission** columns from **leaving** columns is a recurring
theme in the prompts and sanitization logic, because both pages carry a
"date + standard" pair that models otherwise confuse.

---

## 2. IMPORTANT: PRD vs. actual implementation (design drift)

The PRD and the shipped code differ on extraction and entry paths. **Trust the code.**

| Concern | PRD said | Code actually does |
|---|---|---|
| OCR provider | Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) | **Sarvam Document AI** (Vision 1.5, Indic-specialised) is the raw-text anchor, with **OCR.space** as fallback; then a chain of **AI vision/LLM providers** structures the row |
| Field mapping | "best-effort" regex/heuristic parsing, treated as nice-to-have | A multi-provider **AI extraction chain** is primary; the heuristic parser is only a client-side fallback |
| "AI" in system | None beyond cloud OCR (per the older audit) | Multiple LLM/VLM providers are first-class in the server pipeline |
| Voice entry | Not specified | **English (`en-IN`) dictation** supports four-group single-student and one-recording multi-student extraction. One Gemini response carries the transcript plus English/ગુજરાતી field values; review has script toggles, provenance markers, Gujarati-name gating, and explicit sequential saves |

`AUDIT_REPORT.md` predates both the shared provider chain and grouped voice entry. Since
that audit, `lib/ocr-pipeline.ts`, the OCR routes/adapters, `lib/voice-pipeline.ts`,
`app/api/voice-entry/route.ts`, and their supporting provider modules were added. When in
doubt, `.env.local.example` and the current pipeline files reflect the shipped design.

---

## 3. Tech stack

| Layer | Technology / notes |
|---|---|
| Framework | **Next.js 16.2.9** (App Router, Turbopack) — see the warning in §12 |
| UI runtime | **React 19.2.4**, React DOM 19.2.4 |
| Language | **TypeScript 5** (strict), path alias `@/*` → repo root |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`), custom "neumorphic/ledger" design system in `app/globals.css` |
| Fonts | `next/font/google`: Spectral, IBM Plex Sans, IBM Plex Mono, Noto Sans + Noto Serif Gujarati |
| Backend | **Supabase** — Postgres + Auth + Storage + Row Level Security, via `@supabase/supabase-js` |
| Image processing | **sharp** (preprocessing, page split, guided 2×3 tile inspection/reconstruction) |
| Raw OCR anchor | **Sarvam Document AI** (Vision 1.5) primary; **OCR.space** fallback |
| AI extraction | **Sarvam Document AI**, **Google Gemini** (vision, text, and grouped audio), **OpenAI GPT‑5**, **Mistral**, and **Sarvam** chat |
| Analytics | Vercel Analytics + Speed Insights |
| Tooling | `tsx`, `postgres`, ESLint 9, **Vitest 4.1.11** |
| Hosting target | Vercel |

**npm scripts** (`package.json`): `dev`, `build`, `start`, `lint`, `test`, plus platform
preflight scripts. `npm test` runs Vitest once (`vitest run`). Lint/tests are not yet
wired into a repository CI workflow.

---

## 4. Repository structure

```
digital-gr/
├─ AGENTS.md                     # Agent rules (Next.js 16 breaking-changes warning) — READ §12
├─ AUDIT_REPORT.md               # Earlier whole-project audit; some findings predate current code
├─ PROJECT_CONTEXT.md            # ← this file
├─ .env.local.example            # Server/provider configuration template
├─ vitest.config.mts             # Vitest config + server-only alias
│
├─ app/                          # Next.js App Router
│  ├─ layout.tsx                 # Root layout: fonts, AuthProvider, analytics, metadata
│  ├─ page.tsx                   # Public bilingual landing page
│  ├─ not-found.tsx              # 404
│  ├─ globals.css                # Tailwind v4 + neumorphic/ledger design tokens & classes
│  ├─ login/page.tsx             # Email/password sign-in (Supabase Auth)
│  ├─ dashboard/
│  │  ├─ layout.tsx              # Auth-gated shell and role-based navigation
│  │  ├─ page.tsx                # Register stats and recent entries
│  │  ├─ records/
│  │  │  ├─ page.tsx             # Search/filter/sort/print records
│  │  │  ├─ new/page.tsx         # Create via scan or grouped voice entry
│  │  │  ├─ compare/page.tsx     # OCR-engine comparison diagnostic
│  │  │  ├─ voice-compare/page.tsx # Gemini audio model comparison diagnostic
│  │  │  └─ [id]/
│  │  │     ├─ page.tsx          # Detail, optional scan/audit, delete
│  │  │     └─ edit/page.tsx     # Edit via GRRecordForm
│  │  ├─ schools/page.tsx        # super_admin school provisioning
│  │  └─ staff/page.tsx          # school_admin staff/principal management
│  └─ api/
│     ├─ ocr-test/route.ts       # Single-image/compare adapter + health
│     ├─ ocr-scan/route.ts       # Authenticated guided reconstruction/OCR
│     ├─ voice-entry/
│     │  ├─ route.ts             # Authenticated/rate-limited audio extraction + health/compare
│     │  └─ route.test.ts        # Route validation/auth/rate-limit/dispatch tests
│     └─ admin/
│        ├─ schools/route.ts
│        └─ users/route.ts
│
├─ components/
│  ├─ GRRecordForm.tsx           # ★ Shared single review + multi batch orchestration
│  ├─ VoiceEntryRecorder.tsx     # ★ Single/Multiple voice-mode shell
│  ├─ GroupedVoiceEntryRecorder.tsx # Unchanged four-group single-student recorder
│  ├─ MultiVoiceEntryRecorder.tsx # One-recording multi-student capture/extraction
│  ├─ VoiceBatchReview.tsx       # Provider-neutral editable row review/status UI
│  ├─ GuidedRegisterScanner.tsx  # Mobile overview + six close-ups
│  └─ ImageUploader.tsx          # Per-school Storage upload widget
│
├─ lib/
│  ├─ supabase.ts                # Browser Supabase client (anon key)
│  ├─ auth-context.tsx           # Browser auth/session/profile provider
│  ├─ server-auth.ts             # Server bearer + active-profile/role authorization
│  ├─ gr-record-data.ts          # Pure form model and database payload mapper
│  ├─ ocr-types.ts               # Client-safe OCR/compare/quality contracts
│  ├─ ocr-pipeline.ts            # Shared server-only OCR provider orchestration
│  ├─ reconstruct-register.ts    # Sharp quality checks + deterministic tiled reconstruction
│  ├─ ocr.ts                     # Sarvam raw anchor, OCR.space fallback, page split
│  ├─ sarvam-doc-ai.ts           # Sarvam digitise + schema extract
│  ├─ image-prep.ts              # Shared mobile-photo preprocessing
│  ├─ extract-shared.ts          # Shared 21-field contract, mapper, retry, sanitizer
│  ├─ gemini-extract.ts          # Gemini vision/text extraction
│  ├─ openai-extract.ts          # OpenAI vision extraction
│  ├─ mistral-extract.ts         # Mistral vision extraction
│  ├─ sarvam-structure.ts        # Sarvam text structuring
│  ├─ ocr-parser.ts              # Client-side heuristic fallback + shared field types
│  ├─ voice-types.ts             # Client-safe voice API contracts
│  ├─ voice-fields.ts            # Four groups + spoken English normalization
│  ├─ gemini-audio.ts            # Server-only Gemini audio/schema adapter
│  ├─ voice-pipeline.ts          # Server-only production/compare/health orchestration
│  ├─ voice-merge.ts             # Client-safe deterministic bilingual group merge/audit builder
│  ├─ voice-bilingual.ts         # Dual-script conversion, LGD canonicalization, provenance, hydration
│  ├─ voice-persistence.ts       # Gujarati-column + fields_en single/batch payload builders
│  ├─ gujarat-locations.ts       # Generated 2026-05-31 LGD district/sub-district catalog
│  ├─ gr-record-batch.ts         # Provider-neutral validation/preflight/sequential row saves
│  ├─ *.test.ts                  # Co-located Vitest unit tests for voice/data helpers
│  ├─ gujarati.ts                # Gujarati numeral/date/standard formatting
│  └─ setup-*.ts                 # One-time DB and Storage bootstrap scripts
│
├─ test/server-only.ts           # Empty Vitest shim for Next's server-only marker
├─ scripts/                      # Migration/provisioning/tenancy/platform checks
│  └─ generate-gujarat-locations.mjs # Refreshes the pinned LGD location module
├─ supabase/migrations/          # Ordered schema and RLS migrations
├─ assests/                      # (sic) PRD + brochure/ledger PDFs
├─ Sample-img/                   # Real Gujarati register scans used for manual testing
└─ public/                       # Static SVGs
```

★ = the most important files to read first.

---

## 5. Environment variables

All variables are documented in [`.env.local.example`](.env.local.example). Copy it to
`.env.local`; never expose the server-only values to browser code.

**Supabase (required):**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser/server project configuration.
- `SUPABASE_SERVICE_ROLE_KEY` — **full RLS bypass**, server routes and setup scripts only.
- `SUPABASE_DB_PASSWORD` — direct Postgres setup/migration scripts only.

**OCR extraction providers:**
- `SARVAM_API_KEY` (+ optional `SARVAM_DOC_AI_CONTENT_TYPE`, `SARVAM_DOC_AI_MODEL`, `SARVAM_MODEL`).
- `GEMINI_API_KEY` (+ optional vision/text `GEMINI_MODEL`).
- `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`).
- `MISTRAL_API_KEY` (+ optional `MISTRAL_MODEL`).
- `OCR_SPACE_API_KEY` — fallback raw-OCR anchor.

**OCR tuning (optional):** `OCR_PREPROCESS`, `OCR_EXTRACTOR_ORDER`,
`OCR_DEBUG_COMPARE`, `OCR_COMPARE_GEMINI_MODELS`, and `OCR_COMPARE_OPENAI_MODELS`.

**English voice input with dual-script output (single and multi):** no new credential is
required; the server reuses `GEMINI_API_KEY` and never sends it to the client. Both scripts
are returned by the configured audio model in one response; toggling scripts makes no
provider request.
- `GEMINI_AUDIO_MODEL` — production audio model, default `gemini-3.7-flash`.
- `VOICE_EXTRACTOR_ORDER` — production order, default and only registered v1 key:
  `gemini-audio`.
- `VOICE_LANGUAGE` — documented/pinned to `en-IN`; v1 rejects every other language.
- `VOICE_MAX_ENTRIES` — maximum accepted expected-count hint and client review batch,
  default `10` and clamped to `1–10`. The UI recommends at most 6 per recording for
  stronger segmentation.
- `VOICE_DEBUG_COMPARE` — enables the paid `?debug=all` path and comparison page. Leave
  unset/off in production.
- `VOICE_COMPARE_GEMINI_MODELS` — comma-separated models run in parallel by the voice
  comparison tool. The default is the configured/default production model plus
  `gemini-2.5-flash`.

If no OCR provider key is set, the scan endpoint can still return raw text for manual
entry. Voice health reports unconfigured, and voice extraction is unavailable, when
`GEMINI_API_KEY` is absent.

> **Security note:** the service-role key, DB password, and AI keys are sensitive. Keep
> real values only in `.env.local` (gitignored) and rotate anything that has leaked.

---

## 6. Data model (Supabase Postgres)

Three core tables plus a private Storage bucket. Defined across
`supabase/migrations/*` and mirrored idempotently in `lib/setup-phase2.ts`.

### `schools` — the tenant table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | required |
| `address` | text | |
| `contact_phone` | text | |
| `contact_email` | text | |
| `created_at` | timestamptz | |

### `profiles` — 1:1 with `auth.users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `school_id` | uuid | FK → `schools(id)`; **NULL only for super_admin** |
| `role` | `user_role` enum | `super_admin` \| `school_admin` \| `staff` \| `principal` |
| `full_name` | text | required |
| `is_active` | boolean | added by `setup-phase9.ts` (default true); deactivation logs the user out |
| `created_at` | timestamptz | |

### `gr_records` — the digitized register rows (~29 columns)
Unique constraint: **`(school_id, gr_number)`**. Indexes on `school_id`,
`(school_id, student_name)`, `(school_id, surname)`. An `updated_at` trigger keeps the
timestamp fresh.

Left-page / main detail fields (migration 001 + 004):
`gr_number`*, `student_name`*, `fathers_name`*, `mothers_name`, `surname`*,
`religion`, `caste_category`, `date_of_birth`* (date), `dob_in_words`, `birth_place`,
`address`, `previous_school`, nullable canonical `previous_school_district`, and nullable
canonical `previous_school_subdistrict`.

Right-page / academic fields (migration 004):
`admission_date`* (date), `admission_standard`, `progress_and_conduct`,
`leaving_date` (date), `leaving_reason`, `leaving_standard`, `remarks`.

System fields:
`id` (uuid PK), `school_id`* (FK → schools, cascade), nullable `image_url` (Storage path;
`NULL` for voice-only records), nullable `ocr_raw_text` (scan transcription, grouped
`===== SPOKEN (…) =====` audit, or the same global
`===== SPOKEN (Multiple entries) =====` transcript on every row in a voice batch), nullable
`fields_en` JSONB (English voice values keyed by GR field, each carrying `value`, `source`,
and `confidence`; absent on OCR/manual rows), `created_by` (FK → profiles), `created_at`,
`updated_at`.

(* = required at the form/DB level. Form-required set:
`gr_number, student_name, fathers_name, surname, date_of_birth, admission_date`.)

### Canonical previous-school locations
`previous_school_district` and `previous_school_subdistrict` store closed-list keys, never
free text: `district:<LGD code>` and `subdistrict:<LGD code>`. The generated
`lib/gujarat-locations.ts` snapshot is pinned to **2026-05-31** and contains **34 Gujarat
districts** and **306 LGD sub-districts**, including district `789` Vav-Tharad. Sub-district
identity always uses LGD land-region codes; development-block codes are not substitutes.
The form filters talukas by district and clears an incompatible taluka when district changes.

Identity, hierarchy, and English labels come from the Government of India
[Local Government Directory resource](https://www.data.gov.in/resource/local-government-directory-lgd-sub-districts).
Gujarati labels prefer code-linked LGD local-name exports from the documented
[LGD archive mirror](https://ramseraph.github.io/opendata/lgd/); entries without a published
local label carry explicit `deterministic-transliteration` provenance. Refresh with
`node scripts/generate-gujarat-locations.mjs`, then run `lib/gujarat-locations.test.ts`.
Content was rephrased for compliance with licensing restrictions.

### Storage bucket `gr-images`
- **Private**, 10 MB file-size limit, MIME allow-list: JPEG, PNG, WebP, TIFF, PDF.
- Path convention: **`{school_id}/{uuid}.{ext}`** — the leading folder is the tenant key.
- Read access uses **signed URLs** (1-hour expiry) generated on the record detail page.

### Relationships
```
schools (1) ─── (many) profiles        [role: super_admin/school_admin/staff/principal]
schools (1) ─── (many) gr_records
scanned gr_record ─── optional Storage image [at {school_id}/{uuid}.{ext}]
voice-only gr_record ─── no image/audio object [transcript audit only]
profiles (1) ─── (many) gr_records      [created_by]
```

---

## 7. Security & multi-tenancy (RLS)

Tenant isolation is enforced at **two layers**: the UI (role-based nav + client guards)
and the **database (Row Level Security)** — the DB layer is the real guarantee.

### Helper functions (`SECURITY DEFINER`, migration 002)
- `get_my_role()` → the current user's role from `profiles`.
- `get_my_school_id()` → the current user's `school_id`.

These are used inside policies so a policy check can't be spoofed by the client.

### Role capabilities
| Role | Scope | GR records | Users / schools |
|---|---|---|---|
| `super_admin` | all schools | full | creates schools + each school's first `school_admin`; `school_id` is NULL |
| `school_admin` | own school | create / edit / **delete** | creates & activates/deactivates `staff` and `principal` |
| `staff` | own school | create / edit (**no delete**) | — |
| `principal` | own school | **read-only** | — |

### Policy summary
- **`profiles`** (RLS in 002): super_admin full access; anyone can read profiles in
  their own school (and always their own row); school_admin can insert/update/delete
  profiles in their school but **cannot change their own role/school_id** and **cannot
  delete themselves**.
- **`gr_records`** (RLS in 002): super_admin full; all school roles can SELECT their
  school's rows; `staff` + `school_admin` can INSERT/UPDATE their school's rows;
  **only `school_admin` can DELETE**.
- **`schools`** (RLS in **005** — added later): super_admin full; everyone else can
  **read only their own school**. Before 005, any authenticated user could list every
  school (names, addresses, contacts) — that was the bug 005 fixed.
- **Storage `gr-images`** (`setup-storage.ts`): policies match the `{school_id}/` path
  prefix via `split_part(name, '/', 1)`. super_admin reads all; school users read their
  own folder; staff/school_admin can upload/update in their folder; only school_admin
  (and super_admin) can delete.

> Admin routes and guided OCR storage use the **service-role key** and therefore bypass
> RLS by design. `lib/server-auth.ts` verifies the bearer token and active profile first.
> OCR and paid voice POST routes are limited to `staff`/`school_admin`; the voice route
> authorizes and enforces its per-user quota **before parsing the multipart body**.
> `GET /api/ocr-test` and `GET /api/voice-entry` are public, non-billable health checks.

---

## 8. Authentication & session flow

`lib/auth-context.tsx` provides an `AuthProvider` (mounted in `app/layout.tsx`) exposing
`useAuth()` → `{ session, profile, loading, profileMissing, signOut }`.

- On boot it calls `supabase.auth.getSession()`, then fetches the user's `profiles` row
  joined to `schools(name)`. The **profile is what binds a login to one school** (tenancy).
- `onAuthStateChange` keeps session + profile in sync on login/logout/token refresh.
- If a logged-in user has **no profile row**, `profileMissing` is set so the dashboard
  can show an "account not linked to a school" screen instead of spinning forever.
- If `profile.is_active === false`, the user is signed out and redirected to
  `/login?reason=deactivated`.
- **Route protection:** `PUBLIC_PATHS = ['/login']`. Unauthenticated access to any other
  route redirects to `/login`; an authenticated user on `/login` is sent to `/dashboard`.
- The login page (`app/login/page.tsx`) uses `supabase.auth.signInWithPassword`, maps
  Supabase errors to friendly messages, and reads `?reason=deactivated|no-school` to show
  a notice. There is **no public sign-up** — accounts are provisioned by admins.

---

## 9. ★ Core entry pipelines: scan or voice → verify → save

The create form has three capture modes that converge on the same 21-field review form:

```
Single photo:
ImageUploader → Storage `{school_id}/{uuid}.{ext}` → POST /api/ocr-test

Guided high-resolution scan:
GuidedRegisterScanner → authenticated POST /api/ocr-scan
  → quality checks + deterministic 4200×2000 reconstruction → school Storage

Both scan paths → lib/ocr-pipeline.ts → raw text + structured records

Voice entry (English `en-IN`):
VoiceEntryRecorder mode shell
  ├─ Single entry → GroupedVoiceEntryRecorder → four independent requests
  │    → { mode: 'single', transcript, fields: { en, gu, sources } }
  │    → deterministic bilingual group merge
  └─ Multiple entries → MultiVoiceEntryRecorder → one free-form request
       → { mode: 'multi', transcript, students: [{ en, gu, sources }] }
       → VoiceBatchReview → one collision preflight + explicit sequential inserts

Every path → human confidence review/manual correction
  → voice-only: Gujarati main columns + English/source `fields_en` JSONB
  → only an explicit user action inserts/updates `gr_records` (RLS-enforced)
```

### English voice entry: single and multiple (`en-IN`)

The **Single entry** sub-mode uses four schemas covering the canonical 21 fields exactly
once:

1. **Identity (5):** `gr_number`, `student_name`, `fathers_name`, `mothers_name`, `surname`.
2. **Birth & community (6):** `date_of_birth`, `dob_in_words`, `birth_place`, `religion`, `caste_category`, `address`.
3. **Admission (5):** `admission_date`, `admission_standard`, `previous_school`, `previous_school_district`, `previous_school_subdistrict`.
4. **Leaving & notes (5, skippable):** `leaving_date`, `leaving_standard`, `leaving_reason`, `progress_and_conduct`, `remarks`.

Each completed group sends one authenticated multipart request. Gemini returns a faithful
Latin-script `transcript` and only that group's fields in the same response, with every
field shaped as `{ en, gu }`. `voice-merge.ts` merges and sanitizes both scripts in register
order; `voice-bilingual.ts` then resolves spoken district/taluka names to local LGD keys.
There is no second translation request.

The **Multiple entries** sub-mode records one continuous, explicitly separated dictation
(e.g. “Entry one … Entry two …”). Gemini returns one transcript and an ordered
`students[]` collection using all 21 canonical fields in both scripts. `expectedCount` is
optional and advisory: a mismatch produces the exact review warning but never rejects,
reorders, pads, splits, merges, or truncates returned students. The UI warns that
segmentation accuracy can drop past about 6 entries and again after a recording exceeds 2
minutes. Names in `en` remain Latin; names in `gu` are phonetic renderings of the heard
pronunciation, never semantic translations. An uncertain Gujarati proper noun stays empty
for clerk correction, and every populated name is pinned to medium confidence.

**Endpoint controls:** `POST /api/voice-entry` authorizes active `staff` and
`school_admin` and applies its process-local 12/user/60-second paid-request limiter before
reading multipart bytes. Missing `mode` defaults to `single` for compatibility. Single
mode requires one known `group` and rejects `expectedCount`; multi mode rejects `group`
and accepts an optional integer `expectedCount` from 1 through `VOICE_MAX_ENTRIES`
(default/max 10). Both accept one `audio` file plus `language=en-IN`, reject unexpected or
duplicate fields, cap audio at 10 MB, and allow WebM, MP4/M4A, MPEG/MP3, WAV, and OGG.

The Gemini adapter timeout is 45 seconds for single groups and 180 seconds for multi audio.
The Node.js route exports `maxDuration = 300` to leave cleanup/headroom. **This requested
maximum is not proof that the deployed Vercel plan permits 300 seconds**; verify the actual
function-duration allowance in deployment settings before production. A lower platform cap
can terminate a request that succeeds locally.

**Sanitation, review, and persistence:** spoken English numbers, day-first dates, and
standards 1–12 are normalized through the existing mapper. Both scripts are sanitized
independently, students remain in provider order, and locations resolve locally. The
conversion hard-exclusion list is enforced in code: `gr_number`, `date_of_birth`,
`admission_date`, `leaving_date`, `image_url`, and `ocr_raw_text` are never transliterated.
Canonical location keys are also identical on both script sides and labels are localized
from the generated module.

Nothing auto-saves. Single and batch review expose real `role="group"` English/ગુજરાતી
buttons with `aria-pressed`, keyboard-native buttons, and `aria-live` announcements. Every
field shows provenance (`AI`, `LGD`, `Shared`, `Edited`, or `Single script`). Any AI-sourced
value in required `student_name`, `fathers_name`, or `surname` blocks save until that value
has actually been displayed in Gujarati; the UI explains the block inline rather than
silently disabling save. Missing required Gujarati values remain normal validation errors.

On explicit voice save, reviewed Gujarati values populate normal `gr_records` columns;
English values, confidence, and per-field source markers populate nullable `fields_en`.
OCR/manual payloads still use `buildGRRecordPayload` and omit `fields_en`, so existing OCR
records and OCR multi-record behavior remain valid. `VoiceBatchReview` also identifies
every occurrence of an in-batch duplicate GR number. `GRRecordForm` performs one
tenant-scoped existing-GR lookup, then awaits eligible inserts sequentially. One failed row
does not roll back successful rows, a mixed dual/single-script batch is supported, and a
race-time PostgreSQL `23505` becomes an already-existing/skipped outcome. The UI reports
per-row states and summaries such as `3 saved, 1 skipped: GR 42 already exists.`

Single transcripts remain under group headers such as `===== SPOKEN (Identity) =====`.
Every saved row from one multi recording receives the same unsegmented audit text under
`===== SPOKEN (Multiple entries) =====`; the system never invents transcript segments.
Audio is never persisted and voice-only rows use `image_url = NULL`. Records with
`fields_en` expose the same local English/ગુજરાતી toggle on detail and edit; edit hydration
preserves both scripts and regenerates `fields_en` on update. Legacy/OCR rows without
metadata stay single-script and show no misleading toggle.

Request generations, current-mode refs, abort controllers, mounted-state guards,
media-track/timer/object-URL cleanup, and post-save locks prevent stale responses, leaked
microphone resources, duplicate saves, or loss of visible outcomes.

**Comparison diagnostic:** with `VOICE_DEBUG_COMPARE=1`,
`/dashboard/records/voice-compare` sends the same in-memory clip to every configured model
through `POST /api/voice-entry?debug=all`. The page supports both request modes. Single
results render a cross-model field matrix; multi results render every ordered student per
model independently, including actual counts and non-coercive mismatch warnings. Calls run
in parallel with no first-wins. Keep this flag off in production because each model call
consumes paid quota.

### Step 0 — Mobile-photo preprocessing (`lib/image-prep.ts`)
Every reader (the anchor **and** all structured extractors) first runs the image through
`preprocessForOcr`: auto-orient → upscale small photos → grayscale → contrast-normalize →
mild sharpen → JPEG. Phone photos of handwritten registers gain the most from this, and
it's applied exactly once per path. Toggle with `OCR_PREPROCESS=off` to A/B test raw input.

### Step 0a — Guided tiled capture (`components/GuidedRegisterScanner.tsx`)
The create form offers **Single photo** and **Guided 7-shot scan**. The guided client uses
`getUserMedia` on HTTPS/localhost, with an `input capture="environment"` fallback on every
step. It captures one full-spread overview and six close-ups in fixed 2×3 row-major order,
normalizes camera frames to JPEG in a canvas, computes local brightness/contrast/edge-detail
warnings, supports retakes/review, and sends the images with the current Supabase bearer token.

`POST /api/ocr-scan` re-verifies the token and active `staff`/`school_admin` profile, rejects
unexpected/duplicate fields, enforces 8 MB per-file / 40 MB aggregate / 12 MP decoded-image
limits, then calls `lib/reconstruct-register.ts`. Sharp applies EXIF and rotates a remaining
portrait pixel matrix to landscape (important for WhatsApp images with stripped EXIF), inspects
every image, processes close-ups sequentially to bound native memory, trims the guided overlap,
and composites a **4200×2000** JPEG. This is a deterministic guided grid—not arbitrary
feature-based panorama stitching. The server runs the shared OCR pipeline first and stores the
successful reconstruction under the authenticated caller's school second, avoiding an orphan if
OCR throws. It returns OCR fields plus per-shot quality metadata; the client displays a signed
preview for seam review. Live browser camera requires a secure context; the file/camera-input
fallback remains usable on ordinary LAN HTTP.

### Step 1 — Raw transcription anchor (`lib/ocr.ts` + `lib/sarvam-doc-ai.ts`)
- `extractText(buffer)` first calls `splitIntoPages()`: using **sharp**, it auto-orients
  the image (bakes EXIF rotation), and if the image is **landscape** (`width > height ×
  1.2`, a photographed open two-page spread) it **splits it down the middle** into
  `left-page` and `right-page`. Portrait pages and non-raster inputs (PDF) are left whole.
- Each segment is transcribed by `transcribeSegment()`:
  - **PRIMARY — Sarvam Document AI (Vision 1.5) digitise** (`digitiseWithSarvam`, in
    `lib/sarvam-doc-ai.ts`): purpose-trained on Indic scripts including handwritten
    Gujarati, so it is far more accurate on GR pages than a generic engine. It submits a
    `doc-ai` **digitise** job (`language: gu-IN`, `content_type: handwritten`), polls to a
    terminal state, and reads the page text from the job results.
  - **FALLBACK — OCR.space** (`callOcrSpace`): runs only when Sarvam is unconfigured,
    errors, or times out. Two passes concurrently via `Promise.allSettled` — Gujarati
    (Engine 3) + English (Engine 2) — failing hard only if **both** fail. Kept because it
    is free and reliable on the Latin/numeral pass (GR numbers, dates).
- Segment results are merged in reading order, and left/right pages are labelled
  (`===== LEFT PAGE (પત્રક ૪ …) =====`, `===== RIGHT PAGE (પત્રક ૫ …) =====`) so downstream
  consumers can tell an admission date from a leaving date.
- The two-page split predates Sarvam (it originally dodged OCR.space's 60 s Engine-3
  timeout, error E563) and is kept unchanged: single pages sit well within Sarvam's
  10-page limit, and the left/right labels are relied on by the downstream prompts.

### Step 2 — Structured extraction chain (`lib/ocr-pipeline.ts`)
Both OCR POST routes validate an active `staff`/`school_admin` bearer session before spending
provider quota. `app/api/ocr-test/route.ts` validates a single upload and delegates to the shared
pipeline; `app/api/ocr-scan/route.ts` delegates after reconstruction and stores the output only
after the pipeline returns. The pipeline grounds the AI in the transcription (the single biggest
guard against models
**hallucinating student names**). Attempts run **most-accurate / most-grounded first**,
and the **first attempt returning records wins**:

Default order (configurable via `OCR_EXTRACTOR_ORDER`), when transcription text is available:
1. `sarvam-doc-ai-extract` — **Sarvam Document AI Extract**, schema from the shared contract, reads the image directly. `lib/sarvam-doc-ai.ts`.
2. `gemini+ocr` — Gemini **vision + transcription** (model via `GEMINI_MODEL`). `lib/gemini-extract.ts`.
3. `gemini-text` — Gemini **text-only**. `structureWithGemini`.
4. `openai` — **OpenAI GPT‑5 vision** (+ transcription; model via `OPENAI_MODEL`, default `gpt-5.6`). `lib/openai-extract.ts`.
5. `mistral+ocr` — Mistral **vision + transcription**. `lib/mistral-extract.ts`.
6. `sarvam-text` — Sarvam **text-only** Gujarati structuring. `lib/sarvam-structure.ts`.

When transcription text is empty, the same order runs image-only (text-only steps skipped).

Order is driven by **`OCR_EXTRACTOR_ORDER`** (keys: `sarvam-doc-ai, gemini, gemini-text,
openai, mistral, sarvam-text`), so the best reader can be promoted to first **without code
changes**. Providers only appear if their key is configured. `GET /api/ocr-test` reports the
anchor, the active order, and whether compare is enabled.

**Compare mode (diagnostic):** `POST /api/ocr-test?debug=all`, gated by env
`OCR_DEBUG_COMPARE`, runs *every* configured reader on the same page — including multiple
Gemini/OpenAI models (`OCR_COMPARE_GEMINI_MODELS`, `OCR_COMPARE_OPENAI_MODELS`) — and returns
each engine's fields, record count, latency, and errors side by side (no first-wins). The
authed page **`app/dashboard/records/compare/page.tsx`** renders this against the scan to
pick the best reader for handwritten Gujarati before locking it in via `OCR_EXTRACTOR_ORDER`.

### Step 3 — Shared contract & domain knowledge (`lib/extract-shared.ts`)
Every provider asks for and returns the **exact same shape**, so they're interchangeable:
- **`STRING_FIELDS`** — the 19 per-student fields (matches `ParsedGRFields`):
  `gr_number, student_name, fathers_name, mothers_name, surname, religion,
  caste_category, date_of_birth, dob_in_words, birth_place, address, previous_school,
  admission_date, admission_standard, progress_and_conduct, leaving_date,
  leaving_reason, leaving_standard, remarks`.
- **Prompts** (`buildExtractionPrompt(ocrText?)`, `buildStructurePrompt(ocrText)`)
  encode: the field spec, the **physical GR column layout** (left/right pages), and
  strict rules — never invent names (empty string beats a guess), copy Gujarati exactly,
  convert Indic numerals to Western, dates are **day-first** → output `YYYY-MM-DD`, skip
  headers/`નમુનો` sample rows, one row per register number, return only
  `{"students":[…]}` JSON, never duplicate DOB into admission_date, treat 9+ digit
  strings as UID/Aadhaar/phone (→ remarks), a standard is 1–12.
- **`toParsedRecords(students, confidence)`** maps provider JSON → `ParsedGRFields[]`,
  running **`sanitizeRecord`**: strips long digit runs out of name fields, drops
  register numbers that look like ID numbers, validates standards are 1–12, and — when a
  row has only an admission **or** only a leaving date/standard — marks that pair
  **medium confidence** (amber dot in the UI) because the flattened OCR can't prove
  which side it came from.
- **`fetchWithRetry`** — exponential backoff on transient statuses `{429, 500, 502, 503,
  504}` so free-tier rate limits don't knock a provider out of the chain.
- **`FIELD_DESCRIPTIONS`** — a one-line description per field, keyed off the same
  `STRING_FIELDS` list, so a schema-based provider (Sarvam Document AI Extract) can
  generate its JSON schema from the one canonical contract instead of a second list that
  could drift.
- Confidence convention: **high** for direct vision reads (Sarvam Doc AI / Gemini /
  Mistral), **medium** for records reconstructed from noisy OCR text (Sarvam text /
  heuristic parser). `sanitizeRecord` downgrades genuinely ambiguous fields to medium.

### Provider modules
- **`lib/sarvam-doc-ai.ts`** (primary anchor + first extractor): Sarvam Document AI
  (Vision 1.5) client over raw `fetch`. `digitiseWithSarvam(buffer, filename)` → the page
  transcription string used as the raw anchor (replacing OCR.space); and
  `extractGRRecordsSarvamDocAI(buffer, filename)` → structured records via a JSON schema
  built from `STRING_FIELDS` + `FIELD_DESCRIPTIONS`, mapped through the shared
  `toParsedRecords`. Handles the async job lifecycle (create → poll `status` → `results`),
  self-heals a rejected `content_type` (retries without it on 400), and gates **every**
  doc-ai call through a module-level **token-bucket rate limiter** (Sarvam allows only 10
  req/min, account-wide). Uses `SARVAM_API_KEY` — the same key as `sarvam-structure.ts`.
- **`lib/openai-extract.ts`** (frontier vision LLM): `extractGRRecordsOpenAI(buffer, ocrText?, model?)`
  via OpenAI Chat Completions with a base64 image and `json_object` output. Uses
  `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-5.6`); omits `temperature` and uses
  `max_completion_tokens` (GPT‑5 is a reasoning model). Preprocesses via `image-prep`.
- **`lib/image-prep.ts`**: `preprocessForOcr(buffer)` — the shared sharp cleanup every reader uses.
- **`lib/gemini-extract.ts`** (primary text/vision LLM): `extractGRRecords(buffer, ocrText?, model?)` (vision,
  uses a `responseSchema` for structured JSON, `temperature: 0`) and
  `structureWithGemini(ocrText)` (text-only). Normalizes images to JPEG via sharp.
- **`lib/mistral-extract.ts`** (secondary): `extractGRRecordsMistral(buffer, ocrText?)`
  via OpenAI-style chat completions with a base64 image and `response_format:
  json_object`.
- **`lib/sarvam-structure.ts`** (tertiary): `structureWithSarvam(ocrText)` — text-only,
  Gujarati-native. Sarvam is a **reasoning** model; the code keeps `reasoning_effort:
  'low'` (`'none'` is rejected 400), sets a generous `max_tokens: 16000`, falls back to
  `reasoning_content`, and strips ``` fences before `JSON.parse`.

### Step 4 — Client heuristic fallback parser (`lib/ocr-parser.ts`)
`parseGRTable(rawText)` runs **in the browser** inside `GRRecordForm` when the server
returns raw OCR text but **no** structured records (e.g. all AI providers were busy). It:
- Converts Gujarati (૦–૯) and Devanagari (०–९) numerals to Western digits (plus a
  `<` → `8` OCR-typo fix).
- Groups lines into per-student blocks using GR-number sequence heuristics.
- Extracts fields positionally (word[0]=student, [1]=father, [2]=surname), plus dates,
  religion/caste keyword matches, standard, leaving reason, progress.
- `normalizeDate` forces 2-digit years to `19xx` (these registers are historical).
- `isValidRecord` keeps only rows that have a name **and** at least one date, and drops
  the `નમુનો` (specimen) header row.
- `countParsedFields` tallies totals by confidence for the UI.
This parser is intentionally lower-accuracy than the AI chain — it exists so the user is
never left with nothing to auto-fill from.

### Step 5 — Verify & save (`components/GRRecordForm.tsx`)
- Imports canonical 21-field order/labels/required metadata and the pure OCR/manual payload
  mapper from `lib/gr-record-data.ts`.
- Single photo and guided scan remain on ordinary single-script `ParsedGRFields` review.
  Voice state is separate `{ en, gu, sources }`; changing the review script updates only
  local state and never calls a provider.
- Single voice uses the ordinary one-record layout with confidence/source markers,
  dependent LGD selects, required Gujarati-name review, validation, and explicit submit.
- Multiple voice uses separate `VoiceReviewFields[]` state and `VoiceBatchReview`; it never
  enters OCR's select-one path and hides the normal one-record fields/actions while active.
- Batch edits invalidate stale preview outcomes. Explicit save calls
  `saveVoiceGRRecordBatch` with one school-scoped preflight and injected one-row inserts;
  the pure module awaits inserts sequentially and continues after row-local failures.
- Voice payloads write reviewed Gujarati columns plus English/source `fields_en`, set
  `image_url = NULL`, and share the exact global multi transcript in `ocr_raw_text`. No
  audio object is stored. Completed outcomes lock editing/capture until the operator
  returns to records, preventing accidental duplicate saves.
- OCR/manual `handleSubmit` still maps optional blanks to `NULL` without `fields_en`, then
  inserts with the profile's `school_id`/`created_by` or updates by `id`; RLS enforces
  tenancy.

### `components/ImageUploader.tsx`
Uploads the selected file directly to Storage at `{schoolId}/{uuid}.{ext}` (`upsert:
false`), shows a preview via `FileReader`, supports mobile camera capture
(`capture="environment"`), and calls `onUpload(path)` + `onFileSelect(file)`. It maps
Storage errors (network / permission) to friendly messages.

### `components/GuidedRegisterScanner.tsx`
A client-only scanner embedded in `GRRecordForm`: rear-camera stream on secure contexts,
per-step camera-file fallback, overview + six 2×3 close-ups, canvas JPEG normalization,
local quality hints, progress/coverage map, retakes, review, media-track/object-URL cleanup,
and authenticated multipart submission. `GRRecordForm` switches between this and
`ImageUploader`, then sends both result shapes through the same record-selection,
confidence-dot, raw-text, and save workflow. The guided endpoint stores the reconstructed
image directly, avoiding the single-photo path's upload → browser download → API upload
round trip.

### Voice capture and review components
`VoiceEntryRecorder.tsx` is the accessible Single/Multiple mode shell.
`GroupedVoiceEntryRecorder.tsx` retains the four-step MediaRecorder flow, skippable leaving
group, playback/re-record, transcript/field preview, and cleanup guards.
`MultiVoiceEntryRecorder.tsx` owns one continuous recording, Auto/± count hint, explicit
boundary example, long-batch warnings, discriminated request/response validation, and
actual transcript/student count preview. `VoiceBatchReview.tsx` accepts dual- or legacy
single-script rows, edits all 21 shared fields, renders dependent LGD selects, exposes
English/ગુજરાતી toggles plus source markers, enforces required Gujarati-name viewing, and
shows ready/invalid/saved/skipped/failed states with row/batch discard before save.
All streams, timers, abort controllers, request generations, and object URLs are cleaned up
on replace/reset/unmount.

---

## 10. Feature modules (mapped to routes)

| Module | Where | Notes |
|---|---|---|
| Auth & roles | `lib/auth-context.tsx`, `lib/server-auth.ts`, `app/login/page.tsx` | Supabase session/profile; role drives guards and navigation |
| Tenant isolation | migrations `002`/`005`, `setup-storage.ts` | RLS on profiles, records, schools, and storage |
| Image upload & storage | `components/ImageUploader.tsx` | per-school path in private `gr-images` |
| Guided tiled scanner | `GuidedRegisterScanner`, `/api/ocr-scan`, `reconstruct-register` | authenticated seven-shot reconstruction and quality metadata |
| OCR + AI extraction | `lib/ocr-pipeline.ts`, OCR routes, provider adapters | production first-wins and gated compare pipeline (§9) |
| Voice entry | `VoiceEntryRecorder`, grouped/multi recorders, `VoiceBatchReview`, `/api/voice-entry`, audio/bilingual/persistence modules | one-response English/ગુજરાતી extraction, Gujarati review gate, ordered multi extraction, explicit sequential save, no audio storage (§9) |
| Voice comparison | `/dashboard/records/voice-compare`, `/api/voice-entry?debug=all` | gated parallel Gemini comparison for grouped fields or per-model ordered students/count warnings |
| GR record form/data | `GRRecordForm.tsx`, `gr-record-data.ts`, `gr-record-batch.ts`, `voice-persistence.ts` | 21-field single review, closed LGD locations, voice metadata, duplicate preflight, row outcomes, and sequential persistence |
| Records browse/search | `/dashboard/records` | substring search, filters, sort, print, shortcuts |
| Record detail | `/dashboard/records/[id]` | optional signed scan, OCR/spoken audit, local English/ગુજરાતી voice toggle/source markers, delete for school_admin |
| Dashboard/home | `/dashboard` | aggregate counts and recent entries |
| School management | `/dashboard/schools`, `/api/admin/schools` | super_admin provisioning |
| Staff management | `/dashboard/staff`, `/api/admin/users` | school_admin provisioning and activation |

### Route inventory
Public: `/` (landing), `/login`, and `not-found`.

Auth-gated under `/dashboard` (role-based navigation in `dashboard/layout.tsx`):
- `super_admin`: Home, **Schools**.
- `school_admin`: Home, **Records**, **Staff**.
- `staff` / `principal`: Home, **Records** (`principal` remains read-only).

Record routes: `/dashboard/records`, `/dashboard/records/new`,
`/dashboard/records/compare`, `/dashboard/records/voice-compare`,
`/dashboard/records/[id]`, and `/dashboard/records/[id]/edit`.

### API routes
- `POST /api/ocr-test` — authenticated single-image extraction; `?debug=all` is gated
  comparison. `GET` is public non-billable health.
- `POST /api/ocr-scan` — authenticated overview + six-tile reconstruction/extraction,
  limited to active `staff`/`school_admin`.
- `POST /api/voice-entry` — authenticated/rate-limited discriminated audio extraction:
  single mode requires `group`; multi mode forbids `group` and accepts optional
  `expectedCount`. Gated `?debug=all` supports both; active `staff`/`school_admin` only.
  `GET` is public non-billable health and reports the effective `maxEntries`.
- `POST /api/admin/schools` — create school (`super_admin` only).
- `POST /api/admin/users` — create auth user + profile; rolls back the auth user if the
  profile insert fails. `PATCH` lets a school admin toggle allowed own-school users.

---

## 11. Database migrations, setup & provisioning scripts

### Migrations (`supabase/migrations/`) — apply in order
1. **001 create core tables** — `user_role` enum; `schools`, `profiles`, `gr_records`
   (17 initial columns incl. `mothers_name`, `caste_category`, `address`,
   `previous_school`); indexes; `updated_at` trigger. RLS **not** enabled here.
2. **002 rls policies** — `get_my_role()` / `get_my_school_id()` helpers; enables RLS on
   `profiles` and `gr_records`; all role policies (§7).
3. **003 seed test data** — manual template: 2 schools (A/B) + 7 users; requires you to
   paste real `auth.users` UUIDs (superseded in practice by `setup-phase2.ts`).
4. **004 expand gr fields** — adds the 9 extra columns (religion, dob_in_words,
   birth_place, admission_standard, progress_and_conduct, leaving_date, leaving_reason,
   leaving_standard, remarks). All nullable.
5. **005 schools rls** — enables RLS on `schools` (fixes the cross-tenant school listing
   leak).
6. **006 previous-school location + English metadata** — adds nullable
   `previous_school_district`, `previous_school_subdistrict`, and `fields_en`; existing
   OCR/manual rows remain valid without any of them.

> `profiles.is_active` is **not** in a migration — it is added by `lib/setup-phase9.ts`.
> If you rebuild the DB from migrations alone, add this column too.

### One-time setup scripts (`lib/setup-*.ts`, run with `npx tsx`)
- **`setup-phase2.ts`** — idempotent full bootstrap: creates the current tables (including
  the 006 nullable columns), enum, indexes, trigger, 2 test schools (UUIDs
  `a0000…0001` / `b0000…0002`), **7 test auth users** (shared password `TestPass123!`) +
  profiles, 2 sample GR records, and all 10 RLS policies + helpers. Connects to Postgres
  directly using `SUPABASE_DB_PASSWORD`.
- **`setup-storage.ts`** — creates the private `gr-images` bucket (10 MB, MIME allow-list)
  and the 5 storage RLS policies keyed on the `{school_id}/` path prefix.
- **`setup-phase9.ts`** — `ALTER TABLE profiles ADD COLUMN is_active`.

Test accounts (from `setup-phase2.ts`): `super@test.com`, `admin-a@test.com`,
`staff-a@test.com`, `principal-a@test.com`, and the `-b` equivalents — all `TestPass123!`.

### Ops scripts (`scripts/*.mjs`, run with `node`)
- **`apply-migration.mjs <path.sql>`** — runs a migration file inside one transaction
  (rolls back on error); tries the direct DB host, then pooler hosts.
- **`verify-previous-school-location.mjs`** — checks migration 006 column types/nullability,
  loads a pre-existing record, round-trips a synthetic location/metadata insert, and proves
  the verification transaction left no row behind.
- **`provision-school.mjs --school "<name>" --admin <email>`** — creates/finds a school and
  attaches an existing login to it as `school_admin` (or `--role`); supports
  `--move-records` and `--dry-run`. Uses the service role (bypasses RLS) to fix the
  "user attached to the wrong school" case the UI can't handle.
- **`verify-tenancy.mjs [email] [password]`** — signs in with the **anon** key exactly
  like the browser and reports what each user can actually read, proving RLS blocks
  cross-school reads while each user can still resolve their own school name.

---

## 12. Working in this repo — conventions & gotchas

### ⚠️ Next.js version warning (from `AGENTS.md`)
The repo's `AGENTS.md` states this is **not a Next.js version you can assume you know**:
APIs, conventions, and file structure may differ from training data, and there may be
breaking changes. **Before writing Next.js code, read the relevant guide in
`node_modules/next/dist/docs/`** and heed deprecation notices. `CLAUDE.md` simply
imports `AGENTS.md` (`@AGENTS.md`).

### Conventions
- **Path alias:** import from `@/…` (repo root), e.g. `@/lib/supabase`.
- **Client vs. server:** pages/components that use hooks/browser APIs start with
  `'use client'`. The Supabase browser client (`lib/supabase.ts`) uses the anon key;
  anything needing the service role must live in an API route or a script.
- **Bilingual UI:** labels are `"ગુજરાતી / English"`; render helpers split on `" / "`.
  Use `lib/gujarati.ts` for numerals/dates: `toGujaratiDigits`, `formatStandard`
  (`"ધો. ૫"`), `formatRegisterDate` (ISO → `DD-MM-YYYY`). `STANDARDS` = 1–8.
- **Dates:** stored ISO `YYYY-MM-DD`; the register is read **day-first** — never assume
  month-first when parsing.
- **Tenancy:** always scope queries by `school_id` (RLS enforces it, but the records list
  also filters explicitly as defence-in-depth). Never expose one school's data to another.
- **Adding a GR field** touches many places: DB migration → `STRING_FIELDS` and
  `FIELD_DESCRIPTIONS` in `extract-shared.ts` → `ParsedGRFields` → `GRRecordData`/payload
  → form labels/detail/edit. For voice support it must also appear exactly once in
  `VOICE_FIELD_GROUPS`; tests assert complete 21-field coverage today. Canonical location
  fields additionally require an LGD migration, generator refresh, dependent selects, and
  resolver coverage. A voice-convertible field must participate in `{ en, gu, sources }`
  conversion and `fields_en`; never remove anything from the documented hard-exclusion
  list without a data-migration/audit decision.

### Known issues / findings (see `AUDIT_REPORT.md` for older audit history)
- **Secrets:** real service/provider credentials had previously been present on disk;
  rotate leaked values and keep live values only in `.env.local`.
- **No CI yet:** Vitest and `npm test` now exist, but tests/lint/build are not enforced by
  a checked-in CI workflow.
- **Voice rate-limit scope:** the 12/user/minute map is process-local. Multiple serverless
  instances do not share counters; use a distributed store if a global billing guard is
  required later.
- **Voice function duration:** multi extraction allows 180 seconds in the adapter and the
  route requests `maxDuration = 300`, but the real Vercel plan/platform cap is not encoded
  in this repository. Verify deployment settings before rollout; a lower cap is the most
  likely production failure for long recordings.
- **Multi segmentation:** expected count is only a warning/check. Never pad or truncate to
  match it; prefer batches of 6 or fewer and require human review of every boundary.
- **Dual-script search scope:** voice main columns are reviewed Gujarati, so ordinary record
  search matches Gujarati spellings. Preserved English values live in `fields_en`; the
  records list does not currently query JSONB, so English-only searches do not match those
  metadata values.
- **Browser capture:** microphone and live guided camera access require HTTPS or localhost.
  Device permissions and hardware still need a real browser/session smoke test.
- **Naming:** the production single-scan endpoint is still `/api/ocr-test`; the assets
  folder remains misspelled `assests/`.
- OCR and audio accuracy are bounded by source quality. Mandatory human review in
  `GRRecordForm` remains the final safety net by design.

---

## 13. Quick start (for a new contributor or agent)

```powershell
# 1. Install dependencies
npm install

# 2. Configure environment (then fill real values)
Copy-Item .env.local.example .env.local

# 3. Provision a new Supabase backend once
npx tsx lib/setup-phase2.ts
npx tsx lib/setup-storage.ts
npx tsx lib/setup-phase9.ts
node scripts/apply-migration.mjs supabase/migrations/20260726_005_schools_rls.sql

# 4. Run automated verification
npm test
npm run lint
npm run build

# 5. Run the development server manually
npm run dev                        # http://localhost:3000

# 6. Verify tenant isolation when needed
node scripts/verify-tenancy.mjs
```

Sign in with an active `staff` or `school_admin` account and open **New entry**. For the
scan smoke test, upload a page from `Sample-img/`, review the filled fields, then save.
For **Single entry** voice on localhost/HTTPS, grant microphone permission, complete or
re-record all four groups, confirm medium-confidence names/audit headers, manually correct
a value, and explicitly save.

For **Multiple entries**, record at least two students with spoken “Entry one / Entry two”
boundaries. Test Auto and a deliberately wrong expected count; verify the exact mismatch
warning appears while every actual row remains visible (no padding/truncation). Edit and
discard rows, verify duplicates/missing required fields are marked, then save. Confirm the
school-scoped preflight runs before sequential per-row outcomes, successful rows remain
saved after another row fails/skips, `image_url` is null, and each row has the same
`===== SPOKEN (Multiple entries) =====` audit. Confirm no audio object is persisted.

A logged-in real-browser session is required for microphone permissions and end-to-end
persistence. Also verify the deployed Vercel function duration supports the route's
300-second request; local success does not prove the production plan limit.

**First files to read:** `app/api/voice-entry/route.ts` → `lib/gemini-audio.ts` →
`lib/voice-pipeline.ts` → `components/VoiceEntryRecorder.tsx` →
`components/MultiVoiceEntryRecorder.tsx` → `components/VoiceBatchReview.tsx` →
`lib/gr-record-batch.ts` → `components/GRRecordForm.tsx`; for scans start at
`app/api/ocr-test/route.ts` and `lib/ocr-pipeline.ts`.
