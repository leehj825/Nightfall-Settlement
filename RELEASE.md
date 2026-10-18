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
| `KEYSTORE_B64` | contents of `release.keystore.b64` |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `nightfall` |
| `KEY_PASSWORD` | key password |

## 3. Build
Actions -> **Android release** -> Run workflow. Raise `version_code` on every upload. Download the `nightfall-release` artifact: `app-release.aab` (upload to Play) and `app-release.apk` (sideload test).

## 4. Play Console checklist
- Developer account (one-time fee), create app, enable Play App Signing.
- Store listing: short/full description, 512×512 icon (`icons/`), 1024×500 feature graphic, 2+ phone screenshots.
- Content rating questionnaire (mild fantasy violence), target audience, Data safety form (the game collects no data; saves stay on the device).
- Privacy policy URL: publish `docs/privacy-policy.md` (e.g. via GitHub Pages).
- New personal accounts must run a closed test with testers for a period before production — check Google's current requirements.

The application id is `com.nightfall.settlement`. Without the secrets, the release build is unsigned and cannot be installed or uploaded.

## Automatic release builds (every merge to main)
- Merging or pushing to `main` runs "Android release": it builds the signed `.aab` (for the Play Console) and `.apk`, and publishes a GitHub Release `release-<run number>` with both attached. Version name is `1.0.<run number>`, version code is the run number (it always increases).
- You can also run it by hand (Actions -> Android release -> Run workflow) with your own version name and code.
- The release build removes the developer features (`?debug=1` tools and `window.__nf`, the title-screen Debug start, the Model field button) and uses the real AdMob banner. Debug APKs (the "Android debug APK" workflow on work branches) keep them and show Google test ads.
- Signing still needs the four repository secrets listed above; without them the output is unsigned.
