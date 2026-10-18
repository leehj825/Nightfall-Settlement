# Ads (AdMob banner)

- Android app only. The web build keeps the grey "ADVERTISEMENT" placeholder strip (`#adBanner`, 50 px).
- Plugin: `@capacitor-community/admob` 6.2.0 (matches Capacitor 6). Code: `js/ads.js`. Mode: `js/ads_env.js` (`test` or `real`).
- App ID (public) is in `android/app/src/main/AndroidManifest.xml`: `ca-app-pub-4400173019354346~1453129498`.
- Banner unit ID: `ca-app-pub-4400173019354346/8899629819` (320x50, top centre, hidden on the title screen).
- **Test vs real:** `tools/make_www.js` writes `www/js/ads_env.js` from the env var `NF_ADS`. The release workflow sets `NF_ADS=real`. The debug workflow has a "real_ads" checkbox (default off = Google's sample banner). Never click your own real ads: it can get the AdMob account banned.
- First real ads can take up to an hour (and sometimes days) to start filling after the unit is created, and AdMob wants the app in the Play Store plus an `app-ads.txt` on the developer website.
- Consent: the UMP form is requested at start and only shown where Google says it is required (EEA / UK).
- Still to do before release: fill in the AdMob privacy answers in Play Console (Data safety: advertising ID, device ID), and test on a real phone.
