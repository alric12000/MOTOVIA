# MotoviaNepal — Business App

Private, mobile-first web app to run MotoviaNepal: order entry, order status tracking,
inventory with transactional stock, expenses, ad spend, a live dashboard, printable invoices,
editable dropdown settings, and an XLSX importer for your existing tracker spreadsheet.

- **Frontend:** React + Vite (SPA)
- **Backend:** Firebase — Firestore + Email/Password Auth (no Cloud Functions; stock stays
  consistent via Firestore transactions, so it runs 100% free on the Spark plan)
- **Hosting:** Vercel (free Hobby plan)

## 1. Install

```bash
cd app
npm install
```

## 2. Create the Firebase project (one time, free)

1. Go to https://console.firebase.google.com → **Add project** (Google Analytics optional).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Authentication → Users → Add user** — create your single login (email + password).
4. **Build → Firestore Database → Create database → Production mode** → pick a region.
5. **Firestore → Rules** — paste the contents of [`firestore.rules`](firestore.rules) and Publish.
   (Only your signed-in user can read/write; there is no public access.)
6. **Project settings (gear) → Your apps → Web app (`</>`)** → register an app → copy the config.

## 3. Configure keys

```bash
cp .env.example .env
```

Fill `.env` with the values from the Firebase web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173 and sign in with the user you created.

## 5. Load your data

Two ways to get started:

- **Import your spreadsheet** (recommended): **More → Import spreadsheet**, choose
  `Re_Advanced_Business_Tracker.xlsx`. You'll first see every detected sheet and its field
  names (nothing is saved yet). Click **Continue → preview import** to see counts and any rows
  that need attention, then **Import into database**. Re-importing is safe — products are matched
  by SKU, customers by phone/name, orders by order ID, and expenses/ad-spend by content, so
  nothing duplicates and the order counter only ever moves forward.
- **Or seed defaults**: **More → Seed default products & lists** creates Shampoo / FoamX / Towel,
  the Wash Combo + Clean Wash Combo bundles, and all dropdown lists.

## 6. Deploy to Vercel (free)

The repo root holds this project in an `app/` subfolder, so Vercel needs its **Root
Directory** pointed at `app` — everything else is read from [`vercel.json`](vercel.json).

1. Push to GitHub/GitLab (this repo is already on GitHub).
2. Vercel → **Add New… → Project** → import the repo.
3. **Root Directory:** click *Edit* and set it to `app`. Framework should then be detected
   as **Vite**; build command `npm run build` and output directory `dist` come from
   `vercel.json`, so leave them on the defaults it shows.
4. Expand **Environment Variables** and add the same six `VITE_FIREBASE_*` values from your
   local `.env`. They must be present *before* the first build — Vite inlines them at build
   time, so adding them later requires a redeploy.
5. **Deploy.**
6. In Firebase → **Authentication → Settings → Authorized domains**, add your Vercel domains
   (`your-project.vercel.app`, plus any custom domain). Login fails with
   `auth/unauthorized-domain` until you do.

Every push to `main` redeploys production; pushes to other branches get preview URLs. Preview
deployments are publicly reachable by default — if that matters, turn on
**Settings → Deployment Protection → Vercel Authentication**.

### A note on the Firebase keys

`VITE_FIREBASE_*` values are compiled into the JavaScript bundle and are visible to anyone who
loads the site. That is normal and expected for Firebase web apps — the API key identifies the
project, it does not grant access. What actually protects your data is
[`firestore.rules`](firestore.rules) requiring an authenticated user, so keep those rules
published and keep sign-up disabled in the Firebase console.

## How things work

- **Stock** is authoritative: `remaining = opening + restocked − sold`. `sold_qty` is updated
  atomically inside a Firestore transaction whenever an order is created or its status flips
  in/out of Returned/Cancelled — so rapid taps can't corrupt the count.
- **Bundles** (Wash Combo = Shampoo + FoamX; Clean Wash Combo adds Towel) deduct their
  component stock, not a bundle counter.
- **Order numbers** (`ORD-####`) are allocated from a counter doc inside the same transaction.
- **Dashboard** figures are always computed live from orders/expenses/ad-spend; Returned and
  Cancelled orders are excluded from revenue and COGS.
- **Settings** drives every dropdown — edit lists there, no code changes needed.

## Known data quirks handled on import

Your existing sheet has a few rough edges; the importer cleans them rather than failing:

| Quirk in the sheet | What the app does |
| --- | --- |
| Phones as `9.818156042E9` | Converted to `9818156042` |
| Placeholder phone `98XXXXXXXX` | Kept as-is and flagged so you can fix it |
| Expense date `2026-08-320` (invalid) | Flagged in the preview's "needs attention" list |
| One order's Address holds a phone number | Imported verbatim for you to correct |
| Names with trailing spaces/newlines | Trimmed |
| Component named `Foam X` vs `FoamX` on orders | Matched via normalized names |
| Missing `ORD-1017` | Simply absent; the gap is fine |

## Project layout

```
src/lib/         firebase init, transactions (inventory.js), calculations (calc.js),
                 spreadsheet parse (importXlsx.js) + commit (commitImport.js)
src/pages/       Login, Dashboard, OrderEntry, Orders, Inventory, Expenses, AdSpend,
                 Invoice, Settings, Import, More
src/components/  Nav, TopBar, ProtectedRoute, StatusButtons
firestore.rules  security rules (auth-only)
vercel.json      build + SPA rewrite
```
