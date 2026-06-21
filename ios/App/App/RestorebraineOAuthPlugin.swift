import Foundation
import Capacitor
import AuthenticationServices

@objc(RestorebraineOAuthPlugin)
public class RestorebraineOAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {

    public let identifier = "RestorebraineOAuthPlugin"
    public let jsName = "RestorebraineOAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startGoogleOAuth", returnType: CAPPluginReturnPromise),
    ]

    private var authSession: ASWebAuthenticationSession?

    private func persistToken(_ token: String) {
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    private func tokenFromCallbackURL(_ url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
              !token.isEmpty else { return nil }
        return token
    }

    private func resolveCall(_ call: CAPPluginCall, token: String?, callbackURL: URL?, error: Error?) {
        authSession = nil

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

    @objc func startGoogleOAuth(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing OAuth URL")
            return
        }

        DispatchQueue.main.async {
            self.authSession?.cancel()

            // iOS 17.4+: catch https://restorebraine.base44.app/?access_token= directly.
            if #available(iOS 17.4, *) {
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
                self.authSession = session
                if session.start() { return }
                self.authSession = nil
            }

            // All iOS: restorebraine://oauth/callback?access_token= (hosted page runs native-oauth-return.js).
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "restorebraine") { [weak self] callbackURL, error in
                guard let self else { return }
                let token = callbackURL.flatMap { self.tokenFromCallbackURL($0) }
                self.resolveCall(call, token: token, callbackURL: callbackURL, error: error)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session

            if !session.start() {
                self.authSession = nil
                call.reject("Could not start OAuth session")
            }
        }
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
