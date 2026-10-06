# Connecting Messenger, Instagram, WhatsApp, TikTok and a free LLM

Your webhook URLs, once the site is deployed on Vercel:

| Platform | Webhook URL |
| --- | --- |
| Messenger / Instagram / WhatsApp | `https://<your-project>.vercel.app/api/webhooks/meta` |
| TikTok (comments) | `https://<your-project>.vercel.app/api/webhooks/tiktok` |

Put every secret below in **Vercel → Project → Settings → Environment Variables**, then
**redeploy** (function env vars are read at runtime, but a redeploy makes sure every function
picks them up). None of them may start with `VITE_`.

Before connecting anything, open **More → Test Bot** and click **Run sample set** to check the
replies.

---

## 1. Free LLM key

### OpenRouter (default)
1. Sign up at https://openrouter.ai → **Keys → Create key**.
2. Set `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_API_KEY=<key>`,
   `LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free`, `LLM_FALLBACK_MODEL=nvidia/nemotron-3-super-120b-a12b:free`,
   `LLM_REASONING_EFFORT=none`, `LLM_FALLBACK_REASONING_EFFORT=none`.
3. Free (`:free`) models are rate-limited per minute and per day; the limits are higher once your
   account has ever bought credits. The free list also changes, so see
   https://openrouter.ai/models?q=free and if a model disappears, just change the env var.

### Google Gemini (free tier)
1. https://aistudio.google.com → **Get API key**.
2. `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`,
   `LLM_API_KEY=<key>`, `LLM_MODEL=gemini-3.5-flash`, `LLM_FALLBACK_MODEL=gemini-3.5-flash-lite`,
   `LLM_REASONING_EFFORT=none`, `LLM_FALLBACK_REASONING_EFFORT=low` (Flash-Lite rejects "none"; Gemini 3.x "thinks" by default, which uses up the reply's token
   budget and cuts answers off; 2.5 models are retired for new keys).
   Gemini is strong at Nepali. On the free tier, Google may use your prompts to improve its
   products. Prompts are masked (phone numbers, addresses, emails), but keep that in mind.

### Groq (free tier)
1. https://console.groq.com → **API Keys**.
2. `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_KEY=<key>`,
   `LLM_MODEL=<a model from console.groq.com/docs/models>`. Very fast, but its open models are
   weaker at Romanized Nepali, so check them with the Test Bot first.

You can mix providers, as long as both models live on the same `LLM_BASE_URL`.

---

## 2. Meta app (Messenger + Instagram + WhatsApp)

### Create the app
1. https://developers.facebook.com → **My Apps → Create app** → use case **Other** → type
   **Business**. Link it to your **Meta Business portfolio** (create one at business.facebook.com
   if needed).
2. **App settings → Basic**: copy the **App secret** → `META_APP_SECRET`.
3. Choose any long random string as `META_VERIFY_TOKEN` (e.g. `openssl rand -hex 16`).

### Messenger (Facebook Page)
1. **Add product → Messenger** → *Messenger API settings*.
2. **Access tokens → Add or remove Pages** → select the MotoviaNepal Page → **Generate token** →
   `PAGE_ACCESS_TOKEN`. (Tokens generated here for a Page don't expire unless you change your
   password or revoke the app.)
3. **Webhooks → Configure**: Callback URL = the Meta webhook URL above, Verify token =
   `META_VERIFY_TOKEN` → **Verify and save**. Verification only passes after you deploy with
   the env vars set.
4. Subscribe the Page to the fields **messages** (and optionally `messaging_postbacks`).
   **Don't** subscribe to `message_echoes`. The bot ignores echoes anyway.

### Instagram DMs
1. Instagram account must be **Professional (Business or Creator)** and linked to the Facebook
   Page (Instagram app → Settings → Business tools → Connect a Facebook Page).
2. In the Instagram app: **Settings → Messages and story replies → Message controls → Connected
   tools → Allow access to messages** = on.
3. Pick one setup:
   - **Via the Page (simplest):** Messenger product → *Instagram settings* → connect the account,
     subscribe the **instagram** webhook object to **messages** with the same callback URL.
     Sending uses `PAGE_ACCESS_TOKEN`; leave `IG_ACCESS_TOKEN` empty.
   - **Instagram API with Instagram Login:** add the **Instagram** product, generate a token for
     the account → `IG_ACCESS_TOKEN` and `IG_USER_ID`, and configure its webhook (same URL and
     verify token, field **messages**).

### WhatsApp Cloud API
1. **Add product → WhatsApp → API setup**. Meta gives you a free test number; to use your own
   number, **Add phone number** and verify it. The number can't be in use in the regular WhatsApp
   or WhatsApp Business **app**. Migrate it or use a new SIM.
2. Copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Create a **permanent token**: Business settings → **System users** → add an admin system user
   → **Assign assets** (the app + WhatsApp account) → **Generate token** with
   `whatsapp_business_messaging` and `whatsapp_business_management` → `WHATSAPP_TOKEN`.
   (The temporary token on the API setup page expires in 24h.)
4. **WhatsApp → Configuration → Webhook**: same callback URL and verify token, subscribe to
   **messages**.
5. Pricing: replies to customer-started chats within the 24h service window are free. Outside
   it, WhatsApp only allows paid, pre-approved **template** messages, which this bot never sends.

### Test users, App Review and verification
- While the app is in **Development mode**, only people with a role on the app (Admin/Developer/
  **Tester** under *App roles*) can message the bot. Add your own account and a friend's as
  testers and check the whole flow.
- To answer real customers, switch to **Live** after **App Review** for the permissions you use:
  `pages_messaging` (Messenger), `instagram_manage_messages` / `instagram_business_manage_messages`
  (Instagram), and **Advanced access** to `whatsapp_business_messaging`. Review needs a short
  screencast of the Inbox + a privacy-policy URL.
- **Business verification** (Business settings → Security center) is required for Advanced
  access and to lift WhatsApp's starting messaging limits. It usually needs a company
  registration (PAN/VAT) document and a matching website or domain.

### The 24-hour rule
Messenger, Instagram and WhatsApp only allow normal replies within 24h of the customer's last
message. The bot always replies immediately, so it's inside the window. The Inbox hides the reply
box after 24h, and `/api/send` refuses with a clear error. Reply from the official apps instead.

---

## 3. TikTok

### What TikTok allows (checked October 2026)
| Feature | Status | In this app |
| --- | --- | --- |
| Reply to comments on your own videos (**Accounts API**, `business/comment/reply/create/` + `comment.update` webhook) | Available to TikTok **Business Accounts** after Accounts API access is approved | ✅ Implemented: `/api/webhooks/tiktok` |
| Direct messages (**Business Messaging API**) | Approval-gated **open beta**. APAC/LATAM/METAP/North America, **not** EEA/Switzerland/UK. Customer must message first, 48h reply window, rate caps | ❌ Not implemented. Request access, then add a `tiktok_dm` adapter |
| Login Kit / Display API (developers.tiktok.com) | No comment or DM scopes | Not usable |

Important limits of the comment integration:
- Comment replies are **public** and limited to **150 characters**. The bot only posts real
  answers (AI or keyword layer), never greetings or "team will reply soon". Unanswerable
  questions are flagged in the Inbox instead.
- Auto-posting is **off** until you set `TIKTOK_REPLY_TO_COMMENTS=true`. Before that, comments
  are only collected in the Inbox, where you can reply manually.
- The webhook contains IDs only, so each comment costs one extra `comment/list` call.
- I couldn't verify the exact webhook payload and token lifetime against a live account.
  The parser accepts the documented variants. **Test it with one video before turning on
  auto-posting**, and check Vercel logs for `tiktok webhook` lines. If the access token
  expires (Business API tokens are refreshable), regenerate it or tell me to add refresh.

### Setup
1. Convert the TikTok account to a **Business Account** (TikTok app → Settings → Account).
2. https://business-api.tiktok.com → register as a developer → **Create an app** → request the
   **TikTok Accounts** permission (Accounts API) with comment scopes (`comment.list`,
   `comment.list.manage`).
3. App secret → `TIKTOK_APP_SECRET`. Authorize your business account via the app's OAuth link →
   access token → `TIKTOK_ACCESS_TOKEN`; the authorized account's `business_id` (open_id) →
   `TIKTOK_BUSINESS_ID`.
4. Register the webhook (Developer portal → app → Webhook, or `business/webhook/update/` with
   `event_type: COMMENT`) → callback = the TikTok webhook URL above.

---

## 4. Local testing

```bash
npm i -g vercel
vercel link            # once, pick the existing project
vercel env pull .env.local
vercel dev             # Vite + /api functions together on http://localhost:3000
```

Plain `npm run dev` starts only Vite, so `/api/*` won't exist there.

To receive real webhooks locally, expose the dev server and temporarily point the Meta/TikTok
callback URL at it:

```bash
ngrok http 3000        # → https://xxxx.ngrok-free.app/api/webhooks/meta
```

Or just deploy a **Preview** branch on Vercel and use its URL. If Deployment Protection is on,
webhooks can't reach previews. Add a *Protection Bypass for Automation* or use production.
