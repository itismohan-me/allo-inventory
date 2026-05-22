# Allo Health — Inventory Reservation System

A Next.js 15 App Router app implementing race-condition-safe inventory reservations for a multi-warehouse retail platform.

## The problem

When a customer proceeds to checkout, payment can take several minutes (3DS, UPI, wallet redirects). During that window, another customer can buy the same physical unit. Decrementing stock at add-to-cart time causes inventory to look depleted even though ~80% of carts are abandoned.

**Solution:** a short-lived reservation holds units for 10 minutes. Payment success confirms (permanently decrements). Payment failure or timeout releases the hold.

## How the concurrency guarantee works

The `POST /api/reservations` endpoint uses a **Postgres row-level lock (`SELECT … FOR UPDATE`)** inside a Prisma interactive transaction:

```
BEGIN
  SELECT id, total, reserved FROM "Stock"
  WHERE productId = ? AND warehouseId = ? FOR UPDATE   ← row lock

  IF total - reserved < quantity → ROLLBACK → 409

  UPDATE Stock SET reserved = reserved + quantity
  INSERT Reservation { status: PENDING, expiresAt: now + 10min }
COMMIT
```

Two simultaneous requests for the last unit: one acquires the lock and proceeds; the other waits, then sees zero available units, and receives a 409. No application-level mutex needed — Postgres serialises access at the row level.

## How expiry works

Two-layer approach:

1. **Lazy cleanup** — `POST /api/reservations` calls `releaseExpiredReservations({ productId, warehouseId })` before acquiring the stock lock. Expired holds are swept atomically before any new reservation can be created, so stale holds can never block new ones.

2. **Vercel Cron** (`vercel.json`) — hits `GET /api/cron/expire` every minute for a global sweep of all PENDING reservations past their `expiresAt`. Keeps the DB clean for products nobody is actively buying.

The cron endpoint requires `Authorization: Bearer $CRON_SECRET` — Vercel injects this automatically when invoking the cron.

## Bonus: Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header. The first response is cached in Upstash Redis under `idem:<key>` with a 24-hour TTL. Retries with the same key return the cached status + body without replaying the DB transaction.

## Local setup

### 1. Clone and install

```bash
git clone <repo>
cd allo
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL,
# UPSTASH_REDIS_REST_TOKEN, CRON_SECRET
```

Recommended free-tier providers:
- **Postgres**: [Neon](https://neon.tech) or [Supabase](https://supabase.com) — pooled URL → `DATABASE_URL`, direct URL → `DIRECT_URL`
- **Redis**: [Upstash](https://upstash.com) — REST URL + token

### 3. Migrate and seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run

```bash
npm run dev
# Open http://localhost:3000
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve units — 409 if insufficient stock |
| POST | `/api/reservations/:id/confirm` | Confirm (payment succeeded) — 410 if expired |
| POST | `/api/reservations/:id/release` | Release early (payment failed / cancelled) |
| GET | `/api/cron/expire` | Sweep expired reservations (Vercel Cron, auth required) |

## Trade-offs and what I'd do differently

- **`SELECT FOR UPDATE` over Redis distributed locks** — simpler and correct for a single Postgres instance. Redis locks would add value if reservations spanned multiple databases or if we needed to hold a lock across async work outside a transaction.
- **Lazy expiry is best-effort** — expired reservations accumulate on untouched products until the cron sweeps them. This is safe: the lazy call on `POST /api/reservations` ensures they never block a new reservation for the same SKU.
- **No user authentication** — out of scope. In production, reservations would be tied to a session and confirm/release endpoints would verify ownership.
- **Quantity hardcoded to 1 on the frontend** — the API accepts arbitrary quantities; a quantity selector is a trivial UI addition.
- **Product list doesn't optimistically update after reservation** — navigating back triggers a fresh fetch so available counts are accurate.
