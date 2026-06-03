# Reimburse

Expense reimbursements with mobile OTP login.

## Setup

```bash
cd reimburse
npm install
npm run db:setup
npm run dev
```

## Demo logins (OTP: `123456`)

| Phone | Role |
|-------|------|
| `9999000001` | Admin — manage employees & approvers |
| `9999000002` | Employee only (Nikhil) |
| `9999000003` | Employee + approver (Ananya) |
| `9999000004` | Employee — **first login** asks for name & bank details |
| `9999000005` | Employee + **approver** (Sindhu) — test approvals |

## What’s new

- **No email** on reimbursement form
- **20 expense categories** (Electricity, Travel, Food, …)
- **First login (every role)**: full name, IFSC, and bank account required before using the app
- **Bank details** editable anytime under “Bank details”
- **Admin**: list employees, assign **Approver** toggle (only after they complete profile)
- **RazorpayX payouts**: pay approved claims from Admin → All claims

## Live OTP — WhatsApp (before live Razorpay)

Production uses **WhatsApp Cloud API** for login codes. Do **not** set MSG91 or Twilio vars unless you add SMS later.

### 1. Meta (verified Business account)

1. [Meta Business Suite](https://business.facebook.com/) → **WhatsApp** → **API Setup** (Cloud API).
2. **Message templates** → Create template:
   - Category: **Authentication**
   - Type: **Copy code** (OTP button)
   - Wait until status is **Approved**
3. Note **template name** (e.g. `reimburse_login_otp`) and **language** (e.g. `en_US`).
4. From API Setup, copy:
   - **Phone number ID**
   - **Permanent access token** (permission: `whatsapp_business_messaging`)

### 2. Vercel → Production environment variables

```env
OTP_MOCK=false
NEXT_PUBLIC_OTP_MOCK=false
NEXT_PUBLIC_OTP_DOMAIN=reimburse-jade.vercel.app

WHATSAPP_ACCESS_TOKEN=EAA...your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_OTP_TEMPLATE_NAME=your_approved_template_name
WHATSAPP_OTP_TEMPLATE_LANGUAGE=en_US
```

Optional: `WHATSAPP_OTP_TEMPLATE_HAS_BUTTON=false` if your template has no copy button.

Leave **`RAZORPAYX_MOCK=true`** until WhatsApp login works.

Remove or leave empty: `MSG91_*`, `TWILIO_*` (so only WhatsApp is used).

### 3. Deploy and test

1. Redeploy Production (or wait for auto-deploy from `main`).
2. Hard-refresh https://reimburse-jade.vercel.app
3. Log in with a **registered** phone that has **WhatsApp on that same number**.
4. You should see **“Code sent on WhatsApp”** and receive the 6-digit code in WhatsApp.

### Alternatives (not used by default)

MSG91 or Twilio SMS — see `.env.example` if you need SMS fallback later.

## RazorpayX setup (real payouts)

1. Sign up at [RazorpayX](https://razorpay.com/x/) and complete KYC.
2. In the dashboard, go to **My Account & Settings → Developer Controls** and generate **Test** API keys.
3. Copy your **Customer Identifier / account number** (Banking → Customer Identifier) — this is `RAZORPAYX_ACCOUNT_NUMBER`, not an employee’s bank account.
4. Add funds to your RazorpayX test account (required before payouts work).
5. Edit `.env`:

```env
RAZORPAYX_MOCK="false"
RAZORPAYX_KEY_ID="rzp_test_..."
RAZORPAYX_KEY_SECRET="..."
RAZORPAYX_ACCOUNT_NUMBER="7878780080316316"
RAZORPAYX_PAYOUT_MODE="IMPS"
```

6. Restart the app (`npm run dev`).
7. Approve a claim as an approver, then log in as admin → **All claims** → open the claim → **Pay via RazorpayX**.

**Demo mode (no keys):** leave `RAZORPAYX_MOCK="true"` — payouts are simulated instantly with a mock UTR.

**Webhooks (optional, for live status updates):** in RazorpayX dashboard, add webhook URL  
`https://your-domain.com/api/webhooks/razorpayx`  
Events: `payout.processed`, `payout.failed`, `payout.queued`. Set `RAZORPAYX_WEBHOOK_SECRET` to the secret shown in the dashboard.
