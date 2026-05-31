import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

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
    }

    private func storedNativeToken() -> String? {
        let defaults = UserDefaults.standard
        return defaults.string(forKey: "CapacitorStorage.base44_access_token")
            ?? defaults.string(forKey: "CapacitorStorage.token")
    }

    private func sessionBridgeScript(for buildLabel: String, syncToken: String) -> String {
        let escapedLabel = buildLabel
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        return """

        (function () {
          if (window.__restorebraineSessionBridgeInstalled) return;
          window.__restorebraineSessionBridgeInstalled = true;

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
            return PLATFORM + path + '?app_id=' + APP_ID + '&from_url=' + encodeURIComponent(FROM_URL);
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
              return /accounts\\.google\\.com|google\\.com\\/o\\/oauth|oauth2\\.googleapis\\.com|\\/api\\/apps\\/auth\\/login/i.test(target);
            } catch (e) {
              return /accounts\\.google\\.com|google\\.com\\/o\\/oauth|\\/api\\/apps\\/auth\\/login/i.test(String(url));
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

          var keys = ['base44_access_token', 'token'];
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
              localStorage.setItem('base44_access_token', token);
              localStorage.setItem('token', token);
              persistToken();
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
              var token = readToken();
              if (!token || !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Preferences) return;
              window.Capacitor.Plugins.Preferences.set({ key: 'base44_access_token', value: token });
              window.Capacitor.Plugins.Preferences.set({ key: 'token', value: token });
            } catch (e) {}
          }

          function restoreToken() {
            try {
              var syncToken = '\(escapedToken)';
              if (syncToken) {
                saveToken(syncToken);
                return;
              }
              if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Preferences) return;
              window.Capacitor.Plugins.Preferences.get({ key: 'base44_access_token' }).then(function (result) {
                if (!result || !result.value) return;
                saveToken(result.value);
              });
            } catch (e) {}
          }

          var oauthBrowserListenerAttached = false;
          function finishOAuthLogin(ib) {
            try { if (ib) ib.close(); } catch (e) {}
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

          function openLoginInSystemBrowser(url, providerHint) {
            url = normalizeAuthUrl(url || getCanonicalOAuthUrl(providerHint || 'google'), providerHint);
            function launchSystemBrowser() {
              try {
                var ib = getInAppBrowserPlugin();
                if (!ib) return false;
                oauthBrowserListenerAttached = false;
                attachOAuthBrowserListeners(ib);
                ib.openInSystemBrowser({ url: url, options: SYSTEM_BROWSER_OPTIONS });
                return true;
              } catch (e) {
                return false;
              }
            }
            if (launchSystemBrowser()) return;
            var attempts = 0;
            var timer = setInterval(function () {
              attempts += 1;
              if (launchSystemBrowser() || attempts >= 60) clearInterval(timer);
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
                if (isAuthNavigationUrl(url)) {
                  openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
                  return window;
                }
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

          function hideBase44EditorWidget() {
            try {
              blockBase44BadgeScript();
              if (!document.getElementById('rb-hide-base44')) {
                var style = document.createElement('style');
                style.id = 'rb-hide-base44';
                style.textContent = '[href*="app.base44.com"], iframe[src*="base44"], script[src*="badge.js"] { display:none !important; visibility:hidden !important; pointer-events:none !important; }';
                (document.head || document.documentElement).appendChild(style);
              }
              document.querySelectorAll('button, a, div, span, iframe, p').forEach(function (node) {
                if (node.id === 'rb-native-stamp') return;
                var text = (node.textContent || '').trim();
                if (/edit with base\\s*44/i.test(text) && text.length < 60) {
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

          function interceptNativeSignInClicks() {
            if (window.__restorebraineSignInInterceptor) return;
            window.__restorebraineSignInInterceptor = true;
            document.addEventListener('click', function (event) {
              var target = event.target.closest('button, a, [role="button"], div[role="button"], [data-provider]');
              if (!target) return;
              var label = (target.textContent || '').trim();
              var href = (target.href || (target.getAttribute && target.getAttribute('href')) || '');
              var isProvider = /continue with google|continue with apple|continue with microsoft|sign in with email|sign in with google|sign in with apple|sign in with microsoft/i.test(label);
              var isAuthLink = /auth\/login|auth\/apple|auth\/microsoft/i.test(href);
              if (!isProvider && !isAuthLink) return;
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              var provider = providerFromLabel(label);
              var authUrl = href && isAuthNavigationUrl(href) ? href : getCanonicalOAuthUrl(provider);
              openLoginInSystemBrowser(authUrl, provider);
            }, true);
          }

          if (!window.__rbBadgeObserver) {
            window.__rbBadgeObserver = new MutationObserver(function () { blockBase44BadgeScript(); hideBase44EditorWidget(); });
            window.__rbBadgeObserver.observe(document.documentElement, { childList: true, subtree: true });
          }

          function installPlatformGuard() {
            installLocationNavigationGuard();
            guardPlatformNavigation();
            guardGoogleOAuthInWebView();
            hideBase44EditorWidget();
            interceptNativeSignInClicks();
            window.addEventListener('popstate', function () {
              guardPlatformNavigation();
              guardGoogleOAuthInWebView();
            });
            setInterval(function () {
              guardPlatformNavigation();
              guardGoogleOAuthInWebView();
              hideBase44EditorWidget();
            }, 1000);
          }

          window.__RESTOREBRAINE_NATIVE_BUILD__ = '\(escapedLabel)';
          restoreToken();
          captureAccessTokenFromUrl();
          installOAuthDeepLinkHandler();
          installPlatformGuard();
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') persistToken();
          });
          window.addEventListener('pagehide', persistToken);
          setInterval(persistToken, 15000);

          function showNativeBuildBadge() {
            try {
              if (!document.body || document.getElementById('rb-native-stamp')) return;
              var badge = document.createElement('div');
              badge.id = 'rb-native-stamp';
              badge.textContent = '\(escapedLabel)';
              badge.setAttribute('style', 'position:fixed;bottom:6px;left:6px;z-index:2147483647;font:10px/1.2 -apple-system,sans-serif;color:#666;background:rgba(255,255,255,0.9);padding:2px 6px;border-radius:6px;pointer-events:none;');
              document.body.appendChild(badge);
            } catch (e) {}
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showNativeBuildBadge);
          } else {
            showNativeBuildBadge();
          }
        })();

        """
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(installSessionBridge),
            name: Notification.Name("CAPBridgeDidLoad"),
            object: nil
        )
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.installSessionBridge()
        }
        return true
    }

    @objc private func installSessionBridge() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController else { return }
        let userContentController = bridge.webView?.configuration.userContentController
        guard let userContentController = userContentController else { return }

        let script = WKUserScript(
            source: sessionBridgeScript(for: nativeBuildLabel, syncToken: storedNativeToken() ?? ""),
            injectionTime: .atDocumentStart,
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
        persistOAuthTokenFromURL(url)
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            persistOAuthTokenFromURL(url)
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
