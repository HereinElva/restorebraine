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
    private var pendingCall: CAPPluginCall?

    private func persistToken(_ token: String) {
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "CapacitorStorage.base44_access_token")
        defaults.set(token, forKey: "CapacitorStorage.token")
        defaults.removeObject(forKey: "CapacitorStorage.b44_signed_out")
    }

    @objc func startGoogleOAuth(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing OAuth URL")
            return
        }

        DispatchQueue.main.async {
            self.authSession?.cancel()
            self.pendingCall = call

            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "restorebraine") { [weak self] callbackURL, error in
                guard let self else { return }
                defer {
                    self.authSession = nil
                    self.pendingCall = nil
                }

                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("OAuth canceled", "CANCELED")
                    return
                }

                guard error == nil, let callbackURL else {
                    call.reject(error?.localizedDescription ?? "OAuth failed")
                    return
                }

                guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                      let token = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
                      !token.isEmpty else {
                    call.reject("No access_token in OAuth callback")
                    return
                }

                self.persistToken(token)
                call.resolve(["token": token, "callbackUrl": callbackURL.absoluteString])
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session

            if !session.start() {
                call.reject("Could not start OAuth session")
                self.pendingCall = nil
                self.authSession = nil
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
