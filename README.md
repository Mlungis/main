# ResFix — Residence Maintenance Management System

> A web-based maintenance reporting platform built for student residences. Residents submit and track issues; maintenance staff manage, prioritise, and resolve them — all in one place.

---

## Table of Contents

- [Overview](#overview)
- [Live Pages](#live-pages)
- [Features](#features)
  - [Resident Features](#resident-features)
  - [Maintenance Features](#maintenance-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Authentication & Role Routing](#authentication--role-routing)
- [Setup & Deployment](#setup--deployment)
  - [1. Clone or Download](#1-clone-or-download)
  - [2. Supabase Project](#2-supabase-project)
  - [3. Run the SQL Schema](#3-run-the-sql-schema)
  - [4. Create Storage Bucket](#4-create-storage-bucket)
  - [5. Optional — Auto-Delete via pg_cron](#5-optional--auto-delete-via-pg_cron)
  - [6. Deploy](#6-deploy)
- [Environment Configuration](#environment-configuration)
- [Maintenance Account](#maintenance-account)
- [Page Reference](#page-reference)
- [User Flows](#user-flows)
  - [Resident Flow](#resident-flow)
  - [Maintenance Flow](#maintenance-flow)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

---

## Overview

ResFix is a fully client-side web application that connects student residents with their maintenance team. There are no servers to maintain — the entire backend runs on **Supabase** (PostgreSQL + Auth + Storage), while all pages are plain HTML/CSS/JavaScript files that can be hosted on any static host (Netlify, Vercel, GitHub Pages, etc.).

The system has two distinct roles:

| Role | Access | Credentials |
|------|--------|-------------|
| **Resident** | Submit, view, edit, and delete their own reports | Register with any email |
| **Maintenance** | View all reports, update statuses, bulk actions, analytics | Fixed account — see below |

---

## Live Pages

| File | Purpose |
|------|---------|
| `landing.html` | Public landing/marketing page |
| `login.html` | Sign-in page with role-based routing |
| `register.html` | New resident account registration |
| `index.html` | Resident dashboard — submit & manage own reports |
| `mainDash.html` | Maintenance dashboard — full admin view of all reports |

---

## Features

### Resident Features

- **Submit maintenance reports** with category, room number, unit/block, and description (up to 600 characters)
- **Attach up to 2 photos** (JPG, PNG, WebP) per report — uploaded to Supabase Storage and stored as public URLs
- **Track report status** live — Pending, In Progress, Resolved, or Rejected
- **Edit reports** via an in-page modal (category, room, unit, description)
- **Delete reports** with a confirmation dialog
- **View full report details** in a slide-in detail modal including photos, submitted date, and auto-delete countdown
- **Auto-delete notice** — resolved reports show a live countdown ("2d remaining") so residents know when they'll be removed
- **Skeleton loading states** while data fetches from the database
- **Refresh button** to manually re-fetch the latest data
- **Greeting** personalised with the user's name and time of day
- **Sign out** with Supabase session termination

### Maintenance Features

- **Full reports table** showing all reports from all residents across the entire residence
- **Inline status updates** — change status directly in the table row without opening a panel
- **Detail side panel** — slide-in panel with full report info, photos, status selector, internal notes (saved locally), and activity timeline
- **Bulk selection** — checkbox per row, select all on page, with a floating bulk action bar
  - Bulk change status (any of the 4 statuses)
  - Bulk delete with confirmation
- **Filter by status** — sidebar navigation and filter chips (All / Pending / In Progress / Resolved / Rejected)
- **Filter by category** — sidebar links for Plumbing, Electrical, Wi-Fi, Furniture, Cleaning
- **Global search** — searches across category, room, unit, description, and status
- **Sort** — by newest, oldest, status, category, or room; also sortable by clicking column headers
- **Pagination** — 15 reports per page with smart page number display
- **Analytics charts** (Chart.js):
  - Donut chart — reports by status
  - Bar chart — reports by category
- **5-stat summary cards** — Total, Pending, In Progress, Resolved, Rejected with colour-coded top borders
- **Notification bell** — lights up when any pending report is older than 3 days
- **Real-time subscription** — Supabase Realtime channel updates the table, stats, and charts the moment any resident submits, edits, or deletes a report — no refresh needed
- **Auto-delete** — on every page load, resolved reports older than 3 days are automatically deleted from the database
- **Internal notes** — per-report notes saved to `localStorage` (private, browser-only)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES2022) — no framework |
| **Database** | Supabase (PostgreSQL 15) |
| **Authentication** | Supabase Auth (email + password) |
| **File Storage** | Supabase Storage (`report-photos` bucket) |
| **Real-time** | Supabase Realtime (Postgres Changes) |
| **Charts** | Chart.js 4.4 |
| **Fonts** | Google Fonts — Syne (headings), DM Sans (body), DM Mono (labels/mono) |
| **Icons** | Inline SVG (no icon library dependency) |
| **Hosting** | Any static host (Netlify, Vercel, GitHub Pages, etc.) |

**Zero build step required.** Open any HTML file directly in a browser or deploy the folder as-is.

---

## Project Structure

```
resfix/
│
├── landing.html          # Public marketing/home page
├── login.html            # Login with role detection & routing
├── register.html         # Resident registration
├── index.html            # Resident dashboard
├── mainDash.html         # Maintenance admin dashboard
│
├── supabase_schema.sql   # Full DB schema — run once in Supabase SQL Editor
│
└── README.md             # This file
```

> **Note:** There is no `style.css` — all styles are scoped within each HTML file's `<style>` block. All pages share the same CSS design tokens (variables), fonts, and component patterns for visual consistency.

---

## Database Schema

The application uses a single primary table: **`reports`**

```sql
reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,            -- links to auth.users (nullable for now)
  category      TEXT NOT NULL,   -- plumbing | electrical | furniture | wifi | cleaning | other
  room          TEXT NOT NULL,   -- e.g. "204"
  unit          TEXT NOT NULL,   -- e.g. "Block A, Jameson House"
  description   TEXT NOT NULL,   -- max 600 chars enforced on frontend
  picture_1     TEXT,            -- public URL from Supabase Storage (nullable)
  picture_2     TEXT,            -- public URL from Supabase Storage (nullable)
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','resolved','rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- auto-updated via trigger
)
```

**Indexes:**
- `idx_reports_status` — fast filtering by status
- `idx_reports_created_at DESC` — fast ordering by date
- `idx_reports_user_id` — prepared for per-user RLS queries

**Trigger:** `trg_reports_updated_at` — automatically sets `updated_at = NOW()` on every `UPDATE`

**Row Level Security:** Enabled. Currently open policies for `SELECT`, `INSERT`, and `UPDATE` (suitable for development; tighten per user once full auth is wired).

**Storage:** A public bucket named `report-photos`. Each uploaded file is stored at a randomised path (`{timestamp}_{random}.{ext}`) and its public URL is saved to `picture_1` or `picture_2`.

**Users table:** A secondary `Users` table stores `Name` and `Email` at registration time (mirrors Supabase Auth metadata).

---

## Authentication & Role Routing

ResFix uses **Supabase Auth** (email + password). Role separation is done purely by email address — there is no roles table or JWT claim.

```
Login → check email → route to correct dashboard
```

| Email | Destination | Role |
|-------|------------|------|
| `Maintanance@Res.com` | `mainDash.html` | Maintenance |
| Any other confirmed email | `index.html` | Resident |

**Auth guards are on every protected page:**

| Page | Guard behaviour |
|------|----------------|
| `index.html` | No session → `login.html` · Maintenance email → `mainDash.html` |
| `mainDash.html` | No session → `login.html` · Non-maintenance email → `index.html` |

**Session persistence:** Supabase handles session tokens via `localStorage`. If a user is already logged in when they visit `login.html` or `register.html`, they are immediately redirected to their correct dashboard without seeing the form.

**Registration guard:** The maintenance email address is blocked from the registration form. An error is shown if someone attempts to register with it.

---

## Setup & Deployment

### 1. Clone or Download

```bash
git clone https://github.com/your-username/resfix.git
cd resfix
```

Or simply download the ZIP and extract the folder.

### 2. Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (note your project region — choose one close to your users)
3. Once the project is ready, go to **Settings → API** and copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — a long JWT string

4. Open each of the following files and replace the placeholder values:

```js
// In: login.html, register.html, index.html, mainDash.html
const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

> The credentials are currently pre-filled with the original development project. Replace them with your own project for a production deployment.

### 3. Run the SQL Schema

1. In your Supabase Dashboard, go to **SQL Editor → New Query**
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**

This creates:
- The `reports` table with all columns, constraints, and indexes
- The `set_updated_at` trigger function
- Row Level Security policies
- The `report-photos` storage bucket entry

### 4. Create Storage Bucket

The SQL schema inserts the bucket record, but you also need to create it in the UI:

1. Go to **Storage** in your Supabase Dashboard
2. Click **New bucket**
3. Name it exactly: `report-photos`
4. Toggle **Public bucket** to ON
5. Click **Create bucket**

### 5. Optional — Auto-Delete via pg_cron

The frontend already auto-deletes resolved reports older than 3 days on every page load. For a more reliable server-side solution:

1. Go to **Database → Extensions** and enable `pg_cron`
2. In the SQL Editor, run:

```sql
SELECT cron.schedule(
  'delete-old-resolved-reports',
  '0 * * * *',
  $$
    DELETE FROM reports
    WHERE status = 'resolved'
      AND updated_at < NOW() - INTERVAL '3 days';
  $$
);
```

This schedules a job that runs every hour and removes qualifying rows automatically.

### 6. Deploy

Since ResFix is 100% static HTML, deploy by uploading the folder to any static host:

**Netlify (recommended):**
```bash
# Drag and drop the project folder onto netlify.com/drop
# or use the CLI:
npm install -g netlify-cli
netlify deploy --prod --dir .
```

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**GitHub Pages:**
Push to a GitHub repository and enable Pages from the repo settings (root of `main` branch).

---

## Environment Configuration

All configuration lives in the `<script>` block at the bottom of each HTML file. There are no `.env` files or build steps.

| Constant | Description | Files |
|----------|-------------|-------|
| `SUPABASE_URL` | Your Supabase project URL | All 5 pages |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public API key | All 5 pages |
| `STORAGE_BUCKET` | Name of the storage bucket | `index.html`, `mainDash.html` |
| `MAINTENANCE_EMAIL` | The reserved maintenance email (lowercase) | `login.html`, `register.html`, `index.html`, `mainDash.html` |
| `AUTO_DELETE_DAYS` | Days after resolution before auto-delete | `index.html` |
| `PAGE_SIZE` | Rows per page in the maintenance table | `mainDash.html` |

---

## Maintenance Account

The maintenance account is a fixed Supabase Auth user. It must be created manually:

1. In your Supabase Dashboard, go to **Authentication → Users**
2. Click **Invite user** (or **Add user**)
3. Enter:
   - **Email:** `Maintanance@Res.com`
   - **Password:** `Resfix@2026`
4. Confirm the account (skip email confirmation if testing locally)

> **Security note:** Change the default password before deploying to production. Update `MAINTENANCE_EMAIL` in all files if you use a different address.

---

## Page Reference

### `landing.html` — Home / Marketing Page
- Sticky navbar with smooth-scroll links
- Hero section with animated headline, CTA buttons, and proof strip
- Stats strip (2 min submit time, real-time updates, etc.)
- "How it works" — 3 step cards (Submit → Review → Resolved)
- Features section — 6 feature tiles on dark background
- Two-role section — Resident card (light) and Maintenance card (dark)
- Bottom CTA and footer

### `login.html` — Sign In
- Role selector cards (Resident / Maintenance) with auto-detection from email input
- Clicking "Maintenance" pre-fills the email field
- Password visibility toggle
- Role mismatch guard (blocks wrong-role logins before hitting Supabase)
- Success overlay with green animation before redirect
- Session check on load — skips form if already authenticated

### `register.html` — Create Account
- 3-step progress indicator (Details → Security → Done) that updates live as fields are filled
- Full name, email, password, confirm password fields with per-field validation states
- Password strength meter (Very weak → Very strong) with colour-coded bar
- Terms of service checkbox with auto-delete policy notice
- Maintenance email blocked from registering
- Email confirmation overlay (shown when Supabase requires email verification)
- Success overlay with countdown redirect on instant session

### `index.html` — Resident Dashboard
- Auth guard (redirects if not logged in or if maintenance account)
- Personalised greeting (Good morning/afternoon/evening, [Name])
- 4 stat cards — Total, Pending, In Progress, Resolved
- Submit form — category, room, unit, description, photo upload (drag & drop)
- Reports table with skeleton loading, 7 columns including Actions column
- **View modal** — full report details, photos, expiry countdown
- **Edit modal** — pre-filled form, saves to Supabase
- **Delete modal** — confirmation before permanent deletion
- Auto-delete purge runs on load (removes resolved reports > 3 days old)
- Refresh button with spinning icon

### `mainDash.html` — Maintenance Dashboard
- Auth guard (maintenance only)
- Fixed left sidebar with status and category navigation, each with live counts
- Topbar with global search, notification bell, user avatar, sign out
- 5 stat cards with colour-coded top borders
- Chart.js donut (by status) and bar (by category) charts — both update in real-time
- Status filter chips and sort dropdown above the table
- Full reports table — 9 columns, sortable headers, inline status dropdown, checkbox selection
- Pagination (15/page) with smart ellipsis display
- **Detail panel** — slides in from right, full report info, status radio buttons, internal notes, activity timeline
- **Bulk action bar** — slides up from bottom when rows are selected
- **Bulk status modal** — pick new status for all selected
- **Delete confirm modal** — confirms before deletion
- Supabase Realtime subscription — auto-updates on any database change

---

## User Flows

### Resident Flow

```
landing.html
    ↓ "Create account"
register.html → Supabase signUp() → email confirmation (if required)
    ↓ confirmed
login.html → signInWithPassword() → session check
    ↓ non-maintenance email
index.html (resident dashboard)
    ├── Fill form → upload photos → INSERT into reports
    ├── View table → click row → view modal
    ├── Edit report → update modal → UPDATE in Supabase
    ├── Delete report → confirm modal → DELETE in Supabase
    └── Sign out → signOut() → login.html
```

### Maintenance Flow

```
landing.html → "Maintenance sign in"
    ↓
login.html → select Maintenance role → signInWithPassword()
    ↓ maintanance@res.com
mainDash.html (maintenance dashboard)
    ├── View all reports with filters, search, sort
    ├── Inline status update → UPDATE in Supabase
    ├── Open detail panel → change status → save → UPDATE
    ├── Add internal note → localStorage
    ├── Select rows → bulk status / bulk delete
    ├── Real-time subscription → live updates without refresh
    └── Sign out → signOut() → login.html
```

---

## Security Notes

- **Anon key is public** — the Supabase `anon` key is safe to expose in client-side code. It only grants the permissions defined by your RLS policies.
- **RLS policies** are currently open (any authenticated user can read/write all reports). For production, tighten these to `auth.uid() = user_id` so residents can only access their own reports.
- **Maintenance role** is email-based, not claim-based. For higher security, implement a custom JWT claim or a `roles` table with proper RLS guards.
- **Password storage** — passwords are handled entirely by Supabase Auth. They are never stored in the `Users` table or anywhere in the frontend code.
- **Photo URLs** — uploaded images are stored in a public Supabase Storage bucket. Anyone with the URL can view them. Use a private bucket with signed URLs for sensitive deployments.
- **No HTTPS enforcement** — ensure your hosting provider enforces HTTPS before deploying to production.

---

## Known Limitations

- The maintenance role is a single shared account. There is no support for multiple maintenance staff members with individual logins.
- Internal notes (from the detail panel) are saved in `localStorage` — they are browser-specific and not synced to the database.
- Real-time updates in the maintenance dashboard require the browser tab to remain open. There is no push notification support.
- The auto-delete job on the frontend only runs when the dashboard is loaded. Use the optional `pg_cron` setup for reliable server-side cleanup.
- Email confirmation behaviour depends on your Supabase project settings. Disable it under **Authentication → Settings** if you want instant logins during testing.

---

## Future Improvements

- [ ] Per-user RLS — residents see only their own reports
- [ ] Multiple maintenance staff accounts with a proper `roles` table
- [ ] Push notifications (via Supabase Edge Functions + Web Push API) when report status changes
- [ ] Email notifications to residents on status change
- [ ] Priority levels (Low / Medium / High / Urgent) on reports
- [ ] Assignee field — assign reports to specific maintenance staff members
- [ ] Admin panel for managing users and viewing audit logs
- [ ] Report export (CSV / PDF) from the maintenance dashboard
- [ ] Mobile app wrapper (PWA manifest + service worker)
- [ ] Dark mode toggle
- [ ] Pagination or infinite scroll on the resident dashboard
- [ ] Image lightbox for photo previews instead of `window.open`

---

## Acknowledgements

- **[Supabase](https://supabase.com)** — open-source Firebase alternative providing the database, auth, storage, and real-time subscriptions
- **[Chart.js](https://www.chartjs.org)** — flexible charting library used for the analytics section
- **[Google Fonts](https://fonts.google.com)** — Syne, DM Sans, and DM Mono typefaces

---

*Built with care for student residences. No frameworks. No build tools. Just clean HTML, CSS, and JavaScript.* 


LIVE LINK: https://maintananceapp.netlify.app
