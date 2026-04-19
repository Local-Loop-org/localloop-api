# LocalLoop API — Agent Guide

## What this project is

The NestJS backend for LocalLoop — a proximity-based group chat app.
Handles authentication, user management, group discovery, chat, and DMs.

**Stack:** NestJS 10 + TypeORM + PostgreSQL 14 + PostGIS | Redis + Socket.IO | Supabase (auth verification + storage)

## How to start any task

1. Read `../localloop-shared/docs/status.md` — understand where the project is
2. Read `../localloop-shared/docs/architecture.md` and relevant docs for the feature
3. Present a plan before writing any code
4. Implement layer by layer (domain → application → infra → presentation)

## Non-negotiable principles

- All architecture rules in `localloop-shared/docs/architecture.md` apply — read before implementing
- One use case = one class, one responsibility
- No business logic in controllers
- Zero `any` without a comment explaining why
- No silent catch blocks
