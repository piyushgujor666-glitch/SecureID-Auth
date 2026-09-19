# SecureID

SecureID provides a responsive registration, verification, login, account recovery, and protected dashboard experience backed by a real Express/PostgreSQL authentication API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/secureid run dev` — run the SecureID web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — managed Postgres connection string, plus `SESSION_SECRET` or `JWT_SECRET` for auth sessions

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/secureid/src/App.tsx` — frontend routes and auth form behavior
- `artifacts/secureid/src/index.css` — SecureID theme and responsive styling
- `artifacts/api-server/src/routes/auth.ts` — REST auth handlers
- `artifacts/api-server/src/lib/auth.ts` — password, OTP, JWT, cookie, and middleware logic
- `lib/db/src/schema/auth.ts` — users, OTP codes, and sessions schema
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and validation

## Architecture decisions

- The browser uses an HttpOnly cookie instead of localStorage so the JWT is not directly exposed to page scripts.
- The JWT is paired with a server-side session row; logout revokes that row instead of claiming that deleting a client token invalidates a JWT.
- OTPs are stored as SHA-256 hashes with expiration, attempt limits, and resend cooldowns.
- Development-only OTP codes are returned only outside production because no email integration is attached yet.

## Product

Users can create and verify an account, sign in, recover a password, and view a protected identity dashboard with session-aware logout.

## User preferences

The assignment requires understandable HTML/CSS/JavaScript concepts, so password strength, visibility toggles, OTP navigation, and auth transitions should remain easy to trace in the frontend.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm run typecheck:libs` before checking leaf packages when shared DB or generated code changes.
- The API workflow must receive a JWT signing secret; it uses `JWT_SECRET` first and `SESSION_SECRET` as a fallback.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
