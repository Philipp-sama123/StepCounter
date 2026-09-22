# Architecture

StepCounter uses a feature-first modular monolith. Expo Router files are stable route adapters; application code lives in `src`.

## Dependency direction

```text
app routes -> feature presentation -> application -> domain
                                      ^
                             infrastructure adapters
```

- `app/` contains route names and navigation configuration only.
- `src/features/<feature>/domain` owns business models and deterministic rules.
- `src/features/<feature>/application` owns use cases and data orchestration.
- `src/features/<feature>/infrastructure` owns adapters for persistence, cloud, and device APIs.
- `src/features/<feature>/presentation` owns screens, hooks, and feature-owned UI adapters.
- `src/platform/` owns device-specific infrastructure such as scoped local storage.
- `src/shared/` contains platform-independent date, formatting, math, validation, and reusable UI primitives.
- `src/firebase/`, `src/health/`, `src/storage/`, `src/services/`, and `src/components/` are compatibility adapters during the migration. New presentation code must use its owning feature boundary instead of importing these folders directly.

## Feature layout

```text
src/
  features/
    steps/
      domain/             # StepDay, goals, reconciliation
      application/        # history and sync use cases
      infrastructure/     # local, Firestore, and system-health boundaries
      presentation/       # tracking hooks and step UI
    profile/
    sharing/              # optional social feature
    challenges/           # optional session feature
  shared/
    ui/                   # reusable, feature-neutral controls
    date/
    format/
```

The current compatibility modules retain their existing storage keys and APIs. They can be retired only after all callers have crossed the corresponding feature boundary and a migration release has shipped.

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
