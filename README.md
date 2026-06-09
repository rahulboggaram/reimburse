# Reimburse

Expense reimbursements with mobile OTP login.

## Setup

```bash
cd ~/reimburse
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

## Live OTP — WhatsApp (from scratch)

Reimburse sends login codes with the **WhatsApp Cloud API** and template **`reimburse_login_otp`** (Authentication + Copy code). Do **not** set `MSG91_*` or `TWILIO_*` unless you add SMS later.

**While you set up Meta**, keep on Vercel: `OTP_MOCK=true` and `NEXT_PUBLIC_OTP_MOCK=true` so the app still accepts demo OTP **`123456`**.

### What you need at the end

| Piece | Example / note |
|-------|----------------|
| Meta Developer app | **Yellow Metal** (developers.facebook.com — not the Reimburse website name) |
| Sender number | **+91 80903 80909** on that WhatsApp account (not the US “Test number”) |
| Phone number ID | From API Setup when Yellow Metal is selected |
| Access token | System user token with `whatsapp_business_messaging` |
| Template | `reimburse_login_otp`, language `en` or `en_US` |

### Step 1 — Template (you likely already have this)

1. [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/) → template **`reimburse_login_otp`**
2. Category **Authentication**, **Copy code** button, status **Active**

### Step 2 — Developer app

1. [developers.facebook.com/apps](https://developers.facebook.com/apps/) → open **Yellow Metal**
2. Left: **Use cases** → **Connect with customers through WhatsApp** → **Customize**
3. Open **Configuration** → connect **WhatsApp Business account** = Yellow Metal Loans → **Save**
4. Open **API Setup**

### Step 3 — Sender number (ignore US test number)

1. **From** → select **Yellow Metal — +91 80903 80909** (not “Test number”)
2. Copy **Phone number ID** for this line only
3. If status is **Pending**, register once (Step 4)

### Step 4 — Register +91 for API (Pending → ready)

You need the **6-digit two-step verification PIN** for that WhatsApp Business number (you set it; Meta does not SMS it). Max **10** register attempts per 72 hours.

```bash
export WA_TOKEN="EAA...paste token"
export WA_PHONE_ID="paste Phone number ID for Yellow Metal"
export WA_PIN="123456"

curl -X POST "https://graph.facebook.com/v25.0/${WA_PHONE_ID}/register" \
  -H "Authorization: Bearer ${WA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"${WA_PIN}\"}"
```

Success: `{"success":true}`. Doc: [Register a business phone number](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/).

Check status:

```bash
curl -s "https://graph.facebook.com/v25.0/${WA_PHONE_ID}?fields=display_phone_number,status,code_verification_status" \
  -H "Authorization: Bearer ${WA_TOKEN}"
```

### Step 5 — Permanent token (fixes “does not exist / permissions”)

Temporary API Setup tokens often fail on the real +91 line.

1. [business.facebook.com/settings](https://business.facebook.com/settings) → **System users** → Add
2. **Assign assets** → **WhatsApp accounts** → Yellow Metal → full access
3. **Generate token** → app **Yellow Metal** → permissions **`whatsapp_business_messaging`** + **`whatsapp_business_management`**
4. Copy token → use for Meta test + Vercel

### Step 6 — Test on Meta before Vercel

On **API Setup** (Yellow Metal selected):

1. **To** → add test mobiles as `91XXXXXXXXXX` (no `+`)
2. Send Meta’s test message to your phone
3. If that works, configure Vercel

### Step 7 — Vercel Production env

```env
OTP_MOCK=false
NEXT_PUBLIC_OTP_MOCK=false
NEXT_PUBLIC_OTP_DOMAIN=reimburse-jade.vercel.app

WHATSAPP_ACCESS_TOKEN=EAA...system user token
WHATSAPP_PHONE_NUMBER_ID=Phone number ID for Yellow Metal only
WHATSAPP_OTP_TEMPLATE_NAME=reimburse_login_otp
WHATSAPP_OTP_TEMPLATE_LANGUAGE=en
WHATSAPP_OTP_TEMPLATE_HAS_BUTTON=true
WHATSAPP_API_VERSION=v25.0
```

Leave **`RAZORPAYX_MOCK=true`** until login works. **Redeploy** after saving.

### Step 8 — Test Reimburse

1. https://reimburse-jade.vercel.app/login
2. Phone must exist in Reimburse **and** (if app is In development) Meta **test recipient** list
3. UI: **“Code sent on WhatsApp”** + message from Yellow Metal

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Used US **Test number** ID | Use Yellow Metal **Phone number ID** only |
| `YOUR_PHONE_NUMBER_ID` in curl | Paste real IDs and token |
| `cexport` / empty `$WA_TOKEN` | Use `export WA_TOKEN="EAA..."` |
| Number **Pending** | Run **register** with correct PIN |
| Token error 190 / object missing | System user token + link WABA in Configuration |

### Alternatives

MSG91 or Twilio SMS — see `.env.example`.

## RazorpayX setup (real payouts)

1. Sign up at [RazorpayX](https://razorpay.com/x/) and complete KYC.
2. In the dashboard, go to **My Account & Settings → Developer Controls** and generate **Test** API keys.
3. Copy your **RazorpayX source account** into `RAZORPAYX_ACCOUNT_NUMBER` — **Current Account number** from Settings → Banking (IDFC etc.), or Customer Identifier if you use RazorpayX Lite. Not an employee’s bank account.
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
Events: `payout.processed`, `payout.failed`, `payout.queued`. In the **Secret** field, type any password you choose (Razorpay does not generate one). Paste the same value into `RAZORPAYX_WEBHOOK_SECRET` on Vercel — or leave both blank.
