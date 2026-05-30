import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private let sessionBridgeScript = """
    (function () {
      if (window.__restorebraineSessionBridgeInstalled) return;
      window.__restorebraineSessionBridgeInstalled = true;

      if (!window.__restorebraineOAuthFixInstalled) {
        window.__restorebraineOAuthFixInstalled = true;
        var originalOpen = window.open;
        window.open = function (url, target, features) {
          if (typeof url === 'string' && url.length > 0) {
            window.location.assign(url);
            return window;
          }
          return originalOpen ? originalOpen.call(window, url, target, features) : null;
        };
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
          if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Preferences) return;
          window.Capacitor.Plugins.Preferences.get({ key: 'base44_access_token' }).then(function (result) {
            if (!result || !result.value) return;
            localStorage.setItem('base44_access_token', result.value);
            localStorage.setItem('token', result.value);
          });
        } catch (e) {}
      }
      restoreToken();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') persistToken();
      });
      window.addEventListener('pagehide', persistToken);
      setInterval(persistToken, 15000);
    })();
    """

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
            source: sessionBridgeScript,
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
