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
