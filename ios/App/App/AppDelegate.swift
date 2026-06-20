import UIKit
import Capacitor
import WebKit

private final class RestorebraineSessionMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "restorebraineNativeSession",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String,
              action == "clear" else { return }
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "CapacitorStorage.base44_access_token")
        defaults.removeObject(forKey: "CapacitorStorage.token")
        defaults.set("1", forKey: "CapacitorStorage.b44_signed_out")
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let sessionMessageHandler = RestorebraineSessionMessageHandler()
    private var pendingCacheReload = false
    private var sessionBridgeInstalled = false

    private var nativeBuildLabel: String {
        guard let url = Bundle.main.url(forResource: "BUILD_STAMP", withExtension: "txt"),
              let label = try? String(contentsOf: url, encoding: .utf8) else {
            return "native bundle unknown"
        }
        return label.trimmingCharacters(in: .whitespacesAndNewlines)
    }

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

    /// Build v4: inject pre-v94 session bridge from bundled public/restorebraine-v4-bridge.js
    private func loadV4BridgeBody() -> (body: String, source: String)? {
        let bundle = Bundle.main
        var candidates: [(String, String)] = [
            (bundle.bundleURL.appendingPathComponent("public/restorebraine-v4-bridge.js").path, "appdelegate-public"),
        ]
        if let path = bundle.path(forResource: "restorebraine-v4-bridge", ofType: "js", inDirectory: "public") {
            candidates.append((path, "appdelegate-resource"))
        }
        if let path = bundle.path(forResource: "restorebraine-v4-bridge", ofType: "js") {
            candidates.append((path, "appdelegate-root"))
        }

        for (path, source) in candidates {
            guard FileManager.default.fileExists(atPath: path),
                  let body = try? String(contentsOfFile: path, encoding: .utf8),
                  body.contains("__restorebraineSessionBridgeInstalled") else { continue }
            return (body, source)
        }
        return nil
    }

    private func sessionBridgeScript(for buildLabel: String, syncToken: String) -> String {
        let escapedLabel = buildLabel
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        guard let loaded = loadV4BridgeBody() else {
            return """
            window.__RESTOREBRAINE_V4_BRIDGE_SOURCE__='appdelegate-stub';
            window.__RESTOREBRAINE_NATIVE_BUILD__='\(escapedLabel)';
            """
        }

        var bridgeBody = loaded.body
        bridgeBody = bridgeBody.replacingOccurrences(of: "SYNC_TOKEN_PLACEHOLDER", with: escapedToken)
        bridgeBody = bridgeBody.replacingOccurrences(of: "BUILD_LABEL_PLACEHOLDER", with: escapedLabel)
        return "window.__RESTOREBRAINE_V4_BRIDGE_SOURCE__='\(loaded.source)';\n\(bridgeBody)"
    }

    private func configureNativeWebView(_ bridge: CAPBridgeViewController) {
        guard let webView = bridge.webView else { return }
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
    }

    @objc private func installSessionBridge() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController else { return }
        configureNativeWebView(bridge)
        guard let userContentController = bridge.webView?.configuration.userContentController else { return }

        guard !sessionBridgeInstalled else { return }
        sessionBridgeInstalled = true

        let script = WKUserScript(
            source: sessionBridgeScript(for: nativeBuildLabel, syncToken: storedNativeToken() ?? ""),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.removeScriptMessageHandler(forName: "restorebraineNativeSession")
        userContentController.add(sessionMessageHandler, name: "restorebraineNativeSession")
        userContentController.addUserScript(script)
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
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.installSessionBridge()
        }
        return true
    }

    @objc private func onBridgeDidLoad() {
        // Cache already wiped in clearWebViewCacheIfBuildChanged — do not reload here;
        // reload interrupts React bootstrap and causes first-launch white screen.
        pendingCacheReload = false
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
