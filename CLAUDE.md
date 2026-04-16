# LocalLoop API — Agent Guide

## What this project is

The NestJS backend for LocalLoop — a proximity-based group chat app.
Handles authentication, user management, group discovery, chat, and DMs.

**Stack:** NestJS 10 + TypeORM + PostgreSQL 14 + PostGIS | Redis + Socket.IO | Supabase (auth verification + storage)

## Documentation

Full architecture, API contracts, data model, and ADRs live in the
[localloop-shared](https://github.com/andreyviktor/localloop-shared) repo under `docs/`.

Key files:
- `docs/architecture.md` — Clean Architecture pattern and module structure
- `docs/api-contracts.md` — All endpoint contracts
- `docs/data-model.md` — Database schema
- `docs/prd.md` — Business rules (source of truth)
- `docs/status.md` — Current project state and pending work

## Repository structure

```
src/
  modules/
    auth/
      domain/        ← entities, repository interfaces
      application/   ← use cases, DTOs
      infra/         ← TypeORM entities, repositories, Passport strategies
      presentation/  ← controllers
    (groups, chat, dms — Phase 2+)
  shared/
    supabase/        ← SupabaseService
  infra/
    typeorm/         ← DataSource config
    migrations/      ← numbered TypeORM migrations
```

## How to start any task

1. Read `docs/status.md` in localloop-shared — understand where the project is
2. Read the relevant section of `docs/prd.md` for the feature
3. Present a plan before writing any code
4. Implement layer by layer (domain → application → infra → presentation)

## Non-negotiable principles

- **Clean Architecture:** dependencies always point inward
- One use case = one class, one responsibility
- No business logic in controllers
- Zero `any` without a comment explaining why
- Never return `lat`, `lng`, or `geohash` in any API response
- Never store raw coordinates — convert to geohash immediately
- Never use OFFSET pagination — cursor-based only
- No silent catch blocks

## Shared packages

- `@localloop/shared-types` — enums used across API and mobile
- `@localloop/geo-utils` — geohash helpers

Import from these packages, never duplicate the types.
