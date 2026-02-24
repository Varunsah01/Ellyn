# SMTP Probe Service — Deployment

## Server Requirements
- Ubuntu 22.04 LTS (any VPS: Hetzner CX11 ~€4/mo, DigitalOcean $6/mo)
- Node.js 20+
- Ports: 3001 open (inbound from Vercel IPs only), port 25 open (outbound)

## Initial Setup
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone / upload files
scp -r smtp-probe-service/ ubuntu@YOUR_VPS_IP:~/smtp-probe-service/

# Install dependencies
cd ~/smtp-probe-service && npm install

# Create .env
cp .env.example .env
nano .env  # set SMTP_PROBE_SECRET to a 32+ char random string

# Install PM2
npm install -g pm2

# Start service
pm2 start ecosystem.config.cjs
pm2 startup
pm2 save
```

## Firewall Setup
```bash
# Only allow port 3001 from Vercel (use Vercel's IP ranges or restrict to your deployment IP)
ufw allow from any to any port 25  # outbound SMTP
ufw allow 3001                     # inbound from Vercel — ideally restrict to Vercel IPs
ufw enable
```

## Vercel Environment Variables
Add to your Vercel project settings:
- SMTP_PROBE_SERVICE_URL = http://YOUR_VPS_IP:3001
- SMTP_PROBE_SECRET = (same value as VPS .env)

## Verify deployment
```bash
curl http://YOUR_VPS_IP:3001/health
# Expected: {"ok":true,"uptime":...}

curl -X POST http://YOUR_VPS_IP:3001/probe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","secret":"YOUR_SECRET"}'
# Expected: {"deliverability":"SKIPPED","reason":"provider_blocks_probing",...}
```

## Monitoring
- View logs: pm2 logs smtp-probe
- Restart: pm2 restart smtp-probe
- Health dashboard: GET https://app.ellyn.app/api/v1/smtp-probe/health
