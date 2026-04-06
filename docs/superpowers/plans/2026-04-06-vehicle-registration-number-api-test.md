# Vehicle Registration Number — API Test Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration test coverage for `registrationNumber` across all vehicle API endpoints in the running backend.

**Architecture:** All changes are additive tests inside the existing `api-test/src/tests/vehicles.spec.ts`. No new files, no production code changes. Tests hit the live backend via shared `axiosInstance`.

**Tech Stack:** Vitest globals, Axios, `@project/types` (`IVehicleResDTO`), Docker-hosted backend on `http://localhost:3001`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `api-test/src/tests/vehicles.spec.ts` | Modify | Add `registrationNumber` cases to `POST`, `GET`, and `PATCH` describe blocks |

---

## Prerequisites

Services must be running before executing any test step:

```bash
just up-build
```

---

## Task 1: POST /vehicles — registrationNumber cases

**Files:**
- Modify: `api-test/src/tests/vehicles.spec.ts`

- [ ] **Step 1: Write failing tests**

Add three tests inside the existing `describe('POST /vehicles', ...)` block, after the last `it(...)`:

```ts
it('returns 201 with registrationNumber when provided', async () => {
  const res = await axiosInstance.post<IVehicleResDTO>(
    '/vehicles',
    { ...baseVehiclePayload, registrationNumber: 'ABC-1234' },
    authHeaders(),
  );

  expect(res.status).toBe(201);
  expect(res.data.registrationNumber).toBe('ABC-1234');

  await axiosInstance
    .delete(`/vehicles/${res.data.id}`, authHeaders())
    .catch(() => undefined);
});

it('returns 201 with registrationNumber null when not provided', async () => {
  const res = await axiosInstance.post<IVehicleResDTO>(
    '/vehicles',
    baseVehiclePayload,
    authHeaders(),
  );

  expect(res.status).toBe(201);
  expect(res.data.registrationNumber).toBeNull();

  await axiosInstance
    .delete(`/vehicles/${res.data.id}`, authHeaders())
    .catch(() => undefined);
});

it('returns 400 when registrationNumber exceeds 15 characters', async () => {
  await expect(
    axiosInstance.post(
      '/vehicles',
      { ...baseVehiclePayload, registrationNumber: 'TOOLONGREGPLATE' + 'X' },
      authHeaders(),
    ),
  ).rejects.toMatchObject({ response: { status: 400 } });
});
```

- [ ] **Step 2: Run tests to verify new tests fail (or expose real state)**

```bash
cd api-test && pnpm exec vitest run src/tests/vehicles.spec.ts
```

Expected: the `registrationNumber exceeds 15 characters` test fails if the field isn't validated yet, and the null test fails if `registrationNumber` isn't in the response. (If all three pass, the backend already handles it — no production changes needed.)

- [ ] **Step 3: Commit**

```bash
git add api-test/src/tests/vehicles.spec.ts
git commit -m "add POST /vehicles registrationNumber api tests"
```

---

## Task 2: GET /vehicles/:id — registrationNumber returned in response

**Files:**
- Modify: `api-test/src/tests/vehicles.spec.ts`

- [ ] **Step 1: Write failing tests**

Add two tests inside the existing `describe('GET /vehicles/:id', ...)` block, after the last `it(...)`. The `beforeEach`/`afterEach` in that block already handle vehicle creation and cleanup — no need to repeat them.

```ts
it('returns registrationNumber as null when not set at creation', async () => {
  const res = await axiosInstance.get<IVehicleResDTO>(
    `/vehicles/${vehicleId}`,
    authHeaders(),
  );

  expect(res.status).toBe(200);
  expect(res.data.registrationNumber).toBeNull();
});

it('returns registrationNumber when it was set at creation', async () => {
  const createRes = await axiosInstance.post<IVehicleResDTO>(
    '/vehicles',
    { ...baseVehiclePayload, registrationNumber: 'XYZ-9999' },
    authHeaders(),
  );
  const idWithReg = createRes.data.id;

  const res = await axiosInstance.get<IVehicleResDTO>(
    `/vehicles/${idWithReg}`,
    authHeaders(),
  );

  expect(res.status).toBe(200);
  expect(res.data.registrationNumber).toBe('XYZ-9999');

  await axiosInstance
    .delete(`/vehicles/${idWithReg}`, authHeaders())
    .catch(() => undefined);
});
```

- [ ] **Step 2: Run tests to verify new tests fail (or expose real state)**

```bash
cd api-test && pnpm exec vitest run src/tests/vehicles.spec.ts
```

Expected: the null-check test fails if the field is absent from `GET` response.

- [ ] **Step 3: Commit**

```bash
git add api-test/src/tests/vehicles.spec.ts
git commit -m "add GET /vehicles/:id registrationNumber api tests"
```

---

## Task 3: PATCH /vehicles/:id — registrationNumber update cases

**Files:**
- Modify: `api-test/src/tests/vehicles.spec.ts`

- [ ] **Step 1: Write failing tests**

Add three tests inside the existing `describe('PATCH /vehicles/:id', ...)` block, after the last `it(...)`. The `beforeEach`/`afterEach` in that block already create a vehicle with `baseVehiclePayload` (no `registrationNumber`) and clean up.

```ts
it('returns 200 with updated registrationNumber', async () => {
  const res = await axiosInstance.patch<IVehicleResDTO>(
    `/vehicles/${vehicleId}`,
    { registrationNumber: 'NEW-REG-01' },
    authHeaders(),
  );

  expect(res.status).toBe(200);
  expect(res.data.registrationNumber).toBe('NEW-REG-01');
});

it('returns 200 and clears registrationNumber when patched to null', async () => {
  // First set a value
  await axiosInstance.patch<IVehicleResDTO>(
    `/vehicles/${vehicleId}`,
    { registrationNumber: 'TEMP-REG' },
    authHeaders(),
  );

  // Then clear it
  const res = await axiosInstance.patch<IVehicleResDTO>(
    `/vehicles/${vehicleId}`,
    { registrationNumber: null },
    authHeaders(),
  );

  expect(res.status).toBe(200);
  expect(res.data.registrationNumber).toBeNull();
});

it('returns 400 when registrationNumber exceeds 15 characters', async () => {
  await expect(
    axiosInstance.patch(
      `/vehicles/${vehicleId}`,
      { registrationNumber: 'TOOLONGREGPLATE' + 'X' },
      authHeaders(),
    ),
  ).rejects.toMatchObject({ response: { status: 400 } });
});
```

- [ ] **Step 2: Run tests to verify new tests fail (or expose real state)**

```bash
cd api-test && pnpm exec vitest run src/tests/vehicles.spec.ts
```

Expected: the 400 test fails if `PATCH` doesn't validate length yet.

- [ ] **Step 3: Commit**

```bash
git add api-test/src/tests/vehicles.spec.ts
git commit -m "add PATCH /vehicles/:id registrationNumber api tests"
```

---

## Final Verification

- [ ] Run the full vehicles API test suite and confirm all tests pass:

```bash
cd api-test && pnpm exec vitest run src/tests/vehicles.spec.ts
```

Expected: all tests pass with no skips or failures.
