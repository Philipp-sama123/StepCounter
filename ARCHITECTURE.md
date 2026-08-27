# Architecture

StepCounter uses a feature-first modular monolith. Expo Router files are stable route adapters; application code lives in `src`.

## Dependency direction

```text
app routes -> feature presentation -> application/domain
                                      ^
                         platform and data adapters
```

- `app/` contains route names and navigation configuration only.
- `src/features/` owns feature screens and domain models.
- `src/platform/` owns device-specific infrastructure such as scoped local storage.
- `src/shared/` contains platform-independent date, formatting, math, and validation utilities.
- `src/firebase/`, `src/health/`, `src/storage/`, and `src/services/` are compatibility adapters. New domain types must not be declared in these folders.

## Data ownership

- HealthKit or Health Connect is authoritative for system health reads.
- Live sensor data is the fallback when system health data is unavailable.
- AsyncStorage is an offline cache and is scoped by Firebase UID.
- Firestore is the remote synchronized copy.
- The current reconciliation policy is explicitly `highest-wins`, preserving existing behavior. A future authoritative correction can use `incoming-authoritative` after product approval.

The first authenticated user after this version is installed receives a one-time migration of legacy unscoped local data. Other users receive independent namespaces.

## Quality gates

Run the full local gate before merging:

```bash
npm run check
npm run format:check
```

`check` runs strict TypeScript, ESLint with zero warnings, and Vitest characterization tests.

Native step providers and background execution still require physical-device checks on both Android and iOS before release.
