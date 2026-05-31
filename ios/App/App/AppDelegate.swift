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
          var APP_ID = '68fdc5f42768c4d045fe1bac';
          var APP_LOGIN_URL = RESTOREBRAINE + '/login?from_url=' + encodeURIComponent(RESTOREBRAINE) + '&app_id=' + APP_ID + '&prompt=select_account';
          var GOOGLE_OAUTH_URL = RESTOREBRAINE + '/api/apps/auth/login?app_id=' + APP_ID + '&from_url=' + encodeURIComponent(RESTOREBRAINE);

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

          function attachOAuthBrowserListeners(ib) {
            if (oauthBrowserListenerAttached) return;
            oauthBrowserListenerAttached = true;
            ib.addListener('browserPageNavigationCompleted', function (data) {
              handleOAuthBrowserUrl(data && data.url, ib);
            });
            ib.addListener('browserClosed', function () {
              if (readToken()) window.location.replace(RESTOREBRAINE);
            });
          }

          function openLoginInSystemBrowser(url) {
            url = url || GOOGLE_OAUTH_URL;
            function launchSystemBrowser() {
              try {
                var ib = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser;
                if (!ib) return false;
                oauthBrowserListenerAttached = false;
                attachOAuthBrowserListeners(ib);
                ib.openInSystemBrowser({ url: url });
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
                  if (isBase44PlatformHost(parsed.hostname)) {
                    window.location.replace(RESTOREBRAINE);
                    return;
                  }
                } catch (e) {}
                if (isAuthNavigationUrl(targetUrl)) {
                  openLoginInSystemBrowser(GOOGLE_OAUTH_URL);
                  return;
                }
                return original.call(this, targetUrl);
              };
            });
          }

          if (!window.__restorebraineOAuthFixInstalled) {
            window.__restorebraineOAuthFixInstalled = true;
            var originalOpen = window.open;
            window.open = function (url, target, features) {
              if (typeof url === 'string' && url.length > 0) {
                if (isAuthNavigationUrl(url)) {
                  openLoginInSystemBrowser(GOOGLE_OAUTH_URL);
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
              window.location.replace(RESTOREBRAINE);
            } catch (e) {}
          }

          function guardGoogleOAuthInWebView() {
            try {
              if (window.location.hostname !== 'accounts.google.com') return;
              if (window.history.length > 1) window.history.back();
              else window.location.replace(RESTOREBRAINE);
              openLoginInSystemBrowser(GOOGLE_OAUTH_URL);
            } catch (e) {}
          }

          function hideBase44EditorWidget() {
            try {
              document.querySelectorAll('button, a, div, span, iframe').forEach(function (node) {
                var text = (node.textContent || '').trim();
                if (/edit with base\\s*44/i.test(text) && text.length < 40) {
                  var container = node.closest('div');
                  if (container) container.style.setProperty('display', 'none', 'important');
                }
              });
            } catch (e) {}
          }

          function interceptNativeSignInClicks() {
            if (window.__restorebraineSignInInterceptor) return;
            window.__restorebraineSignInInterceptor = true;
            document.addEventListener('click', function (event) {
              var target = event.target.closest('button, a, [role="button"], div[data-provider], [data-testid*="google"], .google-signin-button');
              if (!target) return;
              var label = (target.textContent || '').trim();
              var href = target.href || target.getAttribute && target.getAttribute('href') || '';
              var isGoogle = /google/i.test(label) || /google/i.test(href) || /auth\\/login/i.test(href) || target.closest('[class*="google"], [id*="google"]');
              var isSignIn = /continue with|sign in with|sign in|^log in$/i.test(label) || /auth\\/login/i.test(href);
              if (!isGoogle && !isSignIn) return;
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              openLoginInSystemBrowser(isGoogle ? GOOGLE_OAUTH_URL : APP_LOGIN_URL);
            }, true);
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
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
