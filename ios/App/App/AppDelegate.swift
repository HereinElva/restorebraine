import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var pendingCacheReload = false
    private var sessionBridgeInstalled = false

    private func storedNativeToken() -> String? {
        let defaults = UserDefaults.standard
        if defaults.string(forKey: "CapacitorStorage.b44_signed_out") == "1" { return nil }
        return defaults.string(forKey: "CapacitorStorage.base44_access_token")
            ?? defaults.string(forKey: "CapacitorStorage.token")
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

    /// Build v4 flow: push token into WebView localStorage immediately (before React auth check).
    private func notifyOAuthComplete(with token: String? = nil) {
        let activeToken = token ?? storedNativeToken()
        guard let activeToken, !activeToken.isEmpty else {
            DispatchQueue.main.async {
                guard let bridge = self.window?.rootViewController as? CAPBridgeViewController,
                      let webView = bridge.webView else { return }
                webView.evaluateJavaScript(
                    "window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));",
                    completionHandler: nil
                )
            }
            return
        }

        let escaped = activeToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let js = """
        (function(){
          try {
            localStorage.removeItem('b44_signed_out');
            localStorage.setItem('base44_access_token','\(escaped)');
            localStorage.setItem('token','\(escaped)');
            window.dispatchEvent(new CustomEvent('restorebraine-session-updated',{detail:{token:'\(escaped)'}}));
            window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
          } catch(e) {}
        })();
        """
        DispatchQueue.main.async {
            guard let bridge = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = bridge.webView else { return }
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func sessionBridgeScript(syncToken: String) -> String {
        let escaped = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        guard let bridgePath = Bundle.main.path(forResource: "capacitor-v4-session-bridge", ofType: "js", inDirectory: "public"),
              let bridgeBody = try? String(contentsOfFile: bridgePath, encoding: .utf8) else {
            return "window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__='\(escaped)';"
        }
        return "window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__='\(escaped)';\n\(bridgeBody)"
    }

    @objc private func installSessionBridge() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }

        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic

        guard !sessionBridgeInstalled else { return }
        sessionBridgeInstalled = true

        let token = storedNativeToken() ?? ""
        let script = WKUserScript(
            source: sessionBridgeScript(syncToken: token),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        webView.configuration.userContentController.addUserScript(script)
    }

    /// WKWebView caches capacitor://localhost aggressively — block briefly on stamp change.
    private func clearWebViewCacheIfBuildChanged() -> Bool {
        guard let stampPath = Bundle.main.path(forResource: "BUILD_STAMP", ofType: "txt"),
              let stamp = try? String(contentsOfFile: stampPath, encoding: .utf8)
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !stamp.isEmpty else { return false }

        let cacheKey = "restorebraine_webview_cache_stamp"
        let defaults = UserDefaults.standard
        guard defaults.string(forKey: cacheKey) != stamp else { return false }

        URLCache.shared.removeAllCachedResponses()
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)

        let dataStore = WKWebsiteDataStore.default()
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        let group = DispatchGroup()
        group.enter()
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {
            defaults.set(stamp, forKey: cacheKey)
            group.leave()
        }
        _ = group.wait(timeout: .now() + 3.0)

        pendingCacheReload = true
        sessionBridgeInstalled = false
        return true
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        _ = clearWebViewCacheIfBuildChanged()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onBridgeDidLoad),
            name: Notification.Name("CAPBridgeDidLoad"),
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(installSessionBridge),
            name: Notification.Name("CAPBridgeDidLoad"),
            object: nil
        )
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.installSessionBridge()
        }
        return true
    }

    @objc private func onBridgeDidLoad() {
        guard pendingCacheReload,
              let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        pendingCacheReload = false
        webView.reload()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        persistOAuthTokenFromURL(url)
        if url.scheme == "restorebraine" || url.absoluteString.contains("access_token=") {
            notifyOAuthComplete(with: storedNativeToken())
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            persistOAuthTokenFromURL(url)
            notifyOAuthComplete(with: storedNativeToken())
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
