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
    private let appleLoginOverlay = RestorebraineAppleLoginOverlay()
    private var pendingCacheReload = false
    private var sessionBridgeInstalled = false
    private var appleFixPollCount = 0

    private var nativeBuildLabel: String {
        guard let url = Bundle.main.url(forResource: "BUILD_STAMP", withExtension: "txt"),
              let label = try? String(contentsOf: url, encoding: .utf8) else {
            return "native bundle unknown"
        }
        return label.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Bundled builds ship React login with Apple logo — native overlay would duplicate the button.
    private var isBundledNativeMode: Bool {
        Bundle.main.url(forResource: "BUNDLED_MODE", withExtension: "txt") != nil
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

    private func sessionBridgeScript(for buildLabel: String, syncToken: String) -> String {
        let escapedLabel = buildLabel
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedToken = syncToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        return """
        window.__RESTOREBRAINE_V4_BRIDGE_SOURCE__='appdelegate-sync';
        window.__RESTOREBRAINE_NATIVE_BUILD__='\(escapedLabel)';
        window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__='\(escapedToken)';
        """
    }

    private func appleLoginFixScript() -> String {
        return """
        (function(){
          var SVG='<svg aria-hidden="true" data-rb-apple-logo="1" width="20" height="20" viewBox="0 0 24 24" style="display:block;flex-shrink:0"><path fill="#ffffff" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>';
          function fix(){
            try{
              var nodes=document.querySelectorAll('button,[role="button"],a');
              for(var i=0;i<nodes.length;i++){
                var btn=nodes[i];
                if(btn.getAttribute('data-rb-apple-fixed')==='1')continue;
                if(btn.querySelector('[data-rb-apple-logo]')){btn.setAttribute('data-rb-apple-fixed','1');continue;}
                var label=(btn.textContent||'').replace(/\\s+/g,' ').trim();
                if(!/apple/i.test(label)||/google|microsoft|email/i.test(label))continue;
                if(!/continue with|sign in with/i.test(label))continue;
                btn.setAttribute('data-rb-apple-fixed','1');
                btn.setAttribute('data-rb-apple-sign-in','true');
                btn.setAttribute('data-rb-provider','apple');
                btn.style.display='flex';
                btn.style.alignItems='center';
                btn.style.justifyContent='center';
                btn.style.gap='8px';
                btn.style.background='#000000';
                btn.style.color='#ffffff';
                btn.style.minHeight='44px';
                btn.style.padding='0 16px';
                btn.style.border='none';
                btn.style.borderRadius='8px';
                btn.style.fontSize='16px';
                btn.style.fontWeight='600';
                btn.style.width='100%';
                btn.style.boxSizing='border-box';
                while(btn.firstChild)btn.removeChild(btn.firstChild);
                btn.insertAdjacentHTML('beforeend',SVG);
                var span=document.createElement('span');
                span.style.color='#ffffff';
                span.textContent='Sign in with Apple';
                btn.appendChild(span);
              }
            }catch(e){}
          }
          fix();
        })();
        """
    }

    func runAppleLoginFix(on webView: WKWebView) {
        webView.evaluateJavaScript(appleLoginFixScript(), completionHandler: nil)
    }

    func onWebViewDidFinish(_ webView: WKWebView) {
        if isBundledNativeMode {
            appleLoginOverlay.detach()
        } else {
            runAppleLoginFix(on: webView)
            if let bridge = window?.rootViewController as? CAPBridgeViewController {
                appleLoginOverlay.attach(webView: webView, containerView: bridge.view)
            }
            scheduleAppleFixBurst(on: webView)
        }
    }

    private func scheduleAppleFixBurst(on webView: WKWebView) {
        appleFixPollCount = 0
        for delay in [0.3, 0.8, 1.5, 2.5, 4.0, 6.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.runAppleLoginFix(on: webView)
            }
        }
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
        guard let webView = bridge.webView else { return }
        let userContentController = webView.configuration.userContentController

        if !sessionBridgeInstalled {
            sessionBridgeInstalled = true
            let script = WKUserScript(
                source: sessionBridgeScript(for: nativeBuildLabel, syncToken: storedNativeToken() ?? ""),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            userContentController.removeScriptMessageHandler(forName: "restorebraineNativeSession")
            userContentController.add(sessionMessageHandler, name: "restorebraineNativeSession")
            userContentController.addUserScript(script)

            let appleFix = WKUserScript(
                source: appleLoginFixScript(),
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: false
            )
            userContentController.addUserScript(appleFix)
        }

        onWebViewDidFinish(webView)
    }

    private func clearWebViewCacheIfBuildChanged() -> Bool {
        guard let stampPath = Bundle.main.path(forResource: "BUILD_STAMP", ofType: "txt"),
              let stamp = try? String(contentsOfFile: stampPath, encoding: .utf8)
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !stamp.isEmpty else { return false }

        let bundleVersion = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        let cacheKey = "restorebraine_webview_cache_stamp"
        let cacheValue = "\(stamp)|\(bundleVersion)"
        let defaults = UserDefaults.standard
        guard defaults.string(forKey: cacheKey) != cacheValue else { return false }

        URLCache.shared.removeAllCachedResponses()
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)

        let dataStore = WKWebsiteDataStore.default()
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        let group = DispatchGroup()
        group.enter()
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {
            defaults.set(cacheValue, forKey: cacheKey)
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
        for delay in [0.5, 1.0, 2.0, 4.0, 8.0, 12.0, 20.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                self.installSessionBridge()
            }
        }
        return true
    }

    @objc private func onBridgeDidLoad() {
        pendingCacheReload = false
        installSessionBridge()
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
