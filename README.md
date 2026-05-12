# StepCounter

```text
 /\_/\          /\_____/\
( o.o )        /  o   o  \
 > ^ <        ( ==  ^  == )
               )         (
              (           )
              ( (  ) (  ) )
             (__(__)_(__)__)
```

StepCounter is a personal walking companion for tracking daily steps, live challenges, and progress over time. It combines system health data with live sensor sessions, then turns the numbers into a clean mobile dashboard with animated progress, history graphs, challenge logs, and profile stats.

The app is built for people who want more than a raw step total. You can refresh your daily steps, start short walking challenges, see pace and session history, save your progress to your account, and keep a simple body profile with BMI and optional weight tracking.

## What It Does

- Shows today’s steps with an animated progress ring and goal status.
- Reads step totals from Health Connect / Google Fit-compatible data on Android, Apple Health on iOS where available, and live sensor data during challenges.
- Lets you start and stop challenge sessions with session steps, pace, duration, source, and a small live sensor console.
- Saves daily totals, walking stats, challenge sessions, profile data, and weight history to Firestore for the signed-in user.
- Includes email login, registration, logout, and persistent sessions.
- Provides history views for steps, pace, challenge sessions, BMI, and weight tracking.
- Uses stacked toast messages for refresh, sync, success, and error feedback.

## Run It

```bash
npm install
cp .env.example .env
npm start
```

Fill `.env` with your Firebase project values before logging in or syncing data. `.env` is ignored by Git.

For real Health Connect / HealthKit data, use a native build or development client:

```bash
npm run android
npm run ios
```

Expo Go is useful for quick UI work, but native health modules need a real native build.

## Firebase

Enable Firebase Authentication with email/password, add your Firebase web config to `.env`, and deploy the included Firestore rules:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

## License

MIT
