# Reimburse

Expense reimbursements with email OTP login.

## Setup

```bash
cd ~/reimburse
npm install
npm run db:setup
npm run dev
```

## Demo logins (OTP: `123456`)

| Email | Role |
|-------|------|
| `admin@reimburse.demo` | Admin — manage employees & approvers |
| `manager@reimburse.demo` | Branch manager (Sadan) |
| `approver@reimburse.demo` | Employee + approver (Sudhi) |
| `employee@reimburse.demo` | Employee — **first login** asks for name & bank details |

## What’s new

- **No email** on reimbursement form
- **20 expense categories** (Electricity, Travel, Food, …)
- **First login (every role)**: full name, IFSC, and bank account required before using the app
- **Bank details** editable anytime under “Bank details”
- **Admin**: list employees, assign **Approver** toggle (only after they complete profile)
- **RazorpayX payouts**: pay approved claims from Admin → All claims

## Live OTP — Postmark email

Reimburse sends login codes by **email** via [Postmark](https://postmarkapp.com). Each employee needs an email in Admin → People.

**While you set up Postmark**, keep on Vercel: `OTP_MOCK=true` and `NEXT_PUBLIC_OTP_MOCK=true` so the app still accepts demo OTP **`123456`**.

### Vercel Production env

```env
OTP_MOCK=false
NEXT_PUBLIC_OTP_MOCK=false

POSTMARK_SERVER_TOKEN=your-server-api-token
OTP_EMAIL_FROM=Reimburse <otp@reimburse.yellowmetal.co>
```

The **From** address must use a domain verified in Postmark. **Redeploy** after saving.

### Test

1. https://reimburse-jade.vercel.app/login
2. Enter an email registered in Admin → People
3. Check inbox for the 6-digit code

Admin → **Login OTP** shows Postmark status and lets you send a test email.

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
