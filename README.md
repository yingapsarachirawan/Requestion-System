# Requisition System — React + Supabase

This is a complete first working version of the Requisition System.

## Included Features

- Clean iOS / Mac-like UI theme
- Supabase authentication
- Role-based user profiles
- Dashboard summary
- Create request page
- General request workflow
- Material request workflow
- Buy new material request
- Use existing material request
- Multiple items per request
- File attachment upload using Supabase Storage
- My Requests page
- Approval Inbox page
- Request Detail page
- Approval timeline
- Line manager approval
- Admin approval
- Management approval
- Reject / return for correction / pass to management
- Material inventory page
- Issue material and update stock
- Mark returned material and restore stock
- Basic reports page
- Account settings page

## Tech Stack

- Frontend: React + Vite
- UI: Custom CSS, Inter font, Lucide icons
- Backend: Supabase
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Storage: Supabase Storage

---

## Step 1 — Create Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Open the project dashboard.
4. Go to **SQL Editor**.
5. Open `supabase/schema.sql` from this project.
6. Copy all SQL.
7. Paste it into Supabase SQL Editor.
8. Click **Run**.

This creates all database tables, policies, starter departments, starter inventory items, and the attachment bucket.

---

## Step 2 — Get Supabase Keys

In Supabase:

1. Go to **Project Settings**.
2. Go to **API**.
3. Copy:
   - Project URL
   - anon public key

---

## Step 3 — Create `.env`

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

You can copy `.env.example` and rename it to `.env`.

---

## Step 4 — Install and Run

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

---

## Step 5 — Create Test Accounts

Use the app signup page to create accounts.

Recommended test accounts:

- Officer
- Line Manager
- Admin Team
- Management

When creating an account, choose the role from the signup form.

Important: For testing line manager approval, create the **Line Manager account first**, then login as Officer and select that line manager in Settings or in the Create Request form.

---

## Request Workflow

### General Request

Officer submits request → Line Manager approves → Management approves only if required → Approved / Completed

### Material Request: Buy

Officer submits request → Line Manager approves → Admin reviews → Management approves if required → Approved / Completed

### Material Request: Use Existing Material

Officer submits request → Line Manager approves → Admin approves → Admin issues material → Inventory stock updates → Returned if required

---

## Main Files

```text
src/App.jsx
src/styles.css
src/pages/AuthPage.jsx
src/pages/DashboardPage.jsx
src/pages/CreateRequestPage.jsx
src/pages/MyRequestsPage.jsx
src/pages/ApprovalInboxPage.jsx
src/pages/RequestDetailPage.jsx
src/pages/InventoryPage.jsx
src/pages/ReportsPage.jsx
src/pages/SettingsPage.jsx
src/lib/supabaseClient.js
supabase/schema.sql
```

---

## Note About Security

This first version uses simple authenticated Row Level Security policies to make the system easy to run and test. After the workflow is approved, you should tighten policies so each role can only access the exact data/actions allowed.

