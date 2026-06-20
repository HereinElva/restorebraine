import Foundation
import Capacitor
import AuthenticationServices
import WebKit

private final class RestorebraineOAuthWebViewController: UIViewController, WKNavigationDelegate {
    private let startURL: URL
    private let onComplete: (String?) -> Void
    private var webView: WKWebView!
    private var finished = false

    init(startURL: URL, onComplete: @escaping (String?) -> Void) {
        self.startURL = startURL
        self.onComplete = onComplete
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        let close = UIButton(type: .system)
        close.setTitle("Cancel", for: .normal)
        close.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(close)

        NSLayoutConstraint.activate([
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            close.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            webView.topAnchor.constraint(equalTo: close.bottomAnchor, constant: 8),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        webView.load(URLRequest(url: startURL))
    }

    @objc private func cancelTapped() {
        finish(with: nil)
    }

    private func finish(with token: String?) {
        guard !finished else { return }
        finished = true
        dismiss(animated: true) { self.onComplete(token) }
    }

    private func tokenFromURL(_ url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let host = components.host?.lowercased(),
              host == "restorebraine.base44.app" || host.hasSuffix(".base44.app"),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return nil }
        return token
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let token = tokenFromURL(url) {
            finish(with: token)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let url = navigationResponse.response.url, let token = tokenFromURL(url) {
            finish(with: token)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

@objc(RestorebraineOAuthPlugin)
public class RestorebraineOAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {

    public let identifier = "RestorebraineOAuthPlugin"
    public let jsName = "RestorebraineOAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startGoogleOAuth", returnType: CAPPluginReturnPromise),
    ]

    private var authSession: ASWebAuthenticationSession?
    private var oauthWebViewController: RestorebraineOAuthWebViewController?

    private func persistToken(_ token: String) {
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    private func resolveCall(_ call: CAPPluginCall, token: String?, callbackURL: URL?, error: Error?) {
        authSession = nil
        oauthWebViewController = nil

        if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
            call.reject("OAuth canceled", "CANCELED")
            return
        }

        if let token, !token.isEmpty {
            persistToken(token)
            call.resolve([
                "token": token,
                "callbackUrl": callbackURL?.absoluteString ?? "",
            ])
            return
        }

        call.reject(error?.localizedDescription ?? "OAuth failed or was canceled")
    }

    private func tokenFromCallbackURL(_ url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return nil }
        return token
    }

    @objc func startGoogleOAuth(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing OAuth URL")
            return
        }

        DispatchQueue.main.async {
            self.authSession?.cancel()
            self.oauthWebViewController?.dismiss(animated: false)

            if #available(iOS 17.4, *) {
                self.startHTTPSAuthSession(url: url, call: call)
            } else {
                self.startWebViewOAuth(url: url, call: call)
            }
        }
    }

    @available(iOS 17.4, *)
    private func startHTTPSAuthSession(url: URL, call: CAPPluginCall) {
        let session = ASWebAuthenticationSession(
            url: url,
            callback: .https(host: "restorebraine.base44.app", path: "/")
        ) { [weak self] callbackURL, error in
            guard let self else { return }
            let token = callbackURL.flatMap { self.tokenFromCallbackURL($0) }
            self.resolveCall(call, token: token, callbackURL: callbackURL, error: error)
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session

        if !session.start() {
            authSession = nil
            startWebViewOAuth(url: url, call: call)
        }
    }

    private func startWebViewOAuth(url: URL, call: CAPPluginCall) {
        guard let presenter = bridge?.viewController else {
            call.reject("No view controller to present OAuth")
            return
        }

        let controller = RestorebraineOAuthWebViewController(startURL: url) { [weak self] token in
            self?.resolveCall(call, token: token, callbackURL: nil, error: token == nil ? NSError(domain: "RestorebraineOAuth", code: 0, userInfo: [NSLocalizedDescriptionKey: "OAuth canceled"]) : nil)
        }
        oauthWebViewController = controller
        presenter.present(controller, animated: true)
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
