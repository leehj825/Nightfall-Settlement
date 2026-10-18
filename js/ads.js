// Nightfall Settlement - AdMob banner (Android app only; the web build keeps the placeholder strip).
// Never click your own real ads: debug builds use Google's test banner unless NF_ADS_MODE is 'real'.
(function () {
  const C = window.Capacitor; if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const AdMob = C.Plugins && C.Plugins.AdMob; if (!AdMob) return;
  const real = window.NF_ADS_MODE === 'real';
  const BANNER_ID = real ? 'ca-app-pub-4400173019354346/8899629819' : 'ca-app-pub-3940256099942544/6300978111';      // second = Google's sample banner
  let shown = false;
  async function show() { if (shown) return; shown = true; try { await AdMob.showBanner({ adId: BANNER_ID, adSize: 'BANNER', position: 'TOP_CENTER', margin: 0, isTesting: !real }); } catch (e) { shown = false; } }
  async function hide() { if (!shown) return; shown = false; try { await AdMob.hideBanner(); } catch (e) { /* ignore */ } }
  const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  async function start() {
    try {
      await within(AdMob.initialize({ initializeForTesting: !real }), 8000);
      try { const info = await within(AdMob.requestConsentInfo(), 5000); if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm(); } catch (e) { /* consent is optional outside the EEA */ }
      AdMob.addListener('bannerAdLoaded', () => document.body.classList.add('adLive'));
      AdMob.addListener('bannerAdFailedToLoad', () => document.body.classList.remove('adLive'));
      const sync = () => { if (document.body.classList.contains('titlemode')) { hide(); document.body.classList.remove('adLive'); } else show(); };
      new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] }); sync();
    } catch (e) { /* ads are never allowed to break the game */ }
  }
  // The Mobile Ads SDK starts up on the UI thread and can freeze the app for a moment, so it only starts once the game is up and running:
  // not on the title screen, and not before the loading cover is gone, plus a few seconds of grace.
  let waited = 0;
  (function ready() {
    const cover = document.getElementById('bootCover'), title = document.body.classList.contains('titlemode');
    if (cover || title || waited < 4000) { waited = cover || title ? 0 : waited + 500; return setTimeout(ready, 500); }
    start();
  })();
})();
