# Digital GR — Project Context

> A single-file, hand-off-ready briefing on this repository. Paste or attach this to
> Claude (or any coding agent) to give it full context on what the project is, how it
> is built, and how every pipeline and module fits together.

Last compiled from source: covers all app routes, API routes, `lib/` pipeline
modules, components, Supabase migrations, and setup/provisioning scripts.

---

## 1. What this project is

**Digital GR** is a **multi-tenant web application that digitizes school General
Registers (GR)** — the official, handwritten student-admission ledgers (જનરલ રજિસ્ટર)
kept by primary schools in Gujarat, India.

The core idea: instead of relying on fragile paper registers (vulnerable to fire,
flood, termites, and decay), a staff member **photographs a register page**, the system
**reads the Gujarati handwriting** into structured fields, the staff member
**verifies/corrects** the extracted data, and the record is saved to a **secure,
searchable, cloud-backed database** with the original scan attached.

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

- **Left page — પત્રક ૪ (Patrak 4), "મુખ્ય વિગતો" / main details** — admission side:
  register number, full name (`પુરૂં નામ`, written as *given · father's · surname*),
  religion + caste (`જાત તથા પેટા જાત`), birth place, date of birth, previous school,
  admission date, admission standard.
- **Right page — પત્રક ૫ (Patrak 5), "શૈક્ષણિક વિગતો" / academic details** — leaving
  side: leaving date, standard at leaving, progress & conduct, reason for leaving,
  leaving-certificate remarks.

Correctly separating **admission** columns from **leaving** columns is a recurring
theme in the prompts and sanitization logic, because both pages carry a
"date + standard" pair that models otherwise confuse.

---

## 2. IMPORTANT: PRD vs. actual implementation (design drift)

The PRD and the shipped code differ on the OCR/extraction approach. **Trust the code.**

| Concern | PRD said | Code actually does |
|---|---|---|
| OCR provider | Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) | **Sarvam Document AI** (Vision 1.5, Indic-specialised) is the raw-text anchor, with **OCR.space** as fallback; then a chain of **AI vision/LLM providers** for structuring |
| Field mapping | "best-effort" regex/heuristic parsing, treated as nice-to-have | A multi-provider **AI extraction chain** (Sarvam Doc AI → Gemini → Mistral → Sarvam text) is primary; the heuristic parser is only a client-side fallback |
| "AI" in system | None beyond cloud OCR (per the older audit) | Multiple LLM/VLM providers are now first-class in the server pipeline |

The AUDIT_REPORT.md was written at an earlier stage (it states "the only AI is cloud
OCR"). Since then the shared chain in `lib/ocr-pipeline.ts`, the HTTP adapters in
`app/api/ocr-test/route.ts` / `app/api/ocr-scan/route.ts`, and the
`lib/*-extract.ts` / `lib/sarvam-structure.ts` modules were added. When in doubt, the
`.env.local.example` and these pipeline files reflect the current design.

---

## 3. Tech stack

| Layer | Technology / notes |
|---|---|
| Framework | **Next.js 16.2.9** (App Router, Turbopack) — see the warning in §12 |
| UI runtime | **React 19.2.4**, React DOM 19.2.4 |
| Language | **TypeScript 5** (strict), path alias `@/*` → repo root |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`), custom "neumorphic/ledger" design system in `app/globals.css` |
| Fonts | `next/font/google`: Spectral (display serif), IBM Plex Sans (UI), IBM Plex Mono (ledger figures), Noto Sans + Noto Serif Gujarati |
| Backend | **Supabase** — Postgres + Auth + Storage + Row Level Security, via `@supabase/supabase-js` |
| Image processing | **sharp** (auto-orient, grayscale/contrast/upscale preprocessing, JPEG re-encode, two-page split, guided 2×3 tile quality inspection/reconstruction) |
| Raw OCR anchor | **Sarvam Document AI** (Vision 1.5) primary; **OCR.space** fallback |
| AI extraction | **Sarvam Document AI** (schema extract), **Google Gemini** (vision + text), **OpenAI GPT‑5** (vision), **Mistral** (vision), **Sarvam** chat (Gujarati-native text structuring) |
| Analytics | Vercel Analytics + Speed Insights |
| Tooling | `tsx` (run TS scripts), `postgres` (direct DDL in setup scripts), ESLint 9 |
| Hosting target | Vercel |

**npm scripts** (`package.json`): `dev`, `build`, `start`, `lint`. There is **no `test`
script and no test framework configured**. Lint is **not** wired into build/CI.

---

## 4. Repository structure

```
digital-gr/
├─ AGENTS.md                     # Agent rules (Next.js 16 breaking-changes warning) — READ §12
├─ CLAUDE.md                     # Just "@AGENTS.md" (imports the rules)
├─ AUDIT_REPORT.md               # Earlier whole-project audit + pipeline test results
├─ PROJECT_CONTEXT.md            # ← this file
├─ .env.local.example            # All required environment variables (documented)
│
├─ app/                          # Next.js App Router
│  ├─ layout.tsx                 # Root layout: fonts, AuthProvider, analytics, metadata
│  ├─ page.tsx                   # Public bilingual landing page (specimen ledger)
│  ├─ not-found.tsx              # 404
│  ├─ globals.css                # Tailwind v4 + neumorphic/ledger design tokens & classes
│  ├─ login/page.tsx             # Email/password sign-in (Supabase Auth)
│  ├─ dashboard/
│  │  ├─ layout.tsx              # Auth-gated shell: role-based nav, profile menu, mobile tabs
│  │  ├─ page.tsx                # Home: register stats + recent entries + per-standard tally
│  │  ├─ records/
│  │  │  ├─ page.tsx             # Record list: search, filter, sort, print
│  │  │  ├─ new/page.tsx         # Create (wraps GRRecordForm mode="create")
│  │  │  ├─ compare/page.tsx     # OCR-engine comparison diagnostic (needs OCR_DEBUG_COMPARE)
│  │  │  └─ [id]/
│  │  │     ├─ page.tsx          # Detail: two-page spread view, scan image, delete
│  │  │     └─ edit/page.tsx     # Edit (wraps GRRecordForm mode="edit")
│  │  ├─ schools/page.tsx        # super_admin: create schools + provision first admin
│  │  └─ staff/page.tsx          # school_admin: create/activate/deactivate staff & principals
│  └─ api/
│     ├─ ocr-test/route.ts       # Single-image/compare HTTP adapter + health check
│     ├─ ocr-scan/route.ts       # ★ Authenticated overview + six-tile reconstruction/OCR endpoint
│     └─ admin/
│        ├─ schools/route.ts     # POST create school (super_admin only, service role)
│        └─ users/route.ts       # POST create user + PATCH activate/deactivate (service role)
│
├─ components/
│  ├─ GRRecordForm.tsx           # ★ The GR data model + create/edit/verify form
│  ├─ GuidedRegisterScanner.tsx  # ★ Mobile overview + six guided close-ups + quality/review flow
│  └─ ImageUploader.tsx          # Upload-to-Storage widget (per-school folder)
│
├─ lib/
│  ├─ supabase.ts                # Browser Supabase client (anon key)
│  ├─ auth-context.tsx           # ★ Browser auth/session/profile provider + route protection
│  ├─ server-auth.ts             # ★ Server bearer verification + active-profile/role authorization
│  ├─ ocr-types.ts               # Client-safe OCR, compare, scan quality, and response contracts
│  ├─ ocr-pipeline.ts            # ★ Shared server-only production/compare provider orchestration
│  ├─ reconstruct-register.ts    # ★ Sharp quality checks + deterministic 2×3 tiled reconstruction
│  ├─ ocr.ts                     # ★ Raw-text anchor: Sarvam Doc AI digitise, OCR.space fallback + two-page split
│  ├─ sarvam-doc-ai.ts           # ★ Sarvam Document AI (Vision 1.5): digitise anchor + schema extract
│  ├─ image-prep.ts              # Mobile-photo preprocessing (grayscale/contrast/upscale) for every reader
│  ├─ extract-shared.ts          # ★ Shared 19-field contract + FIELD_DESCRIPTIONS, GR-domain prompts, retry, sanitize
│  ├─ gemini-extract.ts          # Gemini vision + text structuring (model-selectable)
│  ├─ openai-extract.ts          # OpenAI GPT-5 vision structuring (model-selectable)
│  ├─ mistral-extract.ts         # Mistral vision structuring
│  ├─ sarvam-structure.ts        # Sarvam chat text structuring (Gujarati-native, last resort)
│  ├─ ocr-parser.ts              # Client-side heuristic table parser (FALLBACK) + types
│  ├─ gujarati.ts                # Gujarati numeral / date / standard formatting helpers
│  ├─ setup-phase2.ts            # One-time DB bootstrap (tables, users, RLS, seed)
│  ├─ setup-storage.ts           # One-time Storage bucket + storage RLS policies
│  └─ setup-phase9.ts            # Adds profiles.is_active column
│
├─ scripts/
│  ├─ apply-migration.mjs        # Apply a .sql migration file in a transaction
│  ├─ provision-school.mjs       # Create/repair a school tenant + attach an admin login
│  └─ verify-tenancy.mjs         # Prove RLS isolation by signing in as real users
│
├─ supabase/migrations/
│  ├─ 20260624_001_create_core_tables.sql
│  ├─ 20260624_002_rls_policies.sql
│  ├─ 20260624_003_seed_test_data.sql
│  ├─ 20260628_004_expand_gr_fields.sql
│  └─ 20260726_005_schools_rls.sql
│
├─ assests/                      # (sic) PRD + brochure/ledger PDFs
├─ Sample-img/                   # Two real Gujarati register scans used for testing
└─ public/                       # Static SVGs
```

★ = the most important files to read first.

---

## 5. Environment variables

All are documented in [`.env.local.example`](.env.local.example). Copy to `.env.local`.

**Supabase (required):**
- `NEXT_PUBLIC_SUPABASE_URL` — project URL (used client + server).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key for the browser client.
- `SUPABASE_SERVICE_ROLE_KEY` — **full RLS bypass**; used only by server API routes and setup scripts. OCR routes use it only after validating the caller's bearer token, active profile, role, and school. Server-side only.
- `SUPABASE_DB_PASSWORD` — Postgres password; setup/migration scripts rebuild a direct `postgresql://…` connection string from it.

**Extraction chain (configure as many as possible; Sarvam and/or Gemini strongly recommended):**
- `SARVAM_API_KEY` — powers **Sarvam Document AI** (Vision 1.5): the **primary raw-text anchor** (`digitise`), the first structured extractor (`sarvam-doc-ai-extract`), *and* the tertiary chat text-structurer. One key, three roles (sent as the `api-subscription-key` header).
  - optional `SARVAM_DOC_AI_CONTENT_TYPE` (default `handwritten`; one of `printed`|`handwritten`|`mixed` — auto-falls-back to Sarvam's default if the value is rejected)
  - optional `SARVAM_DOC_AI_MODEL` (default `sarvam-vision-v1`); optional `SARVAM_MODEL` (chat structurer, default `sarvam-30b`)
- `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`, default `gemini-2.5-flash`; set `gemini-2.5-pro` / `gemini-3.1-pro-preview` for far better handwriting). Free key from Google AI Studio.
- `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, default `gpt-5.6`) — OpenAI GPT‑5 vision (paid; top handwriting accuracy).
- `MISTRAL_API_KEY` (+ optional `MISTRAL_MODEL`, default `mistral-small-latest`) — Mistral vision provider.
- `OCR_SPACE_API_KEY` — **fallback** raw-OCR anchor, used only when Sarvam Document AI is unset / fails / times out; also feeds the client heuristic parser.

**Extraction tuning (all optional):** `OCR_PREPROCESS` (default on), `OCR_EXTRACTOR_ORDER`
(production chain order), `OCR_DEBUG_COMPARE` (enable the compare diagnostic),
`OCR_COMPARE_GEMINI_MODELS` / `OCR_COMPARE_OPENAI_MODELS` (models the compare tool runs).

If no provider key is set, the endpoint returns only raw OCR text for manual entry.

> **Security note:** the service-role key and DB password are highly sensitive. The
> earlier audit flagged that live secrets had been committed to the working tree — keep
> real values only in `.env.local` (gitignored) and rotate anything that leaked.

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

### `gr_records` — the digitized register rows (~26 columns)
Unique constraint: **`(school_id, gr_number)`**. Indexes on `school_id`,
`(school_id, student_name)`, `(school_id, surname)`. An `updated_at` trigger keeps the
timestamp fresh.

Left-page / main detail fields (migration 001 + 004):
`gr_number`*, `student_name`*, `fathers_name`*, `mothers_name`, `surname`*,
`religion`, `caste_category`, `date_of_birth`* (date), `dob_in_words`, `birth_place`,
`address`, `previous_school`.

Right-page / academic fields (migration 004):
`admission_date`* (date), `admission_standard`, `progress_and_conduct`,
`leaving_date` (date), `leaving_reason`, `leaving_standard`, `remarks`.

System fields:
`id` (uuid PK), `school_id`* (FK → schools, cascade), `image_url` (Storage path),
`ocr_raw_text` (audit of what OCR read), `created_by` (FK → profiles),
`created_at`, `updated_at`.

(* = required at the form/DB level. Form-required set:
`gr_number, student_name, fathers_name, surname, date_of_birth, admission_date`.)

### Storage bucket `gr-images`
- **Private**, 10 MB file-size limit, MIME allow-list: JPEG, PNG, WebP, TIFF, PDF.
- Path convention: **`{school_id}/{uuid}.{ext}`** — the leading folder is the tenant key.
- Read access uses **signed URLs** (1-hour expiry) generated on the record detail page.

### Relationships
```
schools (1) ─── (many) profiles        [role: super_admin/school_admin/staff/principal]
schools (1) ─── (many) gr_records
gr_records (1) ─── (1) scanned image    [Storage object at {school_id}/{uuid}.{ext}]
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

> Admin and OCR POST routes use the **service-role key** and therefore **bypass RLS by
> design**. `lib/server-auth.ts` verifies the bearer token and active profile first;
> OCR is limited to `staff`/`school_admin`, and every stored guided scan is forced into
> the authenticated caller's school folder. `GET /api/ocr-test` remains a non-billable
> public health check.

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

## 9. ★ The core pipeline: scan → OCR → AI extraction → verify → save

This is the heart of the app. End-to-end trace:

```
Single photo:
ImageUploader → Storage `{school_id}/{uuid}.{ext}` → POST /api/ocr-test

Guided high-resolution scan:
GuidedRegisterScanner
  → overview + six ordered close-ups (2 rows × 3 columns)
  → authenticated POST /api/ocr-scan
  → lib/reconstruct-register.ts quality checks + deterministic 4200×2000 JPEG
  → Storage `{school_id}/guided-....jpg`

Both paths
      ▼
lib/ocr-pipeline.ts  (shared server-only orchestrator)
   1) lib/ocr.ts extractText(buffer)         → raw transcription anchor (Sarvam Doc AI digitise, else OCR.space)
   2) build an ordered list of extraction "attempts" (see below)
   3) run attempts in order; FIRST that returns ≥1 record wins
   4) always return the human-readable OCR text alongside the structured records
      ▼
GRRecordForm: shows records; if 1 record, auto-applies it; if many, user picks one
      ▼
handleSubmit → supabase.from('gr_records').insert/update (RLS-enforced)  → /dashboard/records
```

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
- Holds the **`GRRecordData`** type (19 GR fields + `image_url` + `ocr_raw_text`) and the
  bilingual `FIELD_LABELS` (`"ગુજરાતી / English"`).
- Renders each field with a **confidence dot** (green=high, amber=medium, red=low) when
  it was auto-filled from extraction; editing a field clears its auto-filled flag.
- Multi-record pages: if the page has several students, the user selects which one to
  load into the form; a single record auto-applies.
- `handleSubmit` builds a payload (trimming, `'' → null` for optionals), then on
  **create** inserts with `school_id: profile.school_id`, `created_by: profile.id`,
  `ocr_raw_text`; on **edit** updates by `id`. RLS enforces tenancy on write.

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

---

## 10. Feature modules (mapped to routes)

| Module | Where | Notes |
|---|---|---|
| Auth & roles | `lib/auth-context.tsx`, `app/login/page.tsx` | Supabase Auth; role drives nav & guards |
| Tenant isolation | `supabase/migrations/…_002` & `…_005`, `setup-storage.ts` | RLS on profiles, gr_records, schools, storage |
| Image upload & storage | `components/ImageUploader.tsx` | per-school folder in `gr-images` |
| Guided tiled scanner | `components/GuidedRegisterScanner.tsx`, `app/api/ocr-scan/route.ts`, `lib/reconstruct-register.ts` | authenticated overview + six close-ups; quality metadata; deterministic 4200×2000 reconstruction |
| OCR + AI extraction | `lib/ocr-pipeline.ts`, `app/api/ocr-test/route.ts`, `lib/ocr.ts`, `lib/*-extract.ts`, `lib/sarvam-structure.ts`, `lib/extract-shared.ts`, `lib/ocr-parser.ts` | shared production/compare pipeline (§9) |
| GR record form | `components/GRRecordForm.tsx` | create/edit/verify with confidence dots |
| Records browse/search | `app/dashboard/records/page.tsx` | search GR/name/father/surname/DOB/std; std + status filters; sort; print; `/` focuses search; Enter jumps to exact GR |
| Record detail | `app/dashboard/records/[id]/page.tsx` | two-page spread view; signed-URL scan; collapsible raw OCR; delete (school_admin) |
| Dashboard/home | `app/dashboard/page.tsx` | totals (studying/left/this-week) + per-standard bars from one query |
| School management | `app/dashboard/schools/page.tsx` + `app/api/admin/schools` | super_admin creates schools & provisions first admin |
| Staff management | `app/dashboard/staff/page.tsx` + `app/api/admin/users` | school_admin creates staff/principal; activate/deactivate |

### Route inventory
Public: `/` (landing), `/login`, `not-found`.
Auth-gated under `/dashboard` (role-based nav in `dashboard/layout.tsx`):
- `super_admin`: Home, **Schools**.
- `school_admin`: Home, **Records**, **Staff**.
- `staff` / `principal`: Home, **Records** (principal is read-only).
Record routes: `/dashboard/records`, `/dashboard/records/new`,
`/dashboard/records/[id]`, `/dashboard/records/[id]/edit`.

### API routes (all server-side, service-role, with explicit role checks)
- `POST /api/ocr-test` — extraction (multipart `image`); `GET` — health/strategy list.
- `POST /api/admin/schools` — create school (super_admin only).
- `POST /api/admin/users` — create auth user + profile (school_admin → staff/principal in
  own school; super_admin → school_admin). Rolls back the auth user if the profile insert
  fails. `PATCH /api/admin/users` — school_admin toggles `is_active` (can't touch another
  school_admin or another school's user).

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

> `profiles.is_active` is **not** in a migration — it is added by `lib/setup-phase9.ts`.
> If you rebuild the DB from migrations alone, add this column too.

### One-time setup scripts (`lib/setup-*.ts`, run with `npx tsx`)
- **`setup-phase2.ts`** — idempotent full bootstrap: creates tables/enum/indexes/trigger,
  2 test schools (UUIDs `a0000…0001` / `b0000…0002`), **7 test auth users** (shared
  password `TestPass123!`) + profiles, 2 sample GR records, and all 10 RLS policies +
  helpers. Connects to Postgres directly using `SUPABASE_DB_PASSWORD`.
- **`setup-storage.ts`** — creates the private `gr-images` bucket (10 MB, MIME allow-list)
  and the 5 storage RLS policies keyed on the `{school_id}/` path prefix.
- **`setup-phase9.ts`** — `ALTER TABLE profiles ADD COLUMN is_active`.

Test accounts (from `setup-phase2.ts`): `super@test.com`, `admin-a@test.com`,
`staff-a@test.com`, `principal-a@test.com`, and the `-b` equivalents — all `TestPass123!`.

### Ops scripts (`scripts/*.mjs`, run with `node`)
- **`apply-migration.mjs <path.sql>`** — runs a migration file inside one transaction
  (rolls back on error); tries the direct DB host, then pooler hosts.
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
- **Adding a GR field** touches many places: DB migration → `STRING_FIELDS` &
  prompts in `extract-shared.ts` → `ParsedGRFields` in `ocr-parser.ts` → `GRRecordData`,
  `FIELD_LABELS`, `PARSEABLE_FIELDS`, payload in `GRRecordForm.tsx` → detail & edit pages.

### Known issues / findings (see `AUDIT_REPORT.md` for the full list)
- **Committed secrets (HIGH):** real Supabase service-role key, DB password, and OCR key
  had been present on disk — rotate and keep only `.env.local.example` in git.
- **ESLint (MEDIUM):** `npm run lint` reports pre-existing errors (build still passes):
  a `Field`/`Entry` component is defined **inside render** in
  `records/[id]/page.tsx` (React 19 rule); a `setState`-in-`useEffect` and unused symbols
  in `GRRecordForm.tsx`; several `<img>`-instead-of-`next/image` warnings.
- **OCR fault-tolerance & two-page split (MEDIUM):** addressed in `lib/ocr.ts`
  (concurrent dual-pass + sharp page split) — see §9.
- **Naming:** the production extraction endpoint is `/api/ocr-test` (kept despite the
  "test" name — `GRRecordForm` depends on it). The assets folder is misspelled `assests/`.
- **No tests/CI:** there is no test framework, no `test` script, and lint is not enforced
  in build.
- Accuracy is ultimately bounded by handwriting quality — the **mandatory human review**
  step in `GRRecordForm` is the final safety net, by design.

---

## 13. Quick start (for a new contributor or agent)

```bash
# 1. Install deps
npm install

# 2. Configure environment
cp .env.local.example .env.local   # then fill in real values

# 3. Provision the backend (once), against your Supabase project
npx tsx lib/setup-phase2.ts        # tables, users, RLS, seed
npx tsx lib/setup-storage.ts       # gr-images bucket + storage policies
npx tsx lib/setup-phase9.ts        # profiles.is_active
node scripts/apply-migration.mjs supabase/migrations/20260726_005_schools_rls.sql

# 4. Run the dev server (run manually in your own terminal — don't background it)
npm run dev                        # http://localhost:3000

# 5. Verify tenant isolation any time
node scripts/verify-tenancy.mjs
```

Sign in with a seeded account (e.g. `staff-a@test.com` / `TestPass123!`), open **New
entry**, upload a scan from `Sample-img/`, watch the fields auto-fill, verify, and save.

**First files to read:** `app/api/ocr-test/route.ts` → `lib/extract-shared.ts` →
`lib/ocr.ts` → `components/GRRecordForm.tsx` → `supabase/migrations/…_002_rls_policies.sql`.
