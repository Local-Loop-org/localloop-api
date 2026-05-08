# LocalLoop API

NestJS backend for [LocalLoop](https://github.com/Local-Loop-org/localloop-shared) — auth, location-anchored groups, real-time chat, and OAuth-only sign-in. Built around Clean Architecture, geohash-based discovery, and a Socket.IO + Redis pub-sub gateway that stays correct across multiple instances.

[![CI](https://img.shields.io/github/actions/workflow/status/Local-Loop-org/localloop-api/ci.yml?branch=main&label=ci)](https://github.com/Local-Loop-org/localloop-api/actions/workflows/ci.yml)
[![Node 20](https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white)](#)
[![NestJS 10](https://img.shields.io/badge/nestjs-10.4-E0234E?logo=nestjs&logoColor=white)](#)
[![PostgreSQL 14 + PostGIS](https://img.shields.io/badge/postgres-14%20%2B%20postgis-336791?logo=postgresql&logoColor=white)](#)
[![Redis 7](https://img.shields.io/badge/redis-7-DC382D?logo=redis&logoColor=white)](#)

> Part of [LocalLoop](https://github.com/Local-Loop-org/localloop-shared) — start at the shared repo for the full project picture.

---

## What this service does

A NestJS HTTP + WebSocket service that:

- Verifies Google / Apple OAuth tokens via Supabase, issues stateless JWTs, and rotates refresh tokens.
- Manages users, their location (stored as a geohash, never coordinates), and DM permission settings.
- Lets users create, discover, join, and moderate groups anchored to a place, neighborhood, condo, or event.
- Powers a real-time chat namespace over Socket.IO, with multi-instance presence via a Redis pub-sub adapter.

Endpoint contracts and WebSocket events live in [`localloop-shared/docs/api-contracts.md`](https://github.com/Local-Loop-org/localloop-shared/blob/main/docs/api-contracts.md).

## Architecture: Clean per module

Every feature module follows the same four-layer split, with infrastructure depending on application depending on domain (and not the other way around):

```
src/modules/<feature>/
  domain/         entities, value objects, repository ports (interfaces only)
  application/    use cases — one class, one responsibility
  infra/          TypeORM repositories, mappers, external clients
  presentation/   controllers, DTOs, guards (REST) + gateway (WebSocket)
```

The `auth` module is a worked example: the controller calls `ExchangeGoogleTokenUseCase` / `ExchangeAppleTokenUseCase` / `RefreshTokenUseCase`, each of which depends on `IUserRepository` (a port). The port is bound to a TypeORM-backed adapter in the module's `infra/` layer. Use cases never import `@nestjs/typeorm` or HTTP types — they're plain classes you can unit-test with hand-rolled fakes.

See [src/modules/auth/](src/modules/auth/) for the full layout and [src/modules/auth/application/use-cases/](src/modules/auth/application/use-cases/) for the use case bodies.

## Modules

| Module | Path | Responsibility |
| --- | --- | --- |
| `auth` | [src/modules/auth/](src/modules/auth/) | Google + Apple OAuth via Supabase · JWT issuing · `POST /auth/refresh` (stateless rotation, validates the user is still active) |
| `user` | [src/modules/user/](src/modules/user/) | `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/location` — coordinates → geohash on write, never persisted as lat/lng |
| `groups` | [src/modules/groups/](src/modules/groups/) | Create, discover-nearby (geohash + 8 neighbor cells + haversine sort), detail, join, leave, moderation (approve / reject / ban / list members) |
| `messages` | [src/modules/messages/](src/modules/messages/) | History endpoint + Socket.IO `/chat` gateway with presence tracking |

## Data layer

PostgreSQL 14 + **PostGIS 3.4** (3.2 in CI). TypeORM 0.3 with migration-driven schema. Migrations live under [src/infra/migrations/](src/infra/migrations/):

| Migration | What it does |
| --- | --- |
| `1710770000000-InitialSetup` | Enums + `users` table |
| `1713700000000-CreateGroups` | `groups`, `group_members`, `group_join_requests` |
| `1714000000000-CreateMessages` | `messages` table |
| `1714500000000-AddGroupAnchorCoordinates` | Adds `anchor_lat` / `anchor_lng NUMERIC(9,6) NOT NULL` to `groups`; backfills from existing geohashes via `ngeohash.decode` |

Migrations are registered in two places that must stay in sync: [src/infra/typeorm/data-source.ts](src/infra/typeorm/data-source.ts) (used by the TypeORM CLI for `npm run migration:run`) and [src/app.module.ts](src/app.module.ts) (used by the boot path, which has `migrationsRun: true` so production self-applies on deploy). A migration that's registered in only one of them runs in only one of them — a constraint that bit production once and is now part of the PR checklist.

## Real-time chat

Socket.IO `/chat` namespace with a JWT middleware on connect (rejects on missing / expired token or inactive user). Each group has a room `group:{groupId}`. The gateway lives at [src/modules/messages/presentation/chat.gateway.ts](src/modules/messages/presentation/chat.gateway.ts) and exposes three events:

- `join_group` — checks the caller is an `ACTIVE` member, joins the room, and emits `presence_update`.
- `leave_group` — leaves the room and emits `presence_update`.
- `send_message` — runs `SendMessageUseCase` and broadcasts `new_message` to the room.

**Presence tracking is the interesting part.** The count is computed via `server.in(room).fetchSockets()`, which the [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) makes correct across multiple instances. On disconnect the gateway uses a `disconnecting` listener wrapped in `setImmediate` so Socket.IO has finished removing the socket from its rooms before we count again — without this the count would be off by one.

```ts
socket.on('disconnecting', () => {
  const groupRooms = [...socket.rooms].filter(r => r.startsWith('group:'));
  if (groupRooms.length === 0) return;
  setImmediate(() => {
    for (const room of groupRooms) void this.emitPresence(groupIdFromRoom(room));
  });
});
```

## Caching and infra

`docker-compose.yml` brings up Postgres + PostGIS and Redis for local dev; in production the API runs on Render with Neon Postgres and Upstash Redis. Today Redis serves the Socket.IO adapter; the next planned use is a per-geohash-cell cache for `GET /groups/nearby` (TTL ≈ 5 min).

## Testing

Jest with `ts-jest` and the `^@/(.*)$` path alias. Unit tests live next to source as `*.spec.ts` (use cases, gateway, domain logic — ~21 spec files, covering all 9 group use cases, all 3 auth use cases, the chat gateway's join / leave / disconnect / no-emit-on-failure / no-emit-without-rooms paths, and more). End-to-end tests live under [test/](test/) with their own `jest-e2e.json` config and helpers at [test/helpers/](test/helpers/) (`setup-auth-test-app.ts`, `in-memory-user.repository.ts`, `user.factory.ts`).

```bash
npm test          # unit tests
npm run test:e2e  # integration tests against real Postgres + Redis
npm run test:cov  # coverage report
```

## Local development

```bash
docker compose up -d        # Postgres + PostGIS + Redis
npm install
npm run migration:run       # apply migrations
npm run start:dev           # ts-node watch on src/main.ts
```

Required environment variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The JWT strategy refuses to start without `JWT_SECRET` set — there's no insecure fallback.

## CI/CD

Pipeline lives at [.github/workflows/ci.yml](.github/workflows/ci.yml) and runs on every push to `main` and every PR targeting `main`:

```
lint  →  test (unit + e2e)  →  docker build  →  Render deploy webhook
                                                   (main, push only)
```

The `test` job spins up `postgis/postgis:14-3.2` and `redis:7-alpine` as service containers — integration tests run against real services, not mocks. The `docker` job builds the production image (`localloop-api:ci`) to prove the Dockerfile is healthy. The `deploy` job fires the Render deploy webhook only when CI is green on main.

## What's interesting in this codebase

- **Clean Architecture in practice** — use cases are plain classes with port dependencies; controllers and gateways are thin.
- **Geospatial discovery** without leaking coordinates — geohash on write, neighbor expansion + haversine on read, only meters returned to clients.
- **Multi-instance-correct WebSocket presence** via the Redis adapter, with a `setImmediate` deferral that's only obvious once you've watched a count drift in production.
- **Stateless JWT rotation** — `POST /auth/refresh` re-validates that the user is still active before issuing a new access token.
- **Migrations applied on boot via `migrationsRun: true`** with a duplicated CLI registry — a real production incident from missing-on-deploy taught us to treat the two registrations as one logical list.
- **Real-services integration tests in CI** — Postgres + Redis service containers, not test doubles, so migrations and adapter behavior are exercised on every PR.
