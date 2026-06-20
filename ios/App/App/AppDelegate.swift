import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private func persistOAuthTokenFromURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return }
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
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

    @objc private func configureNativeWebView() {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
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
