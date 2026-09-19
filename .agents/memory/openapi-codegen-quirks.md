---
name: OpenAPI codegen quirks
description: Durable constraints for Orval-generated shared clients and Zod schemas in this workspace.
---

When extending the OpenAPI contract, name reusable response/body components after the domain entity rather than after the operation. Orval also emits operation-derived Zod names, so a component such as `LoginResponse` can collide with the generated `LoginResponse` schema.

**Why:** The collision appears only during the generated library typecheck and is easy to miss when the Orval generation step itself succeeds.

**How to apply:** Keep request bodies and reusable responses entity-shaped, then run API codegen and `pnpm run typecheck:libs` before touching leaf packages. The shared generated fetch client uses `Headers.entries()`, so the api-client-react tsconfig must include `dom.iterable`.