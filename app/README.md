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

## AI auto-reply (Messenger, Instagram, WhatsApp, TikTok)

Customer messages arrive at Vercel functions in [`api/`](api), get an instant reply, and show
up live in **Inbox** (bottom tab). Everything runs on free tiers. There are still no Cloud
Functions, so Firebase stays on Spark.

**Pages:** Inbox (conversations, stats, global pause) · conversation view (history, manual
reply, pause bot here, mark handled) · **More → Bot Knowledge** (FAQs + reply templates) ·
**More → Test Bot** (try messages with no platform connected; "Run sample set" sends 15).

**How a reply is chosen**, cheapest first:

1. **Language** is detected without an LLM. Devanagari, Romanized Nepali words (ho, cha, kati,
   ma, ko, aaucha…) or a Nepali/English mix → reply in **Romanized Nepali**. Otherwise English.
2. **Greeting** ("hi", "namaste") → template, no LLM call.
3. **LLM** (`LLM_MODEL`, then `LLM_FALLBACK_MODEL` on error / 429 / invalid output). The prompt
   holds only the relevant products and FAQs, the last 6 messages, masked phone numbers and
   addresses, and `max_tokens` 220. Replies that contain Devanagari or a Rs. amount not in your
   data are rejected.
4. **Keyword FAQ matcher**: kati / rate / price / paisa, delivery / kati din, combo / k k
   aaucha, cod / esewa / khalti, return / exchange…
5. **"Our team will reply soon"** in the customer's language, and the conversation is flagged
   **needs human**.

The bot knows only live product names, prices, bundle contents and in/out of stock. It never
sees cost prices or exact counts. Payment methods come from Settings, and everything else from
Bot Knowledge.

**Speed vs. Meta's timeout:** webhooks check the signature, answer `200` immediately and finish
the LLM call + send with `waitUntil` (`@vercel/functions`) in the same invocation. Meta never
waits on the LLM and nothing needs a paid background-job feature. A message is processed once
per platform message id (`processed_events`), so Meta retries never cause double replies.

**Model choice:** `gemini-3.5-flash` (Google AI Studio free tier) first, then
`nvidia/nemotron-3-ultra-550b-a55b:free` on OpenRouter as fallback, both with `reasoning_effort=none`.
They are on **different providers with separate free quotas**, so the bot only falls back to
keyword answers when both are exhausted. OpenRouter alone allows only ~50 free-model requests/day
until the account has bought $10 of credits once (then ~1,000/day). Both models gave correct facts
and natural Romanized Nepali in a 15-message live test (Oct 2026). Gemini 2.5 models are retired
for new keys.

### Switching LLM provider (env vars only)

| Provider | `LLM_BASE_URL` | `LLM_MODEL` example |
| --- | --- | --- |
| OpenRouter (default fallback) | `https://openrouter.ai/api/v1` | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| Google Gemini free tier (default) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.5-flash` + fallback `gemini-3.5-flash-lite` (set `LLM_REASONING_EFFORT=none`, `LLM_FALLBACK_REASONING_EFFORT=low`) |
| Groq free tier | `https://api.groq.com/openai/v1` | see console.groq.com/docs/models |

### Environment variables

Set them in **Vercel → Project → Settings → Environment Variables** (Production and Preview),
then redeploy. All are listed with comments in [`.env.example`](.env.example):
`FIREBASE_SERVICE_ACCOUNT` (base64 service-account JSON), `LLM_BASE_URL`, `LLM_API_KEY`,
`LLM_MODEL`, `LLM_FALLBACK_MODEL`, `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_API_KEY`,
`LLM_REASONING_EFFORT`, `LLM_FALLBACK_REASONING_EFFORT`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `PAGE_ACCESS_TOKEN`,
`IG_ACCESS_TOKEN`/`IG_USER_ID` (optional), `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`TIKTOK_APP_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_BUSINESS_ID`, `TIKTOK_REPLY_TO_COMMENTS`.
These are **server-only**. Never prefix them with `VITE_`, or they'd ship in the browser bundle.

To produce `FIREBASE_SERVICE_ACCOUNT`: Firebase console → Project settings → **Service
accounts → Generate new private key**, then `base64 -w0 key.json` (PowerShell:
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`). Delete the JSON file afterwards.

Platform setup (Meta app, Page, IG, WhatsApp number, App Review, TikTok limits, free LLM keys):
**[docs/SOCIAL_SETUP.md](docs/SOCIAL_SETUP.md)**.

### Local development & tests

```bash
npm test                  # language detection, matching, fallback chain, webhooks
npm run dev:api           # terminal 1: local /api server on :3001 (reads .env.local)
npm run dev               # terminal 2: Vite on :5173, proxies /api to :3001
npm run simulate:meta -- "foamx kati ho?"   # signed fake Messenger message → Inbox
```

`vercel dev` works too, but needs `vercel login` and `vercel link`. For real Meta webhooks
locally, expose port 3001 with ngrok, or use a Vercel preview URL.

### Limits worth knowing

- Vercel **Hobby is for non-commercial use** under Vercel's terms. For a business, Pro or a host
  like Netlify/Cloudflare may be the compliant choice. The code only depends on `waitUntil`.
- Free LLM tiers are rate-limited. When they are exhausted, replies fall back to keyword answers,
  and the stats card shows errors and 429s.
- Platform replies are limited to 24h after the customer's last message (TikTok comments: public,
  150 chars). See SOCIAL_SETUP.md.

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
src/components/  Nav, TopBar, ProtectedRoute, StatusButtons, BotBadges
api/             Vercel functions: webhooks/meta, webhooks/tiktok, send, test-reply
api/_lib/        bot pipeline (language, catalog, faqMatcher, prompt, llm), adapters, inbound
shared/          code used by both browser and functions (stock math, bot defaults)
tests/           node:test suites (npm test)
docs/            SOCIAL_SETUP.md
firestore.rules  security rules (auth-only; server-written bot collections)
vercel.json      build + SPA rewrite
```
