# Deploying BSS to production

Public site: **https://broadcast-scheduler-system.me**
Server: Ubuntu VPS `123.30.48.228` (already runs n8n + Postgres 24/7).

The production stack is defined in [`docker-compose.prod.yml`](docker-compose.prod.yml)
and [`Caddyfile`](Caddyfile). Caddy terminates HTTPS and routes everything
same-origin, so there is no CORS to manage:

| Path         | Goes to            |
|--------------|--------------------|
| `/api/*`     | Spring backend     |
| `/webhook/*` | n8n (Clean-with-AI)|
| everything   | React frontend     |

The backend talks to Postgres **internally** (container `tv360_postgres_cloud`),
not over the public IP.

---

## First-time deploy

```bash
# 1. Clone and enter the repo
cd ~
git clone https://github.com/TrinhNhatHuy/BSS.git
cd BSS

# 2. Create the app network (the prod stack expects it to already exist)
docker network create bss-network    # ok if it says it already exists

# 3. Put the secrets file in place. Reuse your existing local .env — the prod
#    compose only reads POSTGRES_*, JWT_*, VAPID_*, TELEGRAM_BOT_TOKEN,
#    APP_REMINDER_ZONE (DB host/port/profile are hard-set in the prod compose).
#    Transfer it from your PC, e.g. with PuTTY's pscp:
#       pscp "E:\Users\Desktop\BSS\.env" root@123.30.48.228:/root/BSS/.env
#    (or paste it with: nano .env)

# 4. Build and start (first build pulls Maven/npm deps — a few minutes)
docker compose -f docker-compose.prod.yml up -d --build

# 5. Watch the backend boot — look for "Started ... in N seconds"
docker compose -f docker-compose.prod.yml logs -f backend
```

### Open the firewall
Allow inbound **80** and **443** in the BizFly security group. If the host also
runs `ufw`:
```bash
ufw allow 80/tcp && ufw allow 443/tcp
```

### Point the domain
In Namecheap → Advanced DNS, an **A record** `@` → `123.30.48.228` (the `www`
CNAME already exists). Verify:
```bash
dig +short broadcast-scheduler-system.me      # must return 123.30.48.228
```
Once DNS resolves, Caddy issues the certificate automatically (watch
`docker compose -f docker-compose.prod.yml logs caddy`). Then open
**https://broadcast-scheduler-system.me**.

---

## Redeploying after a code change

```bash
cd ~/BSS
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Only changed images rebuild; n8n, Postgres, and Caddy's certificates are
untouched. A DB schema change must be applied to Postgres **before** the new
backend boots (Hibernate runs with `ddl-auto=validate`).

---

## Useful commands

```bash
docker compose -f docker-compose.prod.yml ps          # status
docker compose -f docker-compose.prod.yml logs -f backend
curl http://localhost:8080/api/...                    # API debug (loopback only)
docker compose -f docker-compose.prod.yml down        # stop the app stack
```

## Security follow-ups (recommended)
- The backend now reaches Postgres internally, so **close public port 5433**
  (remove the `0.0.0.0:5433` publish from the Postgres stack, or firewall it).
- Change the Postgres password from the current weak value.
- Make the GitHub repo private (it contains a JWT secret in
  `application-dev.properties`), or rotate that secret.