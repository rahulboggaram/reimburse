# Wapas

Expense reimbursements with mobile OTP login.

## Setup

```bash
cd ~/wapas
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
- **First-time signup**: full name, IFSC, bank account
- **Bank details** editable anytime under “Bank details”
- **Admin**: list employees, assign **Approver** toggle (only after they complete profile)
- **RazorpayX payouts**: pay approved claims from Admin → All claims

## Live OTP — do this before live Razorpay

Set on **Vercel → Production**:

```env
OTP_MOCK="false"
NEXT_PUBLIC_OTP_MOCK="false"
NEXT_PUBLIC_OTP_DOMAIN="reimburse-jade.vercel.app"
```

### Option A — WhatsApp OTP (good if you have a verified Business account)

No Indian SMS DLT. User must have **WhatsApp on the same mobile number** they use to log in.

1. [Meta Business Suite](https://business.facebook.com/) → WhatsApp → **API Setup** (Cloud API).
2. Create an **Authentication** message template (category AUTHENTICATION, copy-code button). Note the **template name** and **language code** (e.g. `en_US`) after approval.
3. Copy **Phone number ID** and a permanent **access token** with `whatsapp_business_messaging`.
4. Add env vars (WhatsApp is used automatically when these are set):

```env
WHATSAPP_ACCESS_TOKEN="EAA..."
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_OTP_TEMPLATE_NAME="your_auth_template_name"
WHATSAPP_OTP_TEMPLATE_LANGUAGE="en_US"
```

If your template has no copy button, set `WHATSAPP_OTP_TEMPLATE_HAS_BUTTON="false"`.

5. Redeploy. Login should say **“Code sent on WhatsApp”** and deliver the 6-digit code in WhatsApp.

Pricing is per Meta’s [conversation rates](https://developers.facebook.com/docs/whatsapp/pricing/) (authentication category; often competitive vs SMS in India, not free).

### Option B — MSG91 SMS (India + DLT)

```env
MSG91_AUTH_KEY="your-authkey"
MSG91_TEMPLATE_ID="your-dlt-otp-template-id"
```

(Do not set WhatsApp vars if you want MSG91.)

### Option C — Twilio SMS

```env
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER="+1..."
```

Keep **`RAZORPAYX_MOCK="true"`** until OTP works, then enable live Razorpay below.

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
