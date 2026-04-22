# Build-time vs Runtime Gates — A Code-Review Pitfall

A lesson recorded from PR #46 (Firebase OAuth E2E setup). A code-review
recommendation that *looked* clean broke pipeline E2E and had to be reverted.
Future reviews must not repeat this pattern.

---

## The mistake

During PR #46 review, the reviewer recommended hardening
`frontend/src/lib/firebase.ts::exposeE2ESignInHelper` like this:

```ts
function exposeE2ESignInHelper(auth: Auth): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return; // ← suggested
  // ...assigns window.__e2eAuth
}
```

Stated rationale: *"Turn the runtime gate into a compile-time guarantee — the
helper (and the `signInWithEmailAndPassword` import that's only used inside it)
will tree-shake out of production builds. Four-key safety becomes physical
impossibility."*

Author implemented it with TDD (commit `0f38cbf`). Pipeline E2E went red. The
guard had to be reverted (commit `a17e395`).

---

## Why it broke — the deployment topology the reviewer missed

The pipeline E2E job in `.circleci/config.yml` runs Playwright against the
**actual production-built frontend image**:

- `frontend/Dockerfile` runs `pnpm build` (Next.js `next build`) → produces
  the standalone server image. `next build` **always** sets `NODE_ENV=production`
  regardless of what environment it will deploy to.
- That same image (tagged `maintenance-tracker/frontend:${CIRCLE_SHA1_SHORT}`,
  pushed to ECR) is pulled by both the production deployment **and** the
  pipeline E2E job.
- Pipeline E2E differs from real prod **only** in the env vars the container is
  started with: `FRONTEND_ENABLE_MOCK_AUTH=true` and
  `FRONTEND_FIREBASE_AUTH_EMULATOR_HOST=...` are set; real prod leaves them
  unset.

Adding `NODE_ENV === 'production'` as an early-return therefore strips
`__e2eAuth` from precisely the artifact the E2E suite is meant to validate.
The runtime gate (`authEmulatorHost` is only truthy when the emulator env vars
are present) was already doing the right thing at the right layer; the
build-time gate didn't strengthen safety, it removed a capability the test
infrastructure depends on.

---

## Root cause — three confusions to avoid

**1. `NODE_ENV` is a build-time identity flag, not a deployment-environment marker.**
`next build` (and most JS bundlers) set `NODE_ENV=production` to enable
optimizations. It tells you the binary was built for production *characteristics*
(minified, tree-shaken, no dev warnings). It does **not** tell you whether the
running container is the real production deployment, a pipeline E2E run, a
canary, or a security-scanning environment.

**2. "Runtime safety" and "compile-time stripping" are not freely interchangeable.**
A runtime gate (`if (envVarSet) ...`) keeps the code in the artifact and lets
container env vars decide. A compile-time strip (`if (NODE_ENV === 'production')
return`) removes the code from the artifact entirely. You can only swap one for
the other if **every consumer of the artifact agrees on the discriminator**. In
this project they don't: pipeline E2E shares the prod artifact's `NODE_ENV` but
needs different runtime behavior.

**3. The reviewer didn't read what artifact the E2E job runs against.**
The PR added the `e2e-test` CircleCI job. Reading that job would have shown
`docker compose run --rm playwright-runner` stacks against pipeline-built
`server`/`client` images. The recommendation was made on architectural
principle without checking the deployment topology.

---

## Rule — apply on every future review

**Before suggesting `process.env.NODE_ENV === 'production'` (or any
compile-time guard) as an early-return on a code path, answer all four:**

1. **What artifacts does this code path get built into?** (Frontend image?
   Backend image? Both?)
2. **Is the same artifact reused by any non-prod environment** (E2E,
   load-test, canary, security scan)?
3. **What discriminator separates real-prod from those reused environments?**
   If it's runtime env vars (almost always the case for this project), then
   `NODE_ENV` is the wrong gate — it can't distinguish them.
4. **What capability does the early-return remove from the reused
   environment?** If the answer is "the thing that environment needs to
   function", reject the suggestion.

If any of (2), (3), (4) are unclear, do not recommend the guard. Read the
CI config and Dockerfile first.

---

## Project-specific facts to remember

- `frontend/Dockerfile` builds with `next build` → `NODE_ENV=production` is
  set in *every* image that comes out of CI, including the one pipeline E2E
  runs against.
- Pipeline E2E vs real prod is discriminated **only** at container start, by
  `FRONTEND_ENABLE_MOCK_AUTH` + `FRONTEND_FIREBASE_AUTH_EMULATOR_HOST`
  (frontend) and `BACKEND_ENABLE_MOCK_AUTH` + `FIREBASE_AUTH_EMULATOR_HOST`
  (backend). These env vars are unset in real prod.
- The runtime gate `if (config.authEmulatorHost)` in `initFirebase` is the
  correct layer to gate emulator-only capabilities on. Do not move it earlier.
- The same logic applies to backend: `firebase.service.ts::buildAppOptions`
  branches on `enableMockAuth` (a runtime env-derived flag), not on
  `NODE_ENV`. Keep it that way.

---

## Linus verdict on the original suggestion

🔴 **Garbage.** Not because the goal was wrong — eliminating runtime-only
guarantees in favor of compile-time ones is good taste in general — but
because the reviewer reasoned about a "production build" without checking
which environments consume that build. Theory ("compile-time strip is
stronger than runtime gate") lost to practice ("the test environment uses
the same artifact as prod"). When that happens, theory is wrong, every
single time.
