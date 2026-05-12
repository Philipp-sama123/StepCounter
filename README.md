# StepCounter

```text
 /\_/\\          /\_____/\\
( o.o )        /  o   o  \\
 > ^ <        ( ==  ^  == )
               )         (
              (           )
              ( (  ) (  ) )
             (__(__)_(__)__)
```

A React Native + Expo Router step-tracking app with Firebase auth/sync, Health Connect / Apple Health support, live challenge sessions, local history, animated progress, and sensor debug logging.

## Features

- Email/password login, registration, logout, and password reset.
- Firebase Auth + Firestore user step sync.
- Combined, Google Data, Challenge, and History screens.
- Health Connect / Apple Health system step totals.
- Live Expo pedometer tracking for Challenge mode.
- Challenge session steps, session result toast, and last 5 sensor-event log.
- Animated progress ring, step counter, stacked top toasts, and bottom session toasts.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Firebase values. `.env` is ignored by Git.

Required:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Enable Firebase Authentication Email/Password and deploy the included `firestore.rules` before using real user data.

## Run

```bash
npm start
npm run android
npm run ios
```

Health Connect / HealthKit need a native build or dev client. Expo Go is not enough for those modules.

After native/env changes:

```bash
npx expo start -c
```

## Notes if you wanna improve the code with AI: 

- Expo's live pedometer event only exposes `steps`; the Challenge console logs timestamp, raw step count, delta, and app total.
- Keep `.env`, keystores, private keys, and provisioning files out of Git.
- Type-check with `npx tsc --noEmit`.

## License

MIT
