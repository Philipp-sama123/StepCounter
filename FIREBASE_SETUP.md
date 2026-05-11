# Firebase Setup

## 1. Create Firebase App Config

1. Open the Firebase console.
2. Create or select your project.
3. Add a Web app.
4. Copy the Firebase config values into a local `.env` file using `.env.example` as the template.

The `.env` file is intentionally ignored by Git.

## 2. Enable Firebase Auth

In Firebase Console:

1. Go to Authentication.
2. Open Sign-in method.
3. Enable Email/Password.
4. Enable Google.
5. Add your support email for Google sign-in.

## 3. Google OAuth

Email/password is wired for the pure React Native MVP. Google sign-in is intentionally disabled in the UI until a native Google sign-in package is added, because web OAuth/AuthSession is the Expo path we just removed.

When you add native Google sign-in later, create OAuth client IDs in Google Cloud Console:

1. Open APIs & Services.
2. Open Credentials.
3. Create OAuth client IDs for:
   - Web application
   - iOS
   - Android
4. Put the client IDs into `.env` or rename the env keys as part of the native Google package setup:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

For Android, use the package name from `android/app/build.gradle`: `com.anonymous.StepCounter`.

For iOS, use the bundle identifier from Xcode: `com.anonymous.StepCounter`.

## 4. Firestore Structure

The app writes daily step records here:

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

## 5. Firestore Rules

Use rules like these for the MVP:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;

      match /dailySteps/{date} {
        allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 6. Run Locally

After editing `.env`, restart Metro:

```bash
nvm use
npm start -- --reset-cache
```

Build and install the native app:

```bash
npm run android
npm run ios
```
