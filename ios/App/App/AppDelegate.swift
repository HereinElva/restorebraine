import UIKit
import Capacitor
import WebKit
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {

    var window: UIWindow?
    private var pendingCacheReload = false
    private var oauthHandlerRegistered = false
    private var authSession: ASWebAuthenticationSession?

    private func persistOAuthTokenFromURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return }
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    private func notifyOAuthComplete() {
        DispatchQueue.main.async {
            guard let bridge = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = bridge.webView else { return }
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));",
                completionHandler: nil
            )
        }
    }

    /// Google OAuth in ASWebAuthenticationSession — avoids InAppBrowser opening full Safari.
    private func startNativeOAuth(url: URL) {
        authSession?.cancel()
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "restorebraine") { [weak self] callbackURL, error in
            guard let self else { return }
            defer { self.authSession = nil }
            guard error == nil, let callbackURL else { return }
            self.persistOAuthTokenFromURL(callbackURL)
            self.notifyOAuthComplete()
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session
        session.start()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "restorebraineOAuth" else { return }
        guard let body = message.body as? [String: Any],
              let urlString = body["url"] as? String,
              let url = URL(string: urlString) else { return }
        startNativeOAuth(url: url)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window { return window }
        return UIApplication.shared.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
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
            selector: #selector(configureNativeWebView),
            name: Notification.Name("CAPBridgeDidLoad"),
            object: nil
        )
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.configureNativeWebView()
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

    @objc private func configureNativeWebView() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        if !oauthHandlerRegistered {
            webView.configuration.userContentController.add(self, name: "restorebraineOAuth")
            oauthHandlerRegistered = true
        }
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        persistOAuthTokenFromURL(url)
        if url.scheme == "restorebraine" {
            notifyOAuthComplete()
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            persistOAuthTokenFromURL(url)
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
