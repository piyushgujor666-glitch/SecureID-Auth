# SecureID

SecureID is a responsive identity and authentication journey built for the internship assignment. It includes account registration, readable password-strength logic, email and mobile OTP verification, authenticator setup, login, password recovery, a protected dashboard, and revocable cookie-backed sessions.

## Features

- Responsive landing, registration, verification, login, reset, and dashboard screens
- Client-side and server-side validation
- Password show/hide controls on registration, login, and reset flows
- Five-rule password checklist with Weak, Medium, and Strong states
- Passwords hashed with `bcryptjs`; no plaintext password is stored
- Cryptographically random, hashed, expiring OTPs with resend cooldown and attempt limits
- Development-only OTP code display when no email provider is configured
- HttpOnly, SameSite session cookie containing a short-lived signed JWT
- Server-side session records so logout revokes the current session
- Protected `/api/me` endpoint and dashboard guard
- Generic forgot-password response that does not confirm whether an email exists
- OpenAPI-first API contract and generated React Query hooks

## Project map

```text
artifacts/secureid/
  src/App.tsx                 # Auth screens, routing, form behavior
  src/index.css               # SecureID visual system and responsive styles
  public/                     # Static favicon and robots file

artifacts/api-server/
  src/routes/auth.ts          # Authentication API handlers
  src/lib/auth.ts             # Password, OTP, JWT, cookie, and middleware helpers

lib/db/src/schema/auth.ts     # Users, OTPs, and sessions tables
lib/api-spec/openapi.yaml     # API source of truth
lib/api-client-react/         # Generated frontend hooks
lib/api-zod/                  # Generated server validation schemas
```

## Run locally

The workspace already includes the development database and managed workflows.

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
```

In a second terminal:

```bash
pnpm --filter @workspace/secureid run dev
```

The Replit preview routes `/` to the web app and `/api` to the API server. The web app uses relative API paths, so it works through the shared preview proxy without hardcoded localhost URLs.

## Environment variables

Required:

```env
DATABASE_URL=             # provided by the project database
SESSION_SECRET=           # secret used as the JWT signing fallback
```

Optional:

```env
JWT_SECRET=               # preferred JWT signing secret; overrides SESSION_SECRET
ALLOWED_ORIGIN=           # production CORS origin, for example https://your-name-secureid.vercel.app
NODE_ENV=development
```

Never commit `.env` or any real secret. In production, configure an email provider and replace the development OTP response with the provider adapter before enabling real user traffic.

## Development OTP mode

When `NODE_ENV` is not `production`, registration and OTP endpoints return a `devCode` field. The UI renders that code in a clearly labelled development-only notice so the flow can be tested without an email service. In production, `devCode` is always `null` and OTP values are not logged.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/healthz` | Health check |
| POST | `/api/auth/register` | Validate and create an account; starts email OTP |
| POST | `/api/auth/send-otp` | Send an email, mobile, or reset OTP |
| POST | `/api/auth/verify-otp` | Verify an OTP and update verification state |
| POST | `/api/auth/resend-otp` | Send a replacement OTP after cooldown |
| POST | `/api/auth/login` | Check credentials and create a session |
| GET | `/api/me` | Return the authenticated public user |
| POST | `/api/auth/logout` | Revoke the current session and clear its cookie |
| POST | `/api/auth/forgot-password` | Start a reset without revealing account existence |
| POST | `/api/auth/reset-password` | Verify reset OTP and update the password |

## Authentication flow

1. Registration validates the fields and requires a Medium-or-strong password.
2. The API hashes the password with bcrypt and writes only the hash to PostgreSQL.
3. A six-digit OTP is generated with `crypto.randomInt`, hashed, stored with a ten-minute expiry, and returned only in development mode.
4. Email and mobile verification mark their corresponding user fields as verified. The authenticator screen is the final setup step in this assignment flow; the backend login gate is email verification.
5. Login compares the submitted password to the bcrypt hash. It creates a one-hour JWT with only `userId` and `sessionId` claims.
6. The JWT is stored in an HttpOnly, SameSite cookie. Its SHA-256 hash is also stored in the sessions table.
7. The auth middleware verifies the JWT signature, checks the session hash, checks expiry and revocation, and loads the user.
8. `/api/me` returns only safe account fields. It never returns passwords, OTPs, token secrets, or database credentials.
9. Logout marks the server-side session revoked and clears the cookie. This invalidates the session before the JWT's natural expiry.

## Password logic for the live-coding video

The password logic is intentionally straightforward:

```text
length >= 8       +1
uppercase         +1
lowercase         +1
number            +1
special character +1

0–2 = Weak
3–4 = Medium
5   = Strong
```

The registration form prevents submission below Medium strength. The same server-side rule is enforced again in the API so the client cannot bypass it.

## Deployment notes

For Replit publishing, publish the project with the `SecureID` web artifact and the API server workflow. Set `SESSION_SECRET` or `JWT_SECRET` in the production Secrets pane and keep `DATABASE_URL` attached to the production database.

For a Vercel submission, deploy the static web build and expose the Express API as a Vercel-compatible serverless function or a separately hosted Node service. Set the same environment variables on that deployment, use the same-origin `/api` path (or configure a secure rewrite), and ensure cookies remain `HttpOnly`, `Secure`, and `SameSite=Lax` over HTTPS. Do not hardcode a fake `your-name-secureid.vercel.app` URL in the repository.

## Verification performed

- Generated API client and Zod schemas from the OpenAPI contract
- Typechecked shared libraries, API server, and SecureID frontend
- Started both managed services successfully
- Checked the health endpoint and web root through the shared proxy
- Exercised registration, wrong OTP, email verification, mobile verification, login, `/api/me`, logout, and post-logout protection