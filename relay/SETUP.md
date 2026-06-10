# VPS payout relay (~$6/month)

Razorpay live API only accepts calls from **whitelisted IP addresses**. Vercel’s servers use changing IPs, so Reimburse routes payout API calls through a tiny relay on a cheap VPS with one fixed IP.

```
Reimburse (Vercel)  →  VPS relay (static IP)  →  Razorpay API
```

## What you need

- A VPS with a **static IPv4** (DigitalOcean $6/mo droplet works well)
- Your Razorpay **live** API keys (keep them on the VPS only)
- About 15 minutes

---

## Step 1 — Create the VPS

1. Sign up at [DigitalOcean](https://www.digitalocean.com/) (or any provider with a static IP).
2. Create a **Droplet**:
   - **Image:** Ubuntu 24.04
   - **Plan:** Basic, $6/mo (1 GB RAM is enough)
   - **Region:** closest to India (e.g. Bangalore) if available
3. Copy the droplet’s **public IPv4** — you’ll need it twice (Razorpay + Vercel).

---

## Step 2 — Whitelist the IP in Razorpay

1. Razorpay Dashboard → **Developer Controls** → **Share IP Addresses**
2. Add your VPS IPv4 (e.g. `157.230.x.x`)
3. Save

---

## Step 3 — Install the relay on the VPS

SSH into the server (DigitalOcean gives you a one-click terminal, or use `ssh root@YOUR_IP`).

```bash
# Install Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git

# Get the relay script (clone your repo, or copy relay/ folder only)
git clone https://github.com/YOUR_ORG/reimburse.git
cd reimburse/relay

# Create env file
cp .env.example .env
nano .env
```

Fill in `.env`:

```
RAZORPAYX_KEY_ID=rzp_live_xxxx
RAZORPAYX_KEY_SECRET=your_live_secret
RAZORPAYX_ACCOUNT_NUMBER=10281413547
RAZORPAYX_RELAY_SECRET=pick-a-long-random-password-at-least-32-chars
PORT=8787
```

Generate a strong relay secret (run on your Mac or the VPS):

```bash
openssl rand -hex 32
```

Start the relay:

```bash
node razorpay-relay.mjs
```

You should see: `Razorpay relay listening on 0.0.0.0:8787`

Test health (from your Mac):

```bash
curl http://YOUR_VPS_IP:8787/health
```

Should return JSON with `"ok": true` and `"mode": "live"`.

---

## Step 4 — Keep it running (systemd)

On the VPS:

```bash
cat > /etc/systemd/system/razorpay-relay.service << 'EOF'
[Unit]
Description=Razorpay payout relay for Reimburse
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/reimburse/relay
ExecStart=/usr/bin/node razorpay-relay.mjs
Restart=always
RestartSec=5
EnvironmentFile=/root/reimburse/relay/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable razorpay-relay
systemctl start razorpay-relay
systemctl status razorpay-relay
```

Adjust `WorkingDirectory` if you cloned the repo somewhere else.

---

## Step 5 — Open firewall port 8787

```bash
ufw allow 8787/tcp
ufw allow OpenSSH
ufw enable
```

---

## Step 6 — Update Vercel

In Vercel → Reimburse → **Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `RAZORPAYX_RELAY_URL` | `http://YOUR_VPS_IP:8787` |
| `RAZORPAYX_RELAY_SECRET` | same as VPS `.env` |
| `RAZORPAYX_ACCOUNT_NUMBER` | `10281413547` |
| `RAZORPAYX_PAYOUT_MODE` | `IMPS` |

**Remove** `RAZORPAYX_KEY_ID` and `RAZORPAYX_KEY_SECRET` from Vercel (they live on the VPS only).

**Redeploy** the app.

---

## Step 7 — Verify

1. Open Reimburse → **Admin → Razorpay payouts**
2. Status should show **Razorpay live** with a green API connection check
3. Pay one small approved claim (e.g. ₹1 test) and confirm it appears in Razorpay → Payouts

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` | `RAZORPAYX_RELAY_SECRET` must match exactly on VPS and Vercel |
| `This transaction is prohibited` | VPS IP not whitelisted in Razorpay, or relay not running |
| Connection timeout from Vercel | Firewall — open port 8787; check `systemctl status razorpay-relay` |
| Probe fails | `curl http://YOUR_VPS_IP:8787/health` from your Mac first |

---

## Security notes

- The relay only forwards `/v1/payouts` — nothing else.
- Every request needs the shared `RAZORPAYX_RELAY_SECRET`.
- Live Razorpay keys never sit on Vercel when using relay mode.

Optional later: put a domain in front of the VPS with HTTPS (Caddy + Let’s Encrypt).
