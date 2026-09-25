# CLAUDE.md — Inventory & Stock Tracker (Task 1)

Take-home task for Missan Computer. Reviewers judge **clear reasoning, sound decisions, clean code**, not polish.
Always follow `PLAN.md`. Work **one phase at a time**. Never start the next phase until the current phase's tests pass.

## Stack
- **api/**: NestJS + Prisma + PostgreSQL + Redis (ioredis) + SSE (`@Sse()` + `@nestjs/event-emitter`) + Swagger (`@nestjs/swagger`, explicit decorators, no CLI plugin)
- **web/**: Next.js (App Router) + TypeScript
- **Infra**: Docker Compose (Postgres + Redis)
- **Tests**: Jest (unit), Jest + Supertest (e2e, real Postgres/Redis), React Testing Library (web)

## Repo layout
```
/
├── docker-compose.yml
├── package.json          # npm workspaces: ["api", "web"], root scripts
├── .env.example
├── README.md
├── CLAUDE.md / PLAN.md
├── api/
│   ├── prisma/ (schema.prisma, migrations/, seed.ts)
│   ├── src/
│   │   ├── main.ts, app.module.ts
│   │   ├── config/           # env validation
│   │   ├── prisma/           # global PrismaService
│   │   ├── redis/            # global RedisService
│   │   ├── common/           # filters, constants
│   │   ├── products/         # controller, service, dto, low-stock cache
│   │   ├── stock-movements/  # controller, service, dto
│   │   └── events/           # SSE controller + stream service
│   └── test/                 # e2e specs
└── web/
    ├── app/ (page.tsx, layout.tsx)
    ├── components/ (ProductTable.tsx, MovementForm.tsx)
    └── lib/ (api.ts, types.ts)
```

## Ports
web 3000 · api 3001 · postgres 5432 · redis 6379

## Commands (root)
- `docker compose up -d`: start Postgres + Redis
- `npm run dev`: api + web together (concurrently)
- `npm run db:migrate` / `npm run db:seed`
- `npm test`: all unit tests · `npm run test:e2e`: api e2e

## Code rules
- TypeScript strict. **No `any`.**
- Thin controllers; business logic lives in services.
- Every input goes through a DTO with class-validator. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Use Nest exceptions: `NotFoundException`, `ConflictException`, `BadRequestException`.
- Money is `Decimal(10,2)`, never float. Quantities are integers.
- No magic numbers; config lives in `config/` and `common/constants.ts`.
- Emit domain events **only after the DB transaction commits**.
- Small, focused files. Clear names over comments; comment only the "why".
- One commit per phase, conventional style (`feat:`, `test:`, `chore:`, `docs:`).

## Key business rules
- Stock can **never** go negative (conditional update + DB CHECK constraint).
- Every quantity change is recorded as a `StockMovement` (ledger).
- SKU is unique → duplicate returns 409.
- Low-stock threshold comes from `LOW_STOCK_THRESHOLD` (default 10).

## Don't
- Don't add auth or extra features unless PLAN.md says so.
- Swagger/OpenAPI (`/docs`, `/docs-json`) was added at the user's request. Keep it: every new DTO/response class needs `@ApiProperty` using the same constants as its validators, and every route needs an `operationId` (enforced by `test/docs.e2e-spec.ts`).
- Don't use Redis for anything except the low-stock cache (the brief asks for ONE clear purpose).
- Don't skip or delete failing tests to make a phase pass.
