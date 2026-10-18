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
  async function start() {
    try {
      await AdMob.initialize({ initializeForTesting: !real });
      try { const info = await AdMob.requestConsentInfo(); if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm(); } catch (e) { /* consent is optional outside the EEA */ }
      AdMob.addListener('bannerAdLoaded', () => document.body.classList.add('adLive'));
      AdMob.addListener('bannerAdFailedToLoad', () => document.body.classList.remove('adLive'));
      const sync = () => { if (document.body.classList.contains('titlemode')) { hide(); document.body.classList.remove('adLive'); } else show(); };
      new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] }); sync();
    } catch (e) { /* ads are never allowed to break the game */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
