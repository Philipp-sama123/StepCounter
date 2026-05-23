# Release Checklist

## Before Building

- Android package and iOS bundle id are set to `com.philipp.stepcounter` in `app.json`.
- Confirm Firebase/Google OAuth Android and iOS client settings match `com.philipp.stepcounter`.
- Confirm `.env` is not committed. Use EAS environment variables for cloud builds.
- Deploy `firestore.rules`.
- Test login, Health Connect permissions, dashboard sync, history sync, challenge save, profile save, and shared profile refresh on a real Android device.

## Required EAS Environment Variables

Add these for `preview` and `production`:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

## APK Build

```bash
eas login
eas build -p android --profile preview
```

## Local Release Build

```bash
npx expo run:android --variant release
```

The local APK is usually written to:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Smoke Test

- Fresh install starts at login.
- Email login persists after closing the app.
- Dashboard reads Health Connect steps.
- `History -> Sync` fills missing days from Health Connect.
- Debug `Sync` tab shows `Health`, `Firestore`, and `Final` values.
- Challenge end saves a session and updates shared profile data.

## Firestore Rules

This repo is configured for Firebase project `psteps-946c5`.

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```
