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

StepCounter is a small walking app for making everyday movement feel a bit more alive. It is not trying to be a giant fitness platform. It shows your steps, lets you run focused walking challenges, and keeps the useful history close enough that you actually want to look at it.

The dashboard is the everyday view: today’s steps, progress, health-data source, refresh, and Firestore sync. Challenge mode is for intentional walks. It has its own saved challenge goal, an orange progress ring, pace, duration, challenge goal percentage, and a live sensor console with the last ten readings.

History is intentionally one place. You can switch between daily totals and challenge sessions, with graphs that animate in instead of just appearing flat on the screen. Profile holds account actions, the daily step goal, height, weight tracking, BMI, and timestamped weight entries. Weight and BMI graphs reveal across the chart and bring entries in point by point.

## What Is In The App

- Email login, registration, logout, and persisted auth.
- Dashboard for today’s steps, source details, refresh, and Firestore save.
- Challenge sessions with a separate saved challenge goal.
- Orange challenge progress ring based on challenge steps, not daily total.
- Live sensor log for the last 10 readings during challenge mode.
- Unified history screen for totals, pace, and session history.
- Profile page for daily goal, body profile, BMI, and weight tracking.
- Timestamped weight entries with animated weight and BMI graphs.
- Firestore sync for daily steps, challenge sessions, profile data, and weight history.
- Health Connect / Google Fit-compatible data on Android, Apple Health where available, plus live sensor fallback.

## Run It

```bash
npm install
cp .env.example .env
npm start
```

Add your Firebase values to `.env`. That file is ignored by Git.

For real phone health data, use a native build:

```bash
npm run android
npm run ios
```

Expo Go is useful for UI checks, but Health Connect / HealthKit need the native app or a dev client.

## Firebase

Enable Email/Password auth in Firebase, then deploy the Firestore rules:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

## License

MIT
