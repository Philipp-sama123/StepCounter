# StepCounter

StepCounter is a React Native + Expo Router step-tracking app with Firebase auth/sync, Health Connect / Apple Health support, live challenge mode, animated progress, and local history.

## Current Features

- Email/password registration, login, logout, and password reset with Firebase Auth.
- Firebase user profile + daily step sync to Firestore.
- Local step history persisted with AsyncStorage.
- Combined mode for live sensor + system health data.
- Google Data mode for Health Connect / system health totals.
- Challenge mode with live pedometer tracking, start/pause sessions, orange active state, and session summary toasts.
- Live sensor debug console in Challenge mode showing the last 5 Expo pedometer events.
- Animated progress ring, animated step totals, stacked top toasts, and bottom challenge-session toasts.

## App Screens

- `Combined`: main dashboard with current steps, goal progress, refresh, source, and sync status.
- `Google Data`: Health Connect / system-health focused view.
- `Challenge`: live sensor challenge mode with session steps, Start/Pause button, source summary, and live sensor log.
- `History`: recent local step history.

## Important Reality Check

Expo's live pedometer event is minimal. `Pedometer.watchStepCount` only exposes `steps`, so the Challenge sensor log shows the real data available to the app:

- receive timestamp
- raw subscription step count
- delta since previous event
- app total after applying the delta

For richer per-step/cadence/accelerometer data, this app would need a custom native sensor module or a deeper platform-specific implementation.

## Setup

### Prerequisites

- Node.js / npm
- Expo tooling via `npx expo`
- Android Studio / Android SDK for Android builds
- Xcode + CocoaPods for iOS builds

### Install

```bash
npm install
```

### Environment

Create a local `.env` from `.env.example` and fill in your Firebase values:

```bash
cp .env.example .env
```

The `.env` file is intentionally ignored by Git.

Required values:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Google OAuth client ID placeholders are present for future/native Google sign-in work:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

## Firebase

Enable these in Firebase Console:

- Authentication -> Email/Password
- Firestore Database

Firestore structure:

```text
users/{userId}
  displayName
  email
  photoURL
  updatedAt

users/{userId}/dailySteps/{yyyy-mm-dd}
  date
  goal
  source
  steps
  updatedAt
```

Rules for the MVP are in `firestore.rules` and restrict access to each signed-in user's own document tree.

## Running Locally

Start Expo:

```bash
npm start
```

Run Android native build:

```bash
npm run android
```

Run iOS native build:

```bash
npm run ios
```

After changing env values or native packages, restart Metro with cache reset:

```bash
npx expo start -c
```

## Native Module Notes

Health Connect and HealthKit require a native build/dev client. Expo Go is not enough for those native modules.

Use:

```bash
npx expo run:android
npx expo run:ios
```

Android Health Connect reads require compatible device support, permissions, and installed/available Health Connect services.

## Security / Public GitHub Notes

- `.env` is ignored and must stay local.
- `.env.example` is safe to commit because it only contains empty placeholders.
- Do not commit keystores, private keys, provisioning profiles, or filled env files.
- Firebase Web API keys are not server secrets, but restrict/rotate them in Google Cloud/Firebase if they were exposed elsewhere.
- Firestore rules should be deployed before using real user data.

## Useful Files

- `app/`: Expo Router screens.
- `src/hooks/useStepCounter.ts`: pedometer, Health Connect/system health, refresh, and sensor log logic.
- `src/auth/`: auth context and login/register UI.
- `src/firebase/`: Firebase config and Firestore sync.
- `src/storage/stepStorage.ts`: local goal/history/session persistence.
- `src/components/`: shared UI components and animations.

## Validation

Type-check:

```bash
npx tsc --noEmit
```

## License

Add your preferred license before publishing publicly.
