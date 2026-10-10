# Releasing Nightfall Settlement on Google Play

The repo builds a release bundle in CI. The things only you can provide are the signing key and the Play Console account.

## 1. Create a signing key (once, keep it safe — losing it means you cannot update the app)
```
keytool -genkeypair -v -keystore release.keystore -alias nightfall -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > release.keystore.b64
```

## 2. Add GitHub repository secrets (Settings -> Secrets and variables -> Actions)
| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `release.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `nightfall` |
| `ANDROID_KEY_PASSWORD` | key password |

## 3. Build
Actions -> **Android release** -> Run workflow. Raise `version_code` on every upload. Download the `nightfall-release` artifact: `app-release.aab` (upload to Play) and `app-release.apk` (sideload test).

## 4. Play Console checklist
- Developer account (one-time fee), create app, enable Play App Signing.
- Store listing: short/full description, 512×512 icon (`icons/`), 1024×500 feature graphic, 2+ phone screenshots.
- Content rating questionnaire (mild fantasy violence), target audience, Data safety form (the game collects no data; saves stay on the device).
- Privacy policy URL: publish `docs/privacy-policy.md` (e.g. via GitHub Pages).
- New personal accounts must run a closed test with testers for a period before production — check Google's current requirements.

The application id is `com.nightfall.settlement`. Without the secrets, the release build is unsigned and cannot be installed or uploaded.
