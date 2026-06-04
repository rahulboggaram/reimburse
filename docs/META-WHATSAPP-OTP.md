# Meta WhatsApp OTP — setup for Reimburse

Plain-language checklist. The app code is already built; you only need Meta + Vercel.

## What you are connecting

| Piece | Where it lives |
|-------|----------------|
| Meta Developer app **Yellow Metal** | developers.facebook.com (this is your WhatsApp API app) |
| WhatsApp Business account | Same portfolio — sender +91 80903 80909 |
| Website **Reimburse** | reimburse-jade.vercel.app (only needs env vars + token from Yellow Metal app) |
| Template **reimburse_login_otp** | Authentication, Copy code, Active |
| Reimburse on Vercel | Env vars + redeploy |

---

## Part A — Meta (about 20 minutes)

### 1. Link the business account

1. Open [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **Yellow Metal**
2. **Use cases** → **Connect with customers through WhatsApp** → **Customize**
3. **Configuration** → **WhatsApp Business account** = **Yellow Metal Loans** → **Save**

### 2. Pick the real sender (not the US test number)

1. **API Setup**
2. **From** → select **Yellow Metal — +91 80903 80909**
3. Copy **Phone number ID** (only for this line — e.g. a long number like `1102359072968301`)

### 3. Permanent access token (important)

Temporary tokens from API Setup often fail on the real +91 line.

1. [Business settings → System users](https://business.facebook.com/settings/system-users)
2. **Add** system user (e.g. `reimburse-otp`)
3. **Assign assets** → **WhatsApp accounts** → Yellow Metal → **Full control**
4. **Generate token** → app **Yellow Metal** → check:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the token (starts with `EAA…`) — you will paste it into Vercel once

### 4. Register the +91 number (if status is Pending)

You need the **6-digit two-step verification PIN** for that WhatsApp Business number (the PIN you set in WhatsApp Business Manager, not an SMS from Meta).

```bash
export WA_TOKEN="EAA...your system user token"
export WA_PHONE_ID="your Yellow Metal phone number ID"
export WA_PIN="123456"

curl -X POST "https://graph.facebook.com/v25.0/${WA_PHONE_ID}/register" \
  -H "Authorization: Bearer ${WA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"${WA_PIN}\"}"
```

Success looks like: `{"success":true}`

### 5. Test on Meta before Vercel

Still on **API Setup** (Yellow Metal selected):

1. **To** → add your phone as `91XXXXXXXXXX` (no `+`)
2. Use Meta’s **Send message** test
3. If that arrives on WhatsApp, Meta is ready

---

## Part B — Vercel

1. Open your **Reimburse** project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables** → **Production**
2. Add (or update):

```env
WHATSAPP_ACCESS_TOKEN=EAA...paste system user token
WHATSAPP_PHONE_NUMBER_ID=paste Yellow Metal phone number ID
WHATSAPP_OTP_TEMPLATE_NAME=reimburse_login_otp
WHATSAPP_OTP_TEMPLATE_LANGUAGE=en
WHATSAPP_OTP_TEMPLATE_HAS_BUTTON=true
WHATSAPP_API_VERSION=v25.0
```

3. **Deployments** → **Redeploy** latest production (required after env changes)

### Test from the app (demo OTP can stay on)

1. Log in as admin (`9999000001`, demo OTP `123456` if mock is on)
2. Menu → **WhatsApp login**
3. Enter your mobile → **Send test on WhatsApp**
4. If you get the message, add the live OTP flags and redeploy again:

```env
OTP_MOCK=false
NEXT_PUBLIC_OTP_MOCK=false
NEXT_PUBLIC_OTP_DOMAIN=reimburse-jade.vercel.app
```

5. Test [reimburse-jade.vercel.app/login](https://reimburse-jade.vercel.app/login) with a registered employee phone

---

## Part C — Local check (optional)

Add the same `WHATSAPP_*` lines to `~/reimburse/.env`, then:

```bash
npm run whatsapp:check
npm run whatsapp:check 9876543210
```

---

## If something fails

| Error / symptom | Fix |
|-----------------|-----|
| Object does not exist / permission | System user token + link WABA in Configuration |
| Used US test number ID | Only Yellow Metal **Phone number ID** |
| Number **Pending** | Run register curl with correct PIN |
| Message not received | Add phone under API Setup → **To** (In development mode) |
| Template language error | Set `WHATSAPP_OTP_TEMPLATE_LANGUAGE=en_US` |
| Login says not registered | Phone must exist in Reimburse admin → People |

Paste the exact error from **WhatsApp login** page or login screen and we can map it to one row above.
