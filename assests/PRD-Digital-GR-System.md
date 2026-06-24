# Product Requirements Document: Digital GR System

**Version:** 1.0
**Date:** June 24, 2026
**Status:** Ready for development handoff
**Prepared for:** Build via AI coding agent (Claude Code or equivalent)

---

## 1. Overview

### 1.1 What This Is
A multi-tenant web application that digitizes school **GR (General Register)** records — the official student admission/enrollment register maintained by schools. Staff scan handwritten GR pages, the system extracts text via OCR, staff verify/correct the extracted data, and the result is a secure, searchable, cloud-backed digital record — replacing fragile paper registers vulnerable to termites, fire, flood, and physical wear.

### 1.2 Why
Physical GR registers are:
- A single point of failure (fire, flood, pests, decay can destroy decades of records permanently)
- Slow to search manually (staff flip through stacks of paper books to find one student)
- Not portable or shareable across devices

### 1.3 Goals
- Digitize and preserve GR records permanently, with redundant backup
- Make GR records instantly searchable by GR number, student name, father's name, surname, or DOB
- Work as a responsive web app — usable on PC, iOS, and Android via browser, no native app needed
- Support multiple schools as isolated tenants, each managed independently
- **Run on genuinely free infrastructure** at the target scale (under 500 records per school to start)

### 1.4 Non-Goals (out of scope for v1)
- Native mobile apps (web app only, responsive design covers mobile)
- Automated handwriting OCR with zero human review (not realistic — see OCR section)
- Self-service school sign-up (Super Admin onboards schools manually)
- Financial/Rojmel ledger features, certificate generation, or other adjacent features mentioned in the original brochure (future phase, not v1)
- Service Book digitization (future phase)

---

## 2. Users & Roles

Four roles, with strict data isolation between schools (a school's Admin/Staff/Principal can never see another school's data; only Super Admin sees across all schools).

| Role | Scope | Permissions |
|---|---|---|
| **Super Admin** | All schools | Create/manage school accounts, create School Admin accounts, view all schools' data, full system configuration |
| **School Admin** | Own school only | Manage their school's Staff and Principal accounts, full CRUD on their school's GR records, view all activity logs for their school |
| **Staff** | Own school only | Add new GR records (upload + OCR + verify + save), edit existing records, search/view records. Cannot delete records or manage users |
| **Principal** | Own school only | Search and view GR records only. No create/edit/delete access |

### 2.1 Onboarding Flow
1. Super Admin creates a new School entity (school name, address, contact info)
2. Super Admin creates the first School Admin account for that school, sends credentials
3. School Admin logs in and creates Staff / Principal accounts for their own school
4. No public registration page exists in v1

---

## 3. Core Data Model

### 3.1 GR Record Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| GR Number | Text/Number | Yes | Primary identifier within a school, should be unique per school |
| Student Name | Text | Yes | |
| Father's Name | Text | Yes | |
| Mother's Name | Text | No | |
| Surname | Text | Yes | |
| Date of Birth | Date | Yes | |
| Admission Date | Date | Yes | |
| Address | Text (long) | No | |
| Caste/Category | Text | No | e.g., General, OBC, SC, ST — keep as free text or dropdown, confirm with real register samples |
| Previous School | Text | No | |
| Scanned Image | File reference | Yes | Link to the original scanned page, stored in cloud storage |
| OCR Raw Text | Text (long) | Auto | Stores the raw OCR output for audit/debugging, not shown to end users by default |
| Created By | User reference | Auto | Which staff member created this record |
| Created At / Updated At | Timestamp | Auto | |
| School ID | Reference | Auto | Foreign key — enforces tenant isolation |

### 3.2 Entity Relationships
```
School (1) ──── (many) Users (role: admin/staff/principal)
School (1) ──── (many) GR Records
GR Record (1) ──── (1) Scanned Image file
```

---

## 4. Core Workflow: Digitizing a GR Record

This is the central user journey and should be built and tested first.

1. **Staff logs in** → lands on their school's dashboard
2. **Staff clicks "Add New GR Record"**
3. **Staff uploads a scanned image** of one GR page (from phone camera, scanner, or file picker)
4. **System sends image to Google Cloud Vision API** (DOCUMENT_TEXT_DETECTION mode)
5. **System receives raw OCR text back** and attempts to auto-map it into the form fields (GR Number, Name, Father's Name, DOB, etc.) using best-effort parsing — see 4.1
6. **Form pre-fills with whatever OCR extracted**, with low-confidence or unmapped fields left blank or flagged
7. **Staff reviews the form side-by-side with the original image**, manually corrects any errors (expected and necessary, since these are handwritten records)
8. **Staff clicks Save** → record is written to the database, image is stored in cloud storage, both linked together
9. **Record is now instantly searchable** by any staff/admin/principal at that school

### 4.1 On OCR Auto-Mapping Expectations
Handwritten registers will **not** map cleanly into fields automatically — this must be communicated honestly in the UI (e.g., "Review extracted text below — handwriting recognition may contain errors"). A realistic v1 approach:
- Show the raw OCR text extracted from the image in a side panel
- Let staff manually fill/correct the structured form fields, using the OCR text as a reference rather than assuming it's correct
- A "smart" field-mapping (regex/pattern matching to guess which OCR line is GR Number vs Name vs DOB) is a nice-to-have, not a v1 requirement — don't over-invest engineering effort here until real OCR output is tested against real sample images

---

## 5. Functional Requirements by Module

Build and test in this order — each module should work independently before the next is layered on.

### Module 1: Authentication & Role Management
- Email/password login (Supabase Auth)
- Role-based access control enforced both at UI level (hide unavailable actions) and database level (Row Level Security policies — critical, not optional, for tenant isolation)
- Super Admin can create School + first School Admin
- School Admin can create/deactivate Staff and Principal accounts for their school only

### Module 2: School & Tenant Data Isolation
- Every data table includes a `school_id` foreign key
- Supabase Row Level Security (RLS) policies enforce: a user can only read/write rows where `school_id` matches their own assigned school (except Super Admin, who bypasses this)
- This module should be tested explicitly with two dummy schools and confirmed that no cross-leakage occurs before building further features on top

### Module 3: Image Upload & Storage
- Staff can upload an image (JPG/PNG/PDF page) from device (camera or file picker)
- Image is stored in Supabase Storage, organized by school (e.g., `school_id/gr_number_or_uuid.jpg`)
- Image is associated with a GR record (created in the same flow)

### Module 4: OCR Integration
- On image upload, send image to Google Cloud Vision API using `DOCUMENT_TEXT_DETECTION`
- Store raw OCR text against the record
- Display raw OCR text to staff during the verify/edit step (Module 5)
- Handle and gracefully display OCR failures (e.g., blurry image, API quota exceeded) without blocking the manual entry path — staff should always be able to type data manually even if OCR fails

### Module 5: GR Record Form (Create/Edit/Verify)
- Form with all fields from Section 3.1
- Pre-fill from OCR where possible (best-effort, see 4.1)
- Validation: required fields enforced (GR Number, Student Name, Father's Name, Surname, DOB, Admission Date)
- Save creates/updates the record

### Module 6: Search
- Search bar searches across: GR Number, Student Name, Father's Name, Surname, Date of Birth
- Results show as a list/table, scoped to the logged-in user's school only
- Clicking a result opens the full record detail view (with the scanned image visible)

### Module 7: Record Detail View
- View all fields for one record
- View the linked scanned image
- Edit button (Staff/School Admin only — not visible to Principal)
- Delete button (School Admin only)

### Module 8: Dashboard / Home
- Simple landing page per role showing: total records digitized, recently added records, quick search bar, quick "Add New Record" button (Staff/Admin only)

### Module 9: Audit Trail (lightweight, v1)
- Track Created By and timestamps on every record (already in data model, Section 3.1)
- Not building a full activity log UI in v1 — just ensure the underlying data exists for future use

---

## 6. Technical Architecture

### 6.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js** (React) | Most widely supported framework by AI coding agents (Claude Code, Cursor, etc.), pairs natively with Vercel hosting, good built-in routing and API layer |
| Styling | Tailwind CSS | Fast to build with, works well with AI-assisted coding |
| Backend / Database | **Supabase** (Postgres) | Free tier includes database, authentication, file storage, and Row Level Security — covers nearly the entire backend in one free service |
| Authentication | Supabase Auth | Built-in, integrates directly with RLS policies for tenant isolation |
| File Storage | Supabase Storage | Free tier (1 GB storage, 2 GB bandwidth/month as of this writing — verify current limits before build, see Section 8) |
| OCR | **Google Cloud Vision API** (DOCUMENT_TEXT_DETECTION) | Free tier: 1,000 units/month per feature, does not expire, resets monthly. Well-suited to dense/handwritten document pages |
| Hosting | **Vercel** | Free tier, zero-config deploy from GitHub, built for Next.js |
| Version control | GitHub | Needed for Vercel auto-deploy integration |

### 6.2 Why Not Mistral OCR (for v1)
Mistral OCR was the original preference, but its free tier is explicitly for evaluation/prototyping, not production use — production OCR is billed (~$2 per 1,000 pages). To meet the genuine "$0 cost" requirement, **Google Cloud Vision API is the v1 OCR provider**. Mistral OCR remains a documented future option if/when accuracy comparisons justify a small ongoing cost (see Section 9).

### 6.3 Data Isolation Approach
Multi-tenancy is implemented via a shared database with a `school_id` column on every table, enforced by Postgres Row Level Security policies in Supabase. This is simpler and cheaper than separate databases per school, and is sufficient at this scale (multiple schools, hundreds of records each).

---

## 7. Non-Functional Requirements

- **Responsive design**: must work cleanly on desktop browsers, mobile Safari (iOS), and mobile Chrome (Android) — no native app
- **Security**: passwords never stored in plaintext (handled by Supabase Auth by default); RLS policies tested explicitly for cross-tenant leakage before launch
- **Data durability**: Supabase free tier includes daily backups on Postgres — confirm current retention policy before relying on it as the sole backup (see Section 8 open question)
- **Performance**: search should return results in well under 1 second at this record scale (hundreds, not millions, of rows — no special optimization needed at v1 scale)
- **Accessibility baseline**: visible keyboard focus states, adequate color contrast, readable font sizes — standard care, not a major design system effort

---

## 8. Open Questions / Risks to Confirm Before/During Build

These should be verified at build time since free-tier terms change:

1. **Supabase free tier current limits** — confirm current database size, storage size, and bandwidth caps directly on supabase.com/pricing before committing, as these change over time.
2. **Vercel free tier current limits** — confirm current bandwidth/build minute caps on vercel.com/pricing.
3. **Google Cloud Vision API account setup** — requires a Google Cloud project and billing account to be linked (even though usage stays free under 1,000 units/month) — confirm this doesn't introduce hidden requirements like mandatory card-on-file behavior that could risk unexpected charges; consider setting a hard billing cap/alert at $0 in GCP console as a safety net.
4. **OCR accuracy on real samples** — before building heavy auto-mapping logic, run 5-10 real scanned GR pages through Google Vision API directly and review raw output quality. This determines how much "smart parsing" effort is worth investing in Module 5.
5. **GR Number uniqueness** — confirm whether GR numbers are guaranteed unique within a school in the real registers being digitized, since this affects whether it can be used as a safe lookup key.

---

## 9. Future Phases (Not v1)

Documented for context, not to be built now:
- Mistral OCR or other higher-accuracy OCR as a paid upgrade path, if Google Vision accuracy proves insufficient on real handwriting samples
- Certificate generation (Birth, Bonafide, Character, Domicile certificates) — from the original brochure's "Gneya Technologies" feature set
- Service Book digitization for staff records
- Rojmel (financial ledger) management
- Self-service school onboarding/signup flow
- Full activity/audit log UI
- Bulk upload queue (upload many images at once, process as a batch with a review queue) — v1 is single-record-at-a-time upload

---

## 10. Build Sequencing Recommendation

Suggested order for a vibe-coding agent to implement and test incrementally:

1. Next.js project scaffold + Supabase connection + basic deploy to Vercel (confirm the pipeline works end-to-end with a "hello world" page first)
2. Auth + role-based login (Module 1)
3. School/tenant data model + RLS policies, tested with 2 dummy schools (Module 2) — **do not proceed past this step until cross-tenant isolation is verified**
4. Image upload to Supabase Storage (Module 3)
5. Google Vision OCR integration, tested against real sample images (Module 4)
6. GR record form with manual entry first, OCR pre-fill second (Module 5)
7. Search (Module 6)
8. Record detail view (Module 7)
9. Dashboard (Module 8)
10. Polish, responsive testing on real iOS/Android devices, then real-world pilot with one school's actual GR data before onboarding additional schools

---

## 11. Definition of Done (v1)

- A Super Admin can create a school and its first admin
- A School Admin can create staff and principal accounts
- A staff member can upload a scanned GR image, get OCR text back, manually verify/correct it, and save a complete record
- A principal can log in and search/view (but not edit) records for their school only
- Two different schools' data is confirmed fully isolated from each other
- The app is usable on a phone browser (iOS and Android) and a desktop browser without layout breakage
- Total infrastructure cost at under-500-records-per-school scale is $0
