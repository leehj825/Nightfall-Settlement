# Nightfall Settlement for Android (debug APK)

The game is wrapped with [Capacitor](https://capacitorjs.com/) so the same web code runs in an Android app. Everything the game needs (three.js included) is bundled in the app, so it works fully offline.

## Easiest way: let GitHub build the APK
1. Push this repository to GitHub (the `android/` folder, `package.json` and `.github/workflows/android-debug.yml` must be included).
2. On GitHub open **Actions -> "Android debug APK" -> Run workflow**. (It also runs when you push a tag such as `v1.0.0`.)
3. When the run is green, open it and download the **nightfall-debug-apk** artifact. Unzip it to get `app-debug.apk`.
4. Copy `app-debug.apk` to your phone, open it and allow "Install unknown apps" for the app you opened it from. (Or use `adb install app-debug.apk`.)

A *debug* APK is signed with a debug key: fine for your own phone and testers, but not for the Play Store.

## Build on your own computer
Requirements: Node 20+, JDK 17, Android SDK (Android Studio installs it).
```
npm install
npm run android:debug        # copies the game into the app and runs Gradle
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
`npm run android:sync` only copies the web files into the Android project (use it before opening `android/` in Android Studio).

## What was customised
- Full-screen immersive window, screen stays on while playing (`MainActivity.java`).
- Launcher icon and splash screen generated from `icons/icon-512.png` (`python3 tools/make_android_assets.py`).
- The service worker is not used inside the app (the files are already local).

## Not covered here
Play Store publishing needs a release signing key, an app bundle (`./gradlew bundleRelease`), a developer account, a privacy policy and store listing assets. None of that is set up. I could not build or run the APK in the development environment I used (the Android SDK download host was not reachable), so the first CI run is the real test - if it fails, send me the log.
