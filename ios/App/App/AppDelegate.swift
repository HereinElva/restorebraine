import UIKit
import Capacitor
import WebKit
import AuthenticationServices

private final class RestorebraineSessionMessageHandler: NSObject, WKScriptMessageHandler {
    weak var appDelegate: AppDelegate?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "restorebraineNativeSession",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "clear":
            let defaults = UserDefaults.standard
            defaults.removeObject(forKey: "CapacitorStorage.base44_access_token")
            defaults.removeObject(forKey: "CapacitorStorage.token")
            defaults.set("1", forKey: "CapacitorStorage.b44_signed_out")
        case "clearTokens":
            let tokenDefaults = UserDefaults.standard
            tokenDefaults.removeObject(forKey: "CapacitorStorage.base44_access_token")
            tokenDefaults.removeObject(forKey: "CapacitorStorage.token")
            tokenDefaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
        case "openLogin":
            let url = body["url"] as? String
            // Must start ASWebAuthenticationSession synchronously — async breaks iOS user-gesture requirement
            appDelegate?.openNativeOAuthLogin(preferredURL: url)
        default:
            break
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, ASWebAuthenticationPresentationContextProviding {

    var window: UIWindow?

    private var sessionMessageHandler: RestorebraineSessionMessageHandler!
    private var sessionBridgeScriptInstalled = false
    private var oauthAuthSession: ASWebAuthenticationSession?

    private var nativeBuildLabel: String {
        guard let url = Bundle.main.url(forResource: "BUILD_STAMP", withExtension: "txt"),
              let label = try? String(contentsOf: url, encoding: .utf8) else {
            return "native bundle unknown"
        }
        return label.trimmingCharacters(in: .whitespacesAndNewlines)
    }


    private func persistOAuthTokenFromURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return }
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    private func storedNativeToken() -> String? {
        let defaults = UserDefaults.standard
        if defaults.string(forKey: "CapacitorStorage.b44_signed_out") == "1" {
            return nil
        }
        return defaults.string(forKey: "CapacitorStorage.base44_access_token")
            ?? defaults.string(forKey: "CapacitorStorage.token")
    }

    private func defaultGoogleOAuthURL() -> URL {
        var components = URLComponents(string: "https://restorebraine.base44.app/api/apps/auth/login")!
        components.queryItems = [
            URLQueryItem(name: "app_id", value: "68fdc5f42768c4d045fe1bac"),
            URLQueryItem(name: "from_url", value: "https://restorebraine.base44.app"),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        return components.url!
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = window { return window }
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    func openNativeOAuthLogin(preferredURL: String?) {
        let url: URL
        if let preferredURL = preferredURL, let parsed = URL(string: preferredURL) {
            url = parsed
        } else {
            url = defaultGoogleOAuthURL()
        }

        oauthAuthSession?.cancel()
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: "restorebraine"
        ) { [weak self] callbackURL, error in
            guard let self = self else { return }
            if let authError = error as? ASWebAuthenticationSessionError,
               authError.code == .canceledLogin {
                return
            }
            if let callbackURL = callbackURL {
                self.persistOAuthTokenFromURL(callbackURL)
            }
            if self.storedNativeToken() != nil {
                self.notifyWebViewOAuthComplete()
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        oauthAuthSession = session
        if !session.start() {
            print("Restorebraine: ASWebAuthenticationSession.start() failed — trying JS InAppBrowser fallback")
            notifyWebViewOpenLoginFallback()
        }
    }

    private func notifyWebViewOpenLoginFallback() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        let js = "try { if (window.__restorebraineOpenLoginJsFallback) window.__restorebraineOpenLoginJsFallback(); else if (window.__restorebraineOpenLogin) window.__restorebraineOpenLogin(); } catch (e) {}"
        if Thread.isMainThread {
            webView.evaluateJavaScript(js, completionHandler: nil)
        } else {
            DispatchQueue.main.async {
                webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    private func notifyWebViewOAuthComplete() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let bridge = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = bridge.webView else { return }
            let token = self.storedNativeToken() ?? ""
            let escaped = token
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            webView.evaluateJavaScript(
                """
                (function () {
                  try { localStorage.removeItem('b44_signed_out'); } catch (e) {}
                  var t = '\(escaped)';
                  if (t) {
                    localStorage.setItem('base44_access_token', t);
                    localStorage.setItem('token', t);
                  }
                  try {
                    window.dispatchEvent(new CustomEvent('restorebraine-session-updated'));
                    window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
                  } catch (e) {}
                })();
                """,
                completionHandler: nil
            )
        }
    }

    private func loadGhostBuildLists() -> (block: [String], allow: [String]) {
        guard let url = Bundle.main.url(forResource: "ghost-builds", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8) else {
            return (
                ["App-B4VcOATW.js", "App-BMryy2H5.js", "index-CLtZjYMv.js", "index-CJJVGreG.js"],
                ["index-BtNzh8Fh.js", "App-DvoqTTOC.js", "index-Dzn3_rKv.js"]
            )
        }
        var block: [String] = []
        var allow: [String] = []
        for line in text.split(whereSeparator: \.isNewline) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            if trimmed.hasPrefix("+") {
                let name = trimmed.dropFirst().trimmingCharacters(in: .whitespaces)
                if !name.isEmpty { allow.append(String(name)) }
            } else {
                block.append(trimmed)
            }
        }
        if block.isEmpty {
            block = ["App-B4VcOATW.js", "App-BMryy2H5.js", "index-CLtZjYMv.js", "index-CJJVGreG.js"]
        }
        return (block, allow)
    }

    private var needsFreshLoadAfterCachePurge = false

    private func isBundledCapacitorMode() -> Bool {
        guard let configUrl = Bundle.main.url(forResource: "capacitor.config", withExtension: "json"),
              let data = try? Data(contentsOf: configUrl),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return true
        }
        guard let server = json["server"] as? [String: Any],
              let url = server["url"] as? String,
              !url.isEmpty else {
            return true
        }
        return false
    }

    private func purgeGhostBuildCacheIfNeeded() {
        // WK purge + reload races first paint — white screen on hosted and bundled Capacitor shells.
        // Ghost stale bundles are handled by purgeGhostBuilds JS after page load instead.
        return
    }

    private func reloadAfterCachePurgeIfNeeded() {
        guard needsFreshLoadAfterCachePurge else { return }
        needsFreshLoadAfterCachePurge = false

        let defaults = UserDefaults.standard
        let reloadKey = "rb_cache_purge_reloaded_for"
        let current = nativeBuildLabel
        if defaults.string(forKey: reloadKey) == current { return }
        defaults.set(current, forKey: reloadKey)

        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }

        webView.evaluateJavaScript(
            "try{sessionStorage.removeItem('rb_ghost_reload_count');}catch(e){}",
            completionHandler: nil
        )

        // Bundled: never reload WebView after cache purge
        if let url = webView.url, url.scheme == "capacitor" || url.scheme == "ionic" {
            return
        }

        if let url = webView.url, url.scheme == "https" || url.scheme == "http" {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var items = (components?.queryItems ?? []).filter { $0.name != "rb_nocache" && $0.name != "rb_probe" }
            items.append(URLQueryItem(name: "rb_nocache", value: String(Int(Date().timeIntervalSince1970 * 1000))))
            components?.queryItems = items
            if let freshURL = components?.url {
                webView.load(URLRequest(url: freshURL, cachePolicy: .reloadIgnoringLocalCacheData))
            }
        }
    }

    private func bundledMinimalBridgeScript(for buildLabel: String, syncToken: String) -> String {
        let escapedLabel = buildLabel
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        // Minimal bridge for bundled ios/public — NO Location.prototype patches at document start (white screen)
        // Do NOT inject OAuth token here — stale UserDefaults token causes infinite auth spinner on boot.
        return #"""
        (function () {
          window.__RESTOREBRAINE_NATIVE_BUILD__ = '\#(escapedLabel)';
          window.__restorebraineMinimalBridge = true;
          function showLoadProof() {
            try {
              var el = document.getElementById('rb-load-proof');
              if (el && el.parentNode) el.parentNode.removeChild(el);
            } catch (e) {}
          }
          showLoadProof();
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showLoadProof, { once: true });
          }
        })();
        """#
    }

    private func bundledOAuthBridgeScript(for syncToken: String) -> String {
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        // OAuth-only bridge for bundled ios/public — NO Location.prototype patches (white screen)
        return #"""
        (function () {
          if (window.__restorebraineBundledOAuthInstalled) return;
          window.__restorebraineBundledOAuthInstalled = true;
          try {
            var stale = document.getElementById('rb-load-proof');
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
          } catch (e) {}

          var RESTOREBRAINE = 'https://restorebraine.base44.app';
          var APP_ID = '68fdc5f42768c4d045fe1bac';
          var FROM_URL = RESTOREBRAINE;
          var SIGNED_OUT_KEY = 'b44_signed_out';
          var keys = ['base44_access_token', 'token'];

          function providerFromLabel(label) {
            if (/apple/i.test(label || '')) return 'apple';
            if (/microsoft/i.test(label || '')) return 'microsoft';
            return 'google';
          }

          function getCanonicalOAuthUrl(provider) {
            provider = provider || 'google';
            var path = provider === 'google'
              ? '/api/apps/auth/login'
              : '/api/apps/auth/' + provider + '/login';
            return RESTOREBRAINE + path + '?app_id=' + APP_ID + '&from_url=' + encodeURIComponent(FROM_URL) + '&prompt=select_account';
          }

          function normalizeAuthUrl(rawUrl, providerHint) {
            try {
              return getCanonicalOAuthUrl(providerHint || 'google');
            } catch (e) {
              return getCanonicalOAuthUrl('google');
            }
          }

          function isSignedOut() {
            try { return localStorage.getItem(SIGNED_OUT_KEY) === '1'; } catch (e) {}
            return false;
          }

          function clearSignedOutFlag() {
            try { localStorage.removeItem(SIGNED_OUT_KEY); } catch (e) {}
          }

          function readToken() {
            try {
              for (var i = 0; i < keys.length; i++) {
                var value = localStorage.getItem(keys[i]);
                if (value) return value;
              }
            } catch (e) {}
            return null;
          }

          function saveToken(token) {
            if (!token) return false;
            try {
              clearSignedOutFlag();
              localStorage.setItem('base44_access_token', token);
              localStorage.setItem('token', token);
              try {
                window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: token } }));
                window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete', { detail: { token: token } }));
              } catch (e) {}
              return true;
            } catch (e) {}
            return false;
          }

          function captureAccessTokenFromUrl(url) {
            try {
              var parsed = url ? new URL(url) : window.location;
              var token = parsed.searchParams.get('access_token');
              if (!token) return null;
              saveToken(token);
              return token;
            } catch (e) {}
            return null;
          }

          var oauthBrowserListenerAttached = false;
          var SYSTEM_BROWSER_OPTIONS = {
            iOS: { closeButtonText: 2, viewStyle: 2, animationEffect: 2, enableBarsCollapsing: true, enableReadersMode: false },
            android: { showTitle: false, hideToolbarOnScroll: false, viewStyle: 0, startAnimation: 0, exitAnimation: 1 }
          };

          function getInAppBrowserPlugin() {
            return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser;
          }

          function getBrowserPlugin() {
            return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
          }

          function finishOAuthLogin(ib) {
            try { if (ib) ib.close(); } catch (e) {}
            try {
              window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
              window.dispatchEvent(new CustomEvent('restorebraine-session-updated'));
            } catch (e) {}
          }

          function handleOAuthBrowserUrl(url, ib) {
            if (!url) return false;
            try {
              var parsed = new URL(url);
              var token = parsed.searchParams.get('access_token');
              if (token) {
                saveToken(token);
                finishOAuthLogin(ib);
                return true;
              }
              if (parsed.hostname === 'restorebraine.base44.app') {
                token = captureAccessTokenFromUrl(url);
                if (token || readToken()) {
                  finishOAuthLogin(ib);
                  return true;
                }
              }
            } catch (e) {}
            return false;
          }

          function attachOAuthBrowserListeners(ib) {
            if (oauthBrowserListenerAttached) return;
            oauthBrowserListenerAttached = true;
            ib.addListener('browserPageNavigationCompleted', function (data) {
              handleOAuthBrowserUrl(data && data.url, ib);
            });
            ib.addListener('browserClosed', function () {
              if (readToken()) {
                try {
                  window.dispatchEvent(new CustomEvent('restorebraine-session-updated'));
                  window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
                } catch (e) {}
                return;
              }
              captureAccessTokenFromUrl();
              if (readToken()) {
                try {
                  window.dispatchEvent(new CustomEvent('restorebraine-session-updated'));
                  window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
                } catch (e) {}
              }
            });
          }

          function launchOAuthInBrowser(url) {
            try {
              var ib = getInAppBrowserPlugin();
              if (ib) {
                oauthBrowserListenerAttached = false;
                attachOAuthBrowserListeners(ib);
                ib.openInSystemBrowser({ url: url, options: SYSTEM_BROWSER_OPTIONS });
                return true;
              }
            } catch (e) {}
            try {
              var browser = getBrowserPlugin();
              if (browser && browser.open) {
                browser.open({ url: url });
                return true;
              }
            } catch (e) {}
            return false;
          }

          function openLoginInSystemBrowser(url, providerHint) {
            url = normalizeAuthUrl(url || getCanonicalOAuthUrl(providerHint || 'google'), providerHint);
            if (launchOAuthInBrowser(url)) return;
            var attempts = 0;
            var timer = setInterval(function () {
              attempts += 1;
              if (launchOAuthInBrowser(url)) {
                clearInterval(timer);
                return;
              }
              if (attempts >= 80) {
                clearInterval(timer);
                try { window.location.assign(url); } catch (e) {}
              }
            }, 100);
          }

          function installOAuthDeepLinkHandler() {
            try {
              var appPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
              if (!appPlugin || window.__restorebraineOAuthDeepLinkInstalled) return;
              window.__restorebraineOAuthDeepLinkInstalled = true;
              appPlugin.addListener('appUrlOpen', function (data) {
                if (!data || !data.url || data.url.indexOf('access_token=') === -1) return;
                handleOAuthBrowserUrl(data.url, getInAppBrowserPlugin());
              });
            } catch (e) {}
          }

          function postNativeOpenLogin(provider) {
            provider = provider || 'google';
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.restorebraineNativeSession) {
                window.webkit.messageHandlers.restorebraineNativeSession.postMessage({
                  action: 'openLogin',
                  url: getCanonicalOAuthUrl(provider)
                });
                return true;
              }
            } catch (e) {}
            return false;
          }

          function markOpeningOAuth() {
            /* OAuth debug bar disabled — native OAuth unchanged */
          }

          function openProviderOAuth(provider) {
            var p = provider || 'google';
            var url = getCanonicalOAuthUrl(p);
            markOpeningOAuth();
            if (launchOAuthInBrowser(url)) return true;
            if (postNativeOpenLogin(p)) return true;
            openLoginInSystemBrowser(url, p);
            return true;
          }

          window.__restorebraineOpenLoginJsFallback = function () {
            openProviderOAuth('google');
          };

          window.__restorebraineOpenProviderLogin = function (provider) {
            try { localStorage.removeItem(SIGNED_OUT_KEY); } catch (e) {}
            openProviderOAuth(provider || 'google');
          };

          window.__restorebraineOpenLogin = function () {
            try { localStorage.removeItem(SIGNED_OUT_KEY); } catch (e) {}
            openProviderOAuth('google');
          };

          var lastOAuthTapMs = 0;
          function handleOAuthTapFromEvent(event, provider) {
            if (!provider) return;
            var now = Date.now();
            if (now - lastOAuthTapMs < 700) return;
            lastOAuthTapMs = now;
            if (event && event.cancelable) {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
            }
            try { localStorage.removeItem(SIGNED_OUT_KEY); } catch (e) {}
            openProviderOAuth(provider || 'google');
          }

          function resolveOAuthTarget(event) {
            var providerTarget = event.target.closest('[data-rb-provider], [data-provider]');
            if (!providerTarget) return null;
            if (providerTarget.disabled) return null;
            return providerTarget.getAttribute('data-rb-provider')
              || providerTarget.getAttribute('data-provider')
              || null;
          }

          function interceptNativeSignInClicks() {
            if (window.__restorebraineSignInInterceptor) return;
            window.__restorebraineSignInInterceptor = true;
            var onOAuthEvent = function (event) {
              var provider = resolveOAuthTarget(event);
              if (!provider) return;
              handleOAuthTapFromEvent(event, provider);
            };
            document.addEventListener('pointerdown', onOAuthEvent, true);
            document.addEventListener('touchstart', onOAuthEvent, true);
            document.addEventListener('click', onOAuthEvent, true);
          }

          installOAuthDeepLinkHandler();
          interceptNativeSignInClicks();

          function deferOAuthBridge() {
            installOAuthDeepLinkHandler();
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', deferOAuthBridge, { once: true });
          }
        })();
        """#
    }

    private func sessionBridgeScript(for buildLabel: String, syncToken: String, ghostBlock: [String], ghostAllow: [String]) -> String {
        let escapedLabel = buildLabel
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let ghostJs = ghostBlock
            .map { "'\($0.replacingOccurrences(of: "'", with: "\\'"))'" }
            .joined(separator: ", ")
        let allowJs = ghostAllow
            .map { "'\($0.replacingOccurrences(of: "'", with: "\\'"))'" }
            .joined(separator: ", ")

        // restorebraine-session-bridge-raw
        return #"""

        (function () {
          if (window.__restorebraineSessionBridgeInstalled) return;
          window.__restorebraineSessionBridgeInstalled = true;
          (function injectBase44HideStyles() {
            if (document.getElementById('rb-hide-base44-boot')) return;
            var style = document.createElement('style');
            style.id = 'rb-hide-base44-boot';
            style.textContent = '#base44-edit-badge, #base44-modal-overlay { display:none !important; visibility:hidden !important; opacity:0 !important; pointer-events:none !important; }';
            (document.head || document.documentElement).appendChild(style);
          })();

          (function purgeGhostBuildsDeferred() {
            function runPurgeGhostBuilds() {
            // Bundled mode (capacitor://) — never redirect to hosted or block local assets
            if (location.protocol === 'capacitor:') return;
            // Only run ghost purge on live hosted app origin
            if (location.hostname !== 'restorebraine.base44.app') return;

            var STALE_APPS = ['App-B4VcOATW.js', 'App-BMryy2H5.js'];
            var STALE_INDICES = ['index-CLtZjYMv.js', 'index-CJJVGreG.js'];
            var HOST = 'https://restorebraine.base44.app';
            function reloadFresh() {
              var reloadCount = 0;
              try {
                reloadCount = parseInt(sessionStorage.getItem('rb_ghost_reload_count') || '0', 10) || 0;
              } catch (e) {}
              if (reloadCount >= 3) return;
              reloadCount++;
              try { sessionStorage.setItem('rb_ghost_reload_count', String(reloadCount)); } catch (e) {}
              location.replace(HOST + '/?rb_nocache=' + Date.now());
            }
            function hasStaleScriptInDom() {
              for (var a = 0; a < STALE_APPS.length; a++) {
                if (document.querySelector('script[src*="' + STALE_APPS[a] + '"]')) return true;
              }
              for (var t = 0; t < STALE_INDICES.length; t++) {
                if (document.querySelector('script[src*="' + STALE_INDICES[t] + '"]')) return true;
              }
              return false;
            }
            function verifyLiveEntry() {
              fetch(HOST + '/?rb_probe=' + Date.now(), { cache: 'no-store' })
                .then(function(r) { return r.text(); })
                .then(function(html) {
                  var m = html.match(/\/assets\/(index-[^"]+\.js)/);
                  if (!m) return;
                  var liveIndex = m[1];
                  for (var t = 0; t < STALE_INDICES.length; t++) {
                    if (liveIndex.indexOf(STALE_INDICES[t]) >= 0) { reloadFresh(); return; }
                  }
                  var scripts = document.querySelectorAll('script[src*="/assets/index-"]');
                  for (var k = 0; k < scripts.length; k++) {
                    var src = scripts[k].getAttribute('src') || '';
                    if (src.indexOf(liveIndex) < 0) { reloadFresh(); return; }
                  }
                  if (hasStaleScriptInDom()) reloadFresh();
                }).catch(function() {});
            }
            if (hasStaleScriptInDom()) { reloadFresh(); return; }
            verifyLiveEntry();
            }
            if (document.readyState === 'complete') {
              setTimeout(runPurgeGhostBuilds, 1500);
            } else {
              window.addEventListener('load', function () { setTimeout(runPurgeGhostBuilds, 1500); }, { once: true });
            }
          })();

          var RESTOREBRAINE = 'https://restorebraine.base44.app';
          var PLATFORM = 'https://app.base44.com';
          var APP_ID = '68fdc5f42768c4d045fe1bac';
          var FROM_URL = RESTOREBRAINE;
          var APP_LOGIN_URL = RESTOREBRAINE + '/login?from_url=' + encodeURIComponent(FROM_URL) + '&app_id=' + APP_ID + '&prompt=select_account';

          function providerFromPath(pathname) {
            if (/\/apple\//i.test(pathname || '')) return 'apple';
            if (/\/microsoft\//i.test(pathname || '')) return 'microsoft';
            return 'google';
          }

          function providerFromLabel(label) {
            if (/apple/i.test(label || '')) return 'apple';
            if (/microsoft/i.test(label || '')) return 'microsoft';
            return 'google';
          }

          function getCanonicalOAuthUrl(provider) {
            provider = provider || 'google';
            var path = provider === 'google'
              ? '/api/apps/auth/login'
              : '/api/apps/auth/' + provider + '/login';
            return RESTOREBRAINE + path + '?app_id=' + APP_ID + '&from_url=' + encodeURIComponent(FROM_URL) + '&prompt=select_account';
          }

          function normalizeAuthUrl(rawUrl, providerHint) {
            try {
              var parsed = new URL(String(rawUrl || ''), window.location.href);
              if (!isAuthNavigationUrl(rawUrl) && !providerHint) return String(rawUrl);
              var provider = providerHint || providerFromPath(parsed.pathname);
              return getCanonicalOAuthUrl(provider);
            } catch (e) {
              return getCanonicalOAuthUrl(providerHint || 'google');
            }
          }

          function isBase44PlatformHost(hostname) {
            return hostname === 'app.base44.com' || hostname === 'base44.com';
          }

          function isGoogleOAuthUrl(url) {
            if (!url) return false;
            try {
              var href = typeof url === 'string' ? url : (url.href || String(url));
              var parsed = new URL(href, window.location.href);
              var target = parsed.hostname + parsed.pathname + parsed.search;
              return /accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com|\/api\/apps\/auth\/login/i.test(target);
            } catch (e) {
              return /accounts\.google\.com|google\.com\/o\/oauth|\/api\/apps\/auth\/login/i.test(String(url));
            }
          }

          function isAuthNavigationUrl(url) {
            if (!url) return false;
            try {
              var parsed = new URL(String(url), window.location.href);
              if (isGoogleOAuthUrl(url)) return true;
              if (isBase44PlatformHost(parsed.hostname) && parsed.pathname.indexOf('/api/apps/auth') === 0) return true;
              if (parsed.hostname === 'restorebraine.base44.app' && parsed.pathname.indexOf('/api/apps/auth') === 0) return true;
            } catch (e) {}
            return false;
          }

          function isPlatformLoginUrl(url) {
            if (!url) return false;
            try {
              var parsed = new URL(String(url), window.location.href);
              return isBase44PlatformHost(parsed.hostname) && /\/login/i.test(parsed.pathname);
            } catch (e) {}
            return /app\.base44\.com\/login/i.test(String(url));
          }

          var keys = ['base44_access_token', 'token'];
          var SIGNED_OUT_KEY = 'b44_signed_out';

          function isAuthLogoutUrl(url) {
            if (!url) return false;
            try {
              var parsed = new URL(String(url), window.location.href);
              return /\/api\/apps\/auth\/logout/i.test(parsed.pathname);
            } catch (e) {}
            return false;
          }

          function removeNativeSignInOverlay() {
            var existing = document.getElementById('rb-native-signin-root');
            if (existing) existing.remove();
            try { document.body.style.overflow = ''; } catch (e) {}
          }

          function goToRegularLoginPage() {
            removeNativeSignInOverlay();
            window.location.replace(RESTOREBRAINE + '/');
          }

          function guardSignedOutLoginPage() {
            try {
              if (!isSignedOut()) return;
              var path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
              if (path === '/login' || isPlatformLoginUrl(window.location.href)) {
                goToRegularLoginPage();
              }
            } catch (e) {}
          }

          function isSignedOut() {
            try { return localStorage.getItem(SIGNED_OUT_KEY) === '1'; } catch (e) {}
            return false;
          }

          function notifyNativePersistedSessionClear() {
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.restorebraineNativeSession) {
                window.webkit.messageHandlers.restorebraineNativeSession.postMessage({ action: 'clear' });
              }
            } catch (e) {}
          }

          function clearNativeSession() {
            try {
              localStorage.setItem(SIGNED_OUT_KEY, '1');
              localStorage.removeItem('base44_access_token');
              localStorage.removeItem('token');
              localStorage.removeItem('base44_logged_out');
            } catch (e) {}
            notifyNativePersistedSessionClear();
            try {
              var prefs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
              if (prefs) {
                prefs.set({ key: SIGNED_OUT_KEY, value: '1' });
                prefs.remove({ key: 'base44_access_token' });
                prefs.remove({ key: 'token' });
              }
            } catch (e) {}
          }

          function performNativeSignOut() {
            window.__restorebraineSigningOut = true;
            clearNativeSession();
            removeNativeSignInOverlay();
            try {
              window.dispatchEvent(new CustomEvent('restorebraine-signed-out'));
            } catch (e) {}
            var origin = window.location.origin || 'capacitor://localhost';
            window.location.replace(origin + '/');
          }

          function readToken() {
            try {
              for (var i = 0; i < keys.length; i++) {
                var value = localStorage.getItem(keys[i]);
                if (value) return value;
              }
            } catch (e) {}
            return null;
          }

          function clearSignedOutFlag() {
            try {
              localStorage.removeItem(SIGNED_OUT_KEY);
              var prefs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
              if (prefs) prefs.remove({ key: SIGNED_OUT_KEY });
            } catch (e) {}
          }

          function saveToken(token) {
            if (!token) return false;
            try {
              clearSignedOutFlag();
              localStorage.setItem('base44_access_token', token);
              localStorage.setItem('token', token);
              persistToken();
              try {
                window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: token } }));
              } catch (e) {}
              return true;
            } catch (e) {}
            return false;
          }

          function captureAccessTokenFromUrl(url) {
            try {
              var parsed = url ? new URL(url) : window.location;
              var token = parsed.searchParams.get('access_token');
              if (!token) return null;
              saveToken(token);
              if (!url) {
                parsed.searchParams.delete('access_token');
                var clean = parsed.pathname + (parsed.searchParams.toString() ? '?' + parsed.searchParams.toString() : '') + parsed.hash;
                window.history.replaceState({}, document.title, clean);
              }
              return token;
            } catch (e) {}
            return null;
          }

          function persistToken() {
            try {
              if (isSignedOut()) return;
              var token = readToken();
              if (!token || !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Preferences) return;
              window.Capacitor.Plugins.Preferences.set({ key: 'base44_access_token', value: token });
              window.Capacitor.Plugins.Preferences.set({ key: 'token', value: token });
              window.Capacitor.Plugins.Preferences.remove({ key: SIGNED_OUT_KEY });
            } catch (e) {}
          }

          function restoreToken() {
            try {
              if (window.__restorebraineSigningOut || isSignedOut()) return;
              var prefs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
              if (prefs) {
                prefs.get({ key: SIGNED_OUT_KEY }).then(function (flag) {
                  if (flag && flag.value === '1') return;
                  var syncToken = '\#(escapedToken)';
                  if (syncToken) {
                    if (!isSignedOut()) saveToken(syncToken);
                    return;
                  }
                  prefs.get({ key: 'base44_access_token' }).then(function (result) {
                    if (!result || !result.value || isSignedOut()) return;
                    saveToken(result.value);
                  });
                });
                return;
              }
              var syncToken = '\#(escapedToken)';
              if (syncToken && !isSignedOut()) saveToken(syncToken);
            } catch (e) {}
          }

          var oauthBrowserListenerAttached = false;
          function finishOAuthLogin(ib) {
            try { if (ib) ib.close(); } catch (e) {}
            try {
              window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
            } catch (e) {}
            if (readToken()) {
              window.location.replace(RESTOREBRAINE);
              return;
            }
            window.location.replace(RESTOREBRAINE);
          }

          function handleOAuthBrowserUrl(url, ib) {
            if (!url) return false;
            try {
              var parsed = new URL(url);
              var token = parsed.searchParams.get('access_token');
              if (token) {
                saveToken(token);
                finishOAuthLogin(ib);
                return true;
              }
              if (parsed.hostname === 'restorebraine.base44.app') {
                token = captureAccessTokenFromUrl(url);
                if (token || readToken()) {
                  finishOAuthLogin(ib);
                  return true;
                }
              }
              if (isBase44PlatformHost(parsed.hostname) && parsed.pathname.indexOf('/api/apps/auth') !== 0) {
                if (readToken()) {
                  finishOAuthLogin(ib);
                  return true;
                }
              }
            } catch (e) {}
            return false;
          }

          var SYSTEM_BROWSER_OPTIONS = {
            iOS: { closeButtonText: 2, viewStyle: 2, animationEffect: 2, enableBarsCollapsing: true, enableReadersMode: false },
            android: { showTitle: false, hideToolbarOnScroll: false, viewStyle: 0, startAnimation: 0, exitAnimation: 1 }
          };
          var WEBVIEW_OPTIONS = {
            showURL: true,
            showToolbar: true,
            clearCache: false,
            clearSessionCache: false,
            mediaPlaybackRequiresUserAction: false,
            closeButtonText: 'Done',
            toolbarPosition: 0,
            showNavigationButtons: true,
            leftToRight: false,
            customWebViewUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            iOS: { allowOverScroll: true, enableViewportScale: false, allowInLineMediaPlayback: false, surpressIncrementalRendering: false, viewStyle: 2, animationEffect: 2, allowsBackForwardNavigationGestures: true },
            android: { allowZoom: false, hardwareBack: true, pauseMedia: true }
          };

          function getInAppBrowserPlugin() {
            return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser;
          }

          function getBrowserPlugin() {
            return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
          }

          function attachOAuthBrowserListeners(ib) {
            if (oauthBrowserListenerAttached) return;
            oauthBrowserListenerAttached = true;
            ib.addListener('browserPageNavigationCompleted', function (data) {
              handleOAuthBrowserUrl(data && data.url, ib);
            });
            ib.addListener('browserClosed', function () {
              if (readToken()) {
                window.location.replace(RESTOREBRAINE);
                return;
              }
              captureAccessTokenFromUrl();
              if (readToken()) {
                window.location.replace(RESTOREBRAINE);
                return;
              }
              window.location.replace(RESTOREBRAINE);
            });
            ib.addListener('browserPageLoaded', function () {
              if (readToken()) finishOAuthLogin(ib);
            });
          }

          function launchOAuthInBrowser(url) {
            try {
              var ib = getInAppBrowserPlugin();
              if (ib) {
                oauthBrowserListenerAttached = false;
                attachOAuthBrowserListeners(ib);
                ib.openInSystemBrowser({ url: url, options: SYSTEM_BROWSER_OPTIONS });
                return true;
              }
            } catch (e) {}
            try {
              var browser = getBrowserPlugin();
              if (browser && browser.open) {
                browser.open({ url: url });
                return true;
              }
            } catch (e) {}
            return false;
          }

          function openLoginInSystemBrowser(url, providerHint) {
            url = normalizeAuthUrl(url || getCanonicalOAuthUrl(providerHint || 'google'), providerHint);
            if (launchOAuthInBrowser(url)) return;
            var attempts = 0;
            var timer = setInterval(function () {
              attempts += 1;
              if (launchOAuthInBrowser(url)) {
                clearInterval(timer);
                return;
              }
              if (attempts >= 80) {
                clearInterval(timer);
                try { window.location.assign(url); } catch (e) {}
              }
            }, 100);
          }

          function installOAuthDeepLinkHandler() {
            try {
              var appPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
              if (!appPlugin || window.__restorebraineOAuthDeepLinkInstalled) return;
              window.__restorebraineOAuthDeepLinkInstalled = true;
              appPlugin.addListener('appUrlOpen', function (data) {
                if (!data || !data.url || data.url.indexOf('access_token=') === -1) return;
                handleOAuthBrowserUrl(data.url, getInAppBrowserPlugin());
              });
            } catch (e) {}
          }

          function installLocationNavigationGuard() {
            if (window.__restorebraineLocationGuardInstalled) return;
            window.__restorebraineLocationGuardInstalled = true;
            ['assign', 'replace'].forEach(function (method) {
              var original = Location.prototype[method];
              Location.prototype[method] = function (targetUrl) {
                try {
                  var parsed = new URL(String(targetUrl), window.location.href);
                  if (captureAccessTokenFromUrl(parsed.href)) {
                    window.location.replace(RESTOREBRAINE);
                    return;
                  }
                  if (isAuthLogoutUrl(targetUrl)) {
                    clearNativeSession();
                    removeNativeSignInOverlay();
                    return;
                  }
                  if (isPlatformLoginUrl(targetUrl)) {
                    window.location.replace(RESTOREBRAINE);
                    return;
                  }
                  if (isAuthNavigationUrl(targetUrl)) {
                    openLoginInSystemBrowser(targetUrl);
                    return;
                  }
                  if (isBase44PlatformHost(parsed.hostname)) {
                    window.location.replace(RESTOREBRAINE);
                    return;
                  }
                } catch (e) {
                  if (isAuthNavigationUrl(targetUrl)) {
                    openLoginInSystemBrowser(targetUrl);
                    return;
                  }
                }
                return original.call(this, targetUrl);
              };
            });
            try {
              var hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
                || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.location), 'href');
              if (hrefDescriptor && hrefDescriptor.set) {
                Object.defineProperty(window.location, 'href', {
                  configurable: true,
                  enumerable: hrefDescriptor.enumerable,
                  get: hrefDescriptor.get ? hrefDescriptor.get.bind(window.location) : undefined,
                  set: function (value) {
                    try {
                      var parsed = new URL(String(value), window.location.href);
                      if (captureAccessTokenFromUrl(parsed.href)) {
                        window.location.replace(RESTOREBRAINE);
                        return;
                      }
                      if (isAuthLogoutUrl(value)) {
                        clearNativeSession();
                        removeNativeSignInOverlay();
                        return;
                      }
                      if (isPlatformLoginUrl(value)) {
                        window.location.replace(RESTOREBRAINE);
                        return;
                      }
                      if (isAuthNavigationUrl(value)) {
                        openLoginInSystemBrowser(value);
                        return;
                      }
                      if (isBase44PlatformHost(parsed.hostname)) {
                        window.location.replace(RESTOREBRAINE);
                        return;
                      }
                    } catch (e) {
                      if (isAuthNavigationUrl(value)) {
                        openLoginInSystemBrowser(value);
                        return;
                      }
                    }
                    hrefDescriptor.set.call(window.location, value);
                  }
                });
              }
            } catch (e) {}
          }

          if (!window.__restorebraineOAuthFixInstalled) {
            window.__restorebraineOAuthFixInstalled = true;
            var originalOpen = window.open;
            window.open = function (url, target, features) {
              if (typeof url === 'string' && url.length > 0) {
                if (isPlatformLoginUrl(url) || isAuthNavigationUrl(url)) {
                  openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
                  return window;
                }
                try {
                  var parsed = new URL(url, window.location.href);
                  if (isBase44PlatformHost(parsed.hostname)) {
                    window.location.replace(RESTOREBRAINE);
                    return window;
                  }
                } catch (e) {}
                window.location.assign(url);
                return window;
              }
              return originalOpen ? originalOpen.call(window, url, target, features) : null;
            };
          }

          function guardPlatformNavigation() {
            try {
              if (captureAccessTokenFromUrl()) return;
              if (!isBase44PlatformHost(window.location.hostname)) return;
              if (window.location.pathname.indexOf('/api/apps/auth') === 0) return;
              window.location.replace(RESTOREBRAINE);
            } catch (e) {}
          }

          function guardGoogleOAuthInWebView() {
            try {
              if (window.location.hostname !== 'accounts.google.com') return;
              if (window.history.length > 1) window.history.back();
              else window.location.replace(RESTOREBRAINE);
              openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
            } catch (e) {}
          }

          function blockBase44BadgeScript() {
            try {
              document.querySelectorAll('script[src*="badge.js"]').forEach(function (node) { node.remove(); });
            } catch (e) {}
          }


          var APP_LOGO_URL = 'https://media.base44.com/images/public/68fdc5f42768c4d045fe1bac/e76571efc_appstore.png';

          function isRestorebraineBrandingContext() {
            if (/restorebraine/i.test(window.location.hostname)) return true;
            try {
              var params = new URLSearchParams(window.location.search);
              var fromUrl = params.get('from_url') || '';
              if (/restorebraine/i.test(fromUrl)) return true;
            } catch (e) {}
            return false;
          }

          function replaceLoginLogoContainer(container) {
            if (!container || container.querySelector('img[data-rb-logo="1"]')) return;
            container.innerHTML = '<img data-rb-logo="1" src="' + APP_LOGO_URL + '" alt="Restorebraine" style="width:64px;height:64px;border-radius:16px;object-fit:cover;display:block;margin:0 auto;" />';
            try {
              container.style.background = 'transparent';
              container.style.backgroundImage = 'none';
              container.style.boxShadow = 'none';
            } catch (e) {}
          }

          function findRestorebraineTitle() {
            var nodes = document.querySelectorAll('h1, h2, [role="heading"]');
            for (var i = 0; i < nodes.length; i++) {
              var text = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
              if (/^restorebraine$/i.test(text)) return nodes[i];
            }
            return null;
          }

          function fixLoginLogoNearTitle(title) {
            if (!title) return;
            var logoBox = title.previousElementSibling;
            if (logoBox) replaceLoginLogoContainer(logoBox);
            var parent = title.parentElement;
            if (!parent) return;
            if (parent.firstElementChild && parent.firstElementChild !== title) {
              var first = parent.firstElementChild;
              if (first.querySelector && (first.querySelector('svg') || first.tagName === 'SVG')) {
                replaceLoginLogoContainer(first);
              }
            }
            var card = title.closest('div');
            if (!card) return;
            card.querySelectorAll('svg').forEach(function (svg) {
              if (svg.closest('img[data-rb-logo="1"]')) return;
              var box = svg.closest('div');
              if (!box || box === card) return;
              if (box.contains(title)) return;
              if (title.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_PRECEDING) {
                replaceLoginLogoContainer(box);
              }
            });
          }

          function fixLoginPageByWelcomeTagline() {
            var subtitle = null;
            document.querySelectorAll('p, span, h1, h2, div').forEach(function (node) {
              if (subtitle) return;
              var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
              if (/sign in to continue/i.test(text) && text.length < 80) subtitle = node;
            });
            if (!subtitle) return;
            var card = subtitle.closest('div');
            if (!card) return;
            card.querySelectorAll('div').forEach(function (div) {
              if (div.querySelector('img[data-rb-logo="1"]')) return;
              if (!div.querySelector('svg') && !div.querySelector('img')) return;
              if (div.querySelector('button, form, input, textarea')) return;
              var rect = div.getBoundingClientRect();
              if (rect.width < 40 || rect.width > 120 || rect.height < 40 || rect.height > 120) return;
              if (subtitle.compareDocumentPosition(div) & Node.DOCUMENT_POSITION_PRECEDING) {
                replaceLoginLogoContainer(div);
              }
            });
          }

          function fixLoginPageByTagline() {
            var subtitle = null;
            document.querySelectorAll('p, span, h1, h2, div').forEach(function (node) {
              if (subtitle) return;
              var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
              if (/sign in to access your memories/i.test(text) && text.length < 80) subtitle = node;
            });
            if (!subtitle) return;
            var card = subtitle.closest('div');
            if (!card) return;
            card.querySelectorAll('div').forEach(function (div) {
              if (div.querySelector('img[data-rb-logo="1"]')) return;
              if (!div.querySelector('svg')) return;
              if (div.querySelector('button, form, input, textarea')) return;
              var rect = div.getBoundingClientRect();
              if (rect.width < 48 || rect.width > 100 || rect.height < 48 || rect.height > 100) return;
              if (subtitle.compareDocumentPosition(div) & Node.DOCUMENT_POSITION_PRECEDING) {
                replaceLoginLogoContainer(div);
              }
            });
            var titleNode = findRestorebraineTitle();
            if (titleNode) fixLoginLogoNearTitle(titleNode);
          }

          function hideNativeBuildStamp() {
            try {
              document.querySelectorAll('p, span, div, footer, small, label').forEach(function (node) {
                if (node.id === 'rb-native-stamp' || node.id === 'rb-load-proof') return;
                var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (/^kbrown native v\d+/i.test(text) || /^restorebraine web v\d+/i.test(text)) {
                  node.remove();
                }
              });
            } catch (e) {}
          }

          function showLoadProof() {
            try {
              var el = document.getElementById('rb-load-proof');
              if (!el) {
                el = document.createElement('div');
                el.id = 'rb-load-proof';
                el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;font:10px/1.3 ui-monospace,monospace;background:rgba(0,0,0,0.82);color:#4ade80;padding:5px 8px;text-align:center;pointer-events:none;';
                (document.body || document.documentElement).appendChild(el);
              }
              var mode = location.protocol === 'capacitor:' ? 'BUNDLED' : (location.hostname === 'restorebraine.base44.app' ? 'HOSTED' : location.hostname);
              var script = document.querySelector('script[src*="index-"]');
              var bundle = script ? ((script.getAttribute('src') || '').split('/').pop() || '?') : '?';
              el.textContent = mode + ' · ' + '\#(escapedLabel)' + ' · ' + bundle;
            } catch (e) {}
          }

          function fixRestorebraineBranding() {
            try {
              hideNativeBuildStamp();
              showLoadProof();
              var stamp = document.getElementById('rb-native-stamp');
              if (stamp) stamp.remove();
              document.querySelectorAll('[id*="native-stamp"], [class*="native-stamp"]').forEach(function (n) { n.remove(); });

              if (!isRestorebraineBrandingContext()) return;

              try {
                var favicon = document.querySelector('link[rel="icon"], link[rel="apple-touch-icon"]');
                if (favicon && favicon.href !== APP_LOGO_URL) favicon.href = APP_LOGO_URL;
              } catch (e) {}

              document.querySelectorAll('img').forEach(function (img) {
                if (img.getAttribute('data-rb-logo') === '1') return;
                var src = img.getAttribute('src') || '';
                var alt = img.getAttribute('alt') || '';
                if (src.indexOf('base44.com/logo') >= 0 || /base44/i.test(alt)) {
                  img.src = APP_LOGO_URL;
                  img.alt = 'Restorebraine';
                  img.setAttribute('data-rb-logo', '1');
                }
              });

              fixLoginPageByTagline();
              fixLoginPageByWelcomeTagline();
              var title = findRestorebraineTitle();
              fixLoginLogoNearTitle(title);

              if (/\/login/i.test(window.location.pathname)) {
                document.querySelectorAll('div').forEach(function (div) {
                  if (div.querySelector('img[data-rb-logo="1"]')) return;
                  if (!div.querySelector('svg')) return;
                  if (div.querySelector('button, form, input, textarea')) return;
                  var rect = div.getBoundingClientRect();
                  if (rect.width < 40 || rect.width > 120 || rect.height < 40 || rect.height > 120) return;
                  if (title && div.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    replaceLoginLogoContainer(div);
                  }
                });
              }
            } catch (e) {}
          }

          function fixFolderActionButtons() {
            // Disabled — injected !important CSS was overriding Base44 Publish updates (no-change trap).
            // Gallery folder button styles live in src/components/gallery/folderActionStyles.js + Base44.
          }

          function hideBase44EditorWidget() {
            try {
              blockBase44BadgeScript();
              if (!document.getElementById('rb-hide-base44')) {
                var style = document.createElement('style');
                style.id = 'rb-hide-base44';
                style.textContent = '#base44-edit-badge, #base44-modal-overlay, [id*="base44-edit"], [id*="base44-modal"], [href*="app.base44.com"], iframe[src*="base44"], script[src*="badge.js"] { display:none !important; visibility:hidden !important; opacity:0 !important; pointer-events:none !important; max-height:0 !important; overflow:hidden !important; }';
                (document.head || document.documentElement).appendChild(style);
              }
              document.querySelectorAll('button, a, div, span, iframe, p').forEach(function (node) {
                if (node.id === 'rb-native-stamp') return;
                var text = (node.textContent || '').trim();
                if (/edit with base\s*44/i.test(text) && text.length < 60) {
                  var el = node;
                  for (var i = 0; i < 8 && el && el !== document.body; i++) {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                    el = el.parentElement;
                  }
                }
              });
            } catch (e) {}
          }



          function postNativeOpenLogin() {
            try {
              var el = document.getElementById('rb-load-proof');
              if (el) el.textContent = (el.textContent || '') + ' · opening OAuth…';
            } catch (e) {}
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.restorebraineNativeSession) {
                window.webkit.messageHandlers.restorebraineNativeSession.postMessage({
                  action: 'openLogin',
                  url: getCanonicalOAuthUrl('google')
                });
                return true;
              }
            } catch (e) {}
            return false;
          }

          window.__restorebraineOpenLoginJsFallback = function () {
            openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
          };

          window.__restorebraineOpenLogin = function () {
            try { localStorage.removeItem(SIGNED_OUT_KEY); } catch (e) {}
            if (postNativeOpenLogin()) return;
            window.__restorebraineOpenLoginJsFallback();
          };

          function interceptNativeSignInClicks() {
            if (window.__restorebraineSignInInterceptor) return;
            if (typeof resolveOAuthTarget !== 'function' || typeof handleOAuthTapFromEvent !== 'function') return;
            window.__restorebraineSignInInterceptor = true;
            var onOAuthEvent = function (event) {
              var provider = resolveOAuthTarget(event);
              if (!provider) return;
              handleOAuthTapFromEvent(event, provider);
            };
            document.addEventListener('pointerdown', onOAuthEvent, true);
            document.addEventListener('touchstart', onOAuthEvent, true);
            document.addEventListener('click', onOAuthEvent, true);
          }

          if (!window.__rbBadgeObserver) {
            window.__rbBadgeObserver = new MutationObserver(function () { blockBase44BadgeScript(); hideBase44EditorWidget(); hideNativeBuildStamp(); fixRestorebraineBranding(); showLoadProof(); });
            window.__rbBadgeObserver.observe(document.documentElement, { childList: true, subtree: true });
          }

          function installPlatformGuard() {
            installLocationNavigationGuard();
            guardPlatformNavigation();
            guardSignedOutLoginPage();
            guardGoogleOAuthInWebView();
            hideBase44EditorWidget();
            fixRestorebraineBranding();
            interceptNativeSignInClicks();
            window.addEventListener('popstate', function () {
              guardPlatformNavigation();
              guardGoogleOAuthInWebView();
            });
            setInterval(function () {
              guardPlatformNavigation();
              guardGoogleOAuthInWebView();
              hideBase44EditorWidget();
              hideNativeBuildStamp();
              fixRestorebraineBranding();
              guardSignedOutLoginPage();
              showLoadProof();
            }, 5000);
          }

          window.__restorebraineClearSession = clearNativeSession;
          window.__restorebrainePerformSignOut = performNativeSignOut;
          window.__RESTOREBRAINE_NATIVE_BUILD__ = '\#(escapedLabel)';
          restoreToken();
          captureAccessTokenFromUrl();
          installOAuthDeepLinkHandler();
          fixRestorebraineBranding();
          showLoadProof();
          setTimeout(function () {
            if (readToken() && !isSignedOut()) {
              try { window.dispatchEvent(new CustomEvent('restorebraine-session-updated')); } catch (e) {}
            }
          }, 800);
          function deferPlatformGuard() {
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', installPlatformGuard, { once: true });
            } else {
              setTimeout(installPlatformGuard, 0);
            }
          }
          deferPlatformGuard();
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') persistToken();
          });
          window.addEventListener('pagehide', persistToken);
          setInterval(persistToken, 15000);

        })();

        """#
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        sessionMessageHandler = RestorebraineSessionMessageHandler()
        sessionMessageHandler.appDelegate = self
        purgeGhostBuildCacheIfNeeded()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(installSessionBridge),
            name: Notification.Name("CAPBridgeDidLoad"),
            object: nil
        )
        DispatchQueue.main.async {
            self.installSessionBridge()
        }
        return true
    }

    @objc private func installSessionBridge() {
        guard !sessionBridgeScriptInstalled else { return }
        guard let bridge = window?.rootViewController as? CAPBridgeViewController else { return }
        let userContentController = bridge.webView?.configuration.userContentController
        guard let userContentController = userContentController else { return }

        sessionBridgeScriptInstalled = true

        userContentController.removeScriptMessageHandler(forName: "restorebraineNativeSession")
        userContentController.add(sessionMessageHandler, name: "restorebraineNativeSession")

        let bundled = isBundledCapacitorMode()
        if bundled {
            let syncToken = storedNativeToken() ?? ""
            let minimal = bundledMinimalBridgeScript(
                for: nativeBuildLabel,
                syncToken: syncToken
            )
            userContentController.addUserScript(WKUserScript(
                source: minimal,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
            userContentController.addUserScript(WKUserScript(
                source: bundledOAuthBridgeScript(for: syncToken),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
            return
        }

        let lists = loadGhostBuildLists()
        let script = WKUserScript(
            source: sessionBridgeScript(
                for: nativeBuildLabel,
                syncToken: storedNativeToken() ?? "",
                ghostBlock: lists.block,
                ghostAllow: lists.allow
            ),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(script)
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        let hadToken = url.absoluteString.contains("access_token=")
        persistOAuthTokenFromURL(url)
        if hadToken && storedNativeToken() != nil {
            notifyWebViewOAuthComplete()
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            let hadToken = url.absoluteString.contains("access_token=")
            persistOAuthTokenFromURL(url)
            if hadToken && storedNativeToken() != nil {
                notifyWebViewOAuthComplete()
            }
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
