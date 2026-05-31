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
          window.__RESTOREBRAINE_NATIVE_BUILD__ = '\(escapedLabel)';

          if (!window.__restorebraineOAuthFixInstalled) {
            window.__restorebraineOAuthFixInstalled = true;
            var originalOpen = window.open;
            window.open = function (url, target, features) {
              if (typeof url === 'string' && url.length > 0) {
                if (/accounts\.google\.com|google\.com\/o\/oauth/i.test(url)) {
                  openLoginInSystemBrowser(APP_LOGIN_URL);
                  return window;
                }
                window.location.assign(url);
                return window;
              }
              return originalOpen ? originalOpen.call(window, url, target, features) : null;
            };
          }

          function captureAccessTokenFromUrl() {
            try {
              var params = new URLSearchParams(window.location.search);
              var token = params.get('access_token');
              if (!token) return null;
              localStorage.setItem('base44_access_token', token);
              localStorage.setItem('token', token);
              params.delete('access_token');
              var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
              window.history.replaceState({}, document.title, clean);
              return token;
            } catch (e) {}
            return null;
          }

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
                localStorage.setItem('base44_access_token', syncToken);
                localStorage.setItem('token', syncToken);
                return;
              }
              if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Preferences) return;
              window.Capacitor.Plugins.Preferences.get({ key: 'base44_access_token' }).then(function (result) {
                if (!result || !result.value) return;
                localStorage.setItem('base44_access_token', result.value);
                localStorage.setItem('token', result.value);
              });
            } catch (e) {}
          }

          restoreToken();
          captureAccessTokenFromUrl();

          var APP_LOGIN_URL = 'https://app.base44.com/login?from_url=' + encodeURIComponent('https://restorebraine.base44.app') + '&app_id=68fdc5f42768c4d045fe1bac&prompt=select_account';


          var oauthBrowserListenerAttached = false;
          function openLoginInSystemBrowser(url) {
            url = url || APP_LOGIN_URL;
            try {
              var ib = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser;
              if (!ib) {
                window.location.replace(url);
                return;
              }
              if (!oauthBrowserListenerAttached) {
                oauthBrowserListenerAttached = true;
                ib.addListener('browserPageNavigationCompleted', function (data) {
                  if (!data || !data.url) return;
                  try {
                    var parsed = new URL(data.url);
                    if (parsed.hostname !== 'restorebraine.base44.app') return;
                    var token = parsed.searchParams.get('access_token');
                    if (!token) return;
                    localStorage.setItem('base44_access_token', token);
                    localStorage.setItem('token', token);
                    persistToken();
                    ib.close();
                    window.location.replace('https://restorebraine.base44.app');
                  } catch (e) {}
                });
                ib.addListener('browserClosed', function () {
                  window.location.replace('https://restorebraine.base44.app');
                });
              }
              ib.openInSystemBrowser({ url: url });
            } catch (e) {
              window.location.replace(url);
            }
          }

          function guardGoogleOAuthInWebView() {
            try {
              if (window.location.hostname !== 'accounts.google.com') return;
              if (window.history.length > 1) window.history.back();
              else window.location.replace('https://restorebraine.base44.app');
              openLoginInSystemBrowser(APP_LOGIN_URL);
            } catch (e) {}
          }

          function guardPlatformNavigation() {
            try {
              if (window.location.hostname !== 'app.base44.com') return;
              var path = window.location.pathname || '';
              if (path.indexOf('/login') === 0 || path.indexOf('/api/apps/auth') === 0) return;
              if (new URLSearchParams(window.location.search).has('access_token')) return;
              openLoginInSystemBrowser(APP_LOGIN_URL);
            } catch (e) {}
          }

          function hideBase44EditorWidget() {
            try {
              document.querySelectorAll('button, a, div, span').forEach(function (node) {
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
              var target = event.target.closest('button, a, [role="button"]');
              if (!target) return;
              var label = (target.textContent || '').trim();
              if (!/continue with google|continue with apple|continue with microsoft|sign in with email|^sign in$/i.test(label)) return;
              event.preventDefault();
              event.stopPropagation();
              openLoginInSystemBrowser(APP_LOGIN_URL);
            }, true);
          }

          function installPlatformGuard() {
            guardPlatformNavigation();
            hideBase44EditorWidget();
            interceptNativeSignInClicks();
            guardGoogleOAuthInWebView();
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

          installPlatformGuard();
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') persistToken();
          });
          window.addEventListener('pagehide', persistToken);
          setInterval(persistToken, 15000);
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
