# Inventory & Stock Tracker

A small inventory system with purchase and sales invoicing:

- **Products** with SKU, price and live stock level; low-stock view.
- **Stock ledger**: every quantity change is a `StockMovement` (adjustment, purchase or sale).
- **Purchases** (stock in) and **sales** (stock out) issue numbered invoices (`PUR-2026-0001`, `SAL-2026-0001`) with a PDF.
- **Live dashboard**: stock levels, new products and new invoices appear in every open browser via Server-Sent Events.

**Stack:** NestJS 11 · Prisma 7 · PostgreSQL 16 · Redis 7 · Next.js 16 (App Router) · TypeScript (strict) · Jest / Supertest / React Testing Library.

---

## Quick start

Requires Node ≥ 20.9 and Docker.

```bash
cp api/.env.example api/.env && cp web/.env.example web/.env.local
docker compose up -d                       # Postgres :5432 + Redis :6379
npm install                                # also generates the Prisma client
npm run db:migrate && npm run db:seed      # schema + 6 products, 2 purchases, 1 sale
npm run dev                                # api :3001 + web :3000
```

| What | URL |
| --- | --- |
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger UI / OpenAPI JSON | http://localhost:3001/docs · http://localhost:3001/docs-json |

The seed is idempotent (products are upserted by SKU; invoices are only created when none exist). It runs the **real application services**, so seeded invoices have genuine numbers, ledger movements and PDFs.

To start from an empty database, run `npm run db:reset --workspace api`. **This deletes all data.**

## Tests

```bash
npm test            # unit tests: api (Jest) + web (React Testing Library)
npm run test:e2e    # api end-to-end: real Postgres (inventory_test) + Redis DB 1
npm run lint && npm run typecheck
```

The e2e suite needs `docker compose up -d`. The `inventory_test` database is created by `docker/postgres/init` the first time the Postgres volume is created. It runs migrations itself and truncates between tests, so it never touches your dev data. Test settings live in the committed `api/.env.test`.

Some tests exist specifically to guard against regressions that were proven to be caught:

- concurrent sales that would oversell
- duplicate invoice numbers under concurrency
- deadlocks between invoices touching the same products in different orders
- PDF determinism

Each of these was checked by breaking the code on purpose and watching the test fail.

---

## Architecture

```
 Browser (Next.js :3000)
   │  REST (fetch)                 ▲ SSE  /events/stock
   ▼                               │  stock.updated · product.created · invoice.created
 ┌──────────────────────────── NestJS API :3001 ────────────────────────────┐
 │ Controllers (thin, DTO-validated)                                        │
 │   products · stock-movements · purchases · sales · invoices · events     │
 │        │                                                                 │
 │ Services                                                                 │
 │   ProductsService ─────────────── LowStockCache ──────────► Redis        │
 │   StockMovementsService ─┐                                (cache only)   │
 │   Purchases/SalesService ┴► InvoiceIssuerService                         │
 │                               ├─ InvoiceNumberService (sequence row)     │
 │                               └─ StockLedgerService (conditional UPDATE) │
 │        │  one DB transaction                                             │
 │        ▼                                                                 │
 │   PostgreSQL ── CHECK constraints are the last line of defence           │
 │        │                                                                 │
 │   after COMMIT ─► EventEmitter ─┬─► StockStreamService ─► SSE clients    │
 │                                 ├─► LowStockCache.invalidate             │
 │                                 └─► InvoicePdfService ─► storage/*.pdf   │
 └──────────────────────────────────────────────────────────────────────────┘
```

**Stock adjustment** (`POST /stock-movements`):

1. The DTO is validated.
2. In one transaction: a conditional `UPDATE product SET quantity = quantity - n WHERE id = ? AND quantity >= n`, then an `INSERT` of the movement.
3. After commit: `stock.updated` → the low-stock cache is invalidated and the event is pushed to SSE clients.

**Purchase / sale** (`POST /purchases`, `POST /sales`), in one transaction:

1. Load the products (404 lists every missing id).
2. Compute Decimal totals.
3. Take the next number from the sequence row.
4. Insert the invoice and its lines.
5. Apply one ledger movement per line, in `productId` order.

After commit: `invoice.created` + `stock.updated` → SSE, cache invalidation, and PDF generation in the background.

### Repository layout

```
api/   prisma/ (schema, migrations, seed) · src/<module>/ · test/ (e2e)
web/   app/ (routes) · components/ · hooks/ · lib/ (api client, types, money)
docker-compose.yml · docker/postgres/init (creates the test DB)
```

---

## Design decisions

### Stock integrity

- **Stock can never go negative.** This is enforced twice:
  - The service uses a *conditional atomic update* (`WHERE quantity >= n`), so two concurrent sales of the last unit cannot both succeed. No read-then-write, and no explicit locks to forget.
  - A `CHECK (quantity >= 0)` constraint backs this up at the database level, in case a future code path forgets the rule.
- **The ledger is the source of truth for history.** `Product.quantity` is a denormalised running balance, updated in the same transaction as the `StockMovement` insert, so the two can never disagree. The opening stock of a new product is recorded as an `IN` movement.
- **Events are emitted only after the transaction commits.** Listeners never see data that is later rolled back. Emission is awaited, so the next read after a request sees the invalidated cache (read-your-writes).

### Data representation

- **Money is `Decimal`, never float**:
  - Columns are `Decimal(10,2)`; invoice amounts are `Decimal(12,2)`.
  - Arithmetic uses `decimal.js` with half-up rounding per line.
  - The API sends amounts as strings (`"762.50"`).
  - The web preview mirrors the calculation with BigInt cents, so the preview always matches the server.
- **UUIDv7 ids.** They are time-ordered, so inserts stay index-friendly and pagination can use `id` as a stable keyset cursor (`?cursor=…`). Offset pagination would skip or repeat rows while data changes. The ids don't leak row counts and can be generated anywhere.

### Real-time updates and caching

- **SSE, not WebSockets.** Updates flow one way only (server → browser). SSE works over plain HTTP, reconnects automatically, and passes through proxies. A 25-second heartbeat keeps idle connections alive behind load balancers. On reconnect, the page resyncs from REST, so nothing missed while offline is lost.
- **Redis has one job: a cache-aside for the low-stock query.**
  - It is the one read that is computed (filter + sort) and polled by dashboards. It is keyed per threshold, has a TTL, and is invalidated on every stock or product change.
  - Invalidation uses `SCAN` + `UNLINK`, never `KEYS`, so it cannot block Redis.
  - If Redis is slow or down, the API times out fast and serves from Postgres. The `X-Cache: HIT | MISS` header shows whether the cache served the request.
  - Redis is not used for rate limiting or sessions: the brief asked for one clear purpose, and a cache that can be lost without harm is the safest one.

---

## Invoicing

### Model

- **One transaction = one invoice = many lines = many ledger movements.** Each line's movement references the invoice (`reason = PURCHASE | SALE`, `invoiceId`).
- **Manual adjustments** (`reason = ADJUSTMENT`) have no invoice. A CHECK constraint enforces the reason ⇔ invoice relationship, and PURCHASE ⇒ IN / SALE ⇒ OUT.
- **Snapshots:**
  - Lines store the product name, SKU and unit price *at the time of the invoice*.
  - The invoice stores the issuing company's name and address.
  - Editing a product or changing the config later never rewrites an issued invoice.
- **Database-level arithmetic checks:**
  - `lineTotal = quantity × unitPrice`
  - `total = subtotal + tax`

### Numbering and totals

- **Gap-free numbering per type and year** uses a sequence table: `INSERT … ON CONFLICT (type, year) DO UPDATE SET lastNumber = lastNumber + 1 RETURNING`.
  - It runs inside the invoice transaction, so a failed invoice rolls its number back.
  - Trade-off: invoices *of the same type* are serialised on that row. That is fine at this scale, and it is what accounting systems expect. A Postgres `SEQUENCE` would be faster, but it leaves gaps.
- **Sales are all-or-nothing.** If any line lacks stock, nothing is written, and the 409 response lists *every* short line (`shortages: [{ sku, requested, available }]`), not just the first. Product rows are updated in `productId` order, so two concurrent invoices can't deadlock.
- **Tax** is kept in the model, but `TAX_RATE` defaults to `0`. The PDF and UI hide the tax row at 0%. Set e.g. `TAX_RATE=0.05` for UAE VAT.
- **Business time zone** (`BUSINESS_TIMEZONE`, default `Asia/Dubai`) defines "today" for the default invoice date and for the "not in the future" rule, independent of the server's time zone.

### PDFs

- **PDFs are derived artifacts.** They are generated in the background after commit and cached at `storage/invoices/{number}_{id}.pdf` with an atomic write (temp file + rename).
- If the file is missing or unreadable, `GET /invoices/:id/pdf` re-renders it from the database, so the DB stays the only source of truth.
- Rendering is deterministic: the same invoice always produces byte-identical output. It is text-based, so it can be parsed by tools and LLMs.

### Integration with accounting (Task 2)

Invoices carry what an accounting sync needs:

- `PURCHASE` maps to a Xero **ACCPAY** bill and `SALE` to an **ACCREC** invoice.
- `status` (`NOT_SENT` → `SENT` → `POSTED`) tracks the sync.
- Line snapshots mean the payload never depends on the current product data.

---

## API reference

Full schemas and examples are in Swagger at `/docs`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/products` | Create a product (optional opening stock). SKU must be unique (409 if not). |
| GET | `/products` | List products (keyset pagination: `cursor`, `limit` ≤ 100) |
| GET | `/products/low-stock` | Products at or below the threshold (Redis-cached, `X-Cache` header) |
| POST | `/stock-movements` | Manual adjustment `IN` / `OUT` (409 if it would go negative) |
| GET | `/products/:productId/movements` | Ledger history of one product |
| POST | `/purchases` | Purchase invoice: adds stock |
| POST | `/sales` | Sales invoice: removes stock (409 with `shortages`) |
| GET | `/invoices` | List invoices (`type`, `status`, `cursor`, `limit`) |
| GET | `/invoices/:id` | Invoice with lines |
| GET | `/invoices/:id/pdf` | Invoice PDF |
| GET | `/invoicing/settings` | Tax rate, currency, due days and business "today" (for the forms) |
| GET (SSE) | `/events/stock` | Live `stock.updated`, `product.created`, `invoice.created` events |

Errors use Nest's standard shape (`statusCode`, `message`, `error`). Validation is strict: unknown fields are rejected.

## Configuration

All settings are in `api/.env.example`, with defaults and comments. The only required values are `DATABASE_URL`, `REDIS_URL`, `COMPANY_NAME` and `COMPANY_ADDRESS`. Everything is validated at startup, and the app refuses to boot with an invalid config.

---

## Known limitations

- **Single instance.** SSE fan-out uses an in-process event emitter, so with several API instances, a client only sees events from the instance it is connected to.
- **No authentication or authorisation** (out of scope for the brief).
- **Invoice forms load the first 100 products.** A searchable product picker is needed beyond that.
- **Latin-only PDFs.** The PDF uses a built-in Latin font, so Arabic names would not render.
- **Products cannot be edited or deleted** (no endpoint yet).
- **Retried POSTs can duplicate invoices.** There is no idempotency key, so a client that retries after a timeout could create a second invoice.

## With more time / scaling

- **Redis Pub/Sub (or Postgres `LISTEN/NOTIFY`) for SSE fan-out** across instances. Add `Last-Event-ID` replay so reconnecting clients get missed events instead of a full resync.
- **Idempotency keys** on `POST /purchases`, `/sales` and `/stock-movements`.
- **Auth + role-based access, and rate limiting** at the gateway.
- **Background PDF generation on a queue** (BullMQ) with retries, and object storage (S3) instead of local disk.
- **Read replicas** for list and report queries. The ledger makes reporting (stock valuation, movement history) straightforward.
- **Event ordering.** Add a product `version` column so clients can discard out-of-order events.
- **Playwright end-to-end tests and CI** (lint, typecheck, unit, e2e against service containers).
- **A Unicode font in PDFs, product editing, and a searchable product picker.**
