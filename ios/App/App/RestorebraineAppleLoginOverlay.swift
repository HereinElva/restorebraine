import UIKit
import WebKit
import AuthenticationServices

/// Official Sign in with Apple button over hosted Base44 login — App Store HIG 4.8.
/// Added to the view controller's view (webView subviews sit behind web content).
final class RestorebraineAppleLoginOverlay: NSObject {
    private weak var webView: WKWebView?
    private weak var containerView: UIView?
    private var appleButton: ASAuthorizationAppleIDButton?
    private var pollTimer: Timer?
    private var missCount = 0
    private var usingFallbackLayout = false

    private static let findRectScript = """
    (function(){
      var nodes=document.querySelectorAll('button,[role="button"],a,div');
      for(var i=0;i<nodes.length;i++){
        var b=nodes[i];
        var t=(b.textContent||'').replace(/\\s+/g,' ').trim();
        if(!/apple/i.test(t)||/google|microsoft|email|opening apple/i.test(t))continue;
        if(!/continue with|sign in with/i.test(t))continue;
        if(b.querySelector('[data-rb-apple-logo]'))return {found:0,webHasLogo:1};
        var r=b.getBoundingClientRect();
        if(r.width<40||r.height<16)return null;
        b.setAttribute('data-rb-native-apple-cover','1');
        b.style.opacity='0.01';
        b.style.pointerEvents='none';
        return {x:r.left,y:r.top,w:r.width,h:Math.max(r.height,44),found:1};
      }
      return {found:0};
    })();
    """

    private static let clickWebAppleScript = """
    (function(){
      var b=document.querySelector('[data-rb-native-apple-cover]');
      if(!b){
        var nodes=document.querySelectorAll('button,[role="button"],a,div');
        for(var i=0;i<nodes.length;i++){
          var t=(nodes[i].textContent||'').replace(/\\s+/g,' ').trim();
          if(/continue with apple|sign in with apple/i.test(t)){b=nodes[i];break;}
        }
      }
      if(b){ b.style.opacity='1'; b.style.pointerEvents='auto'; b.click(); }
    })();
    """

    func attach(webView: WKWebView, containerView: UIView) {
        self.webView = webView
        self.containerView = containerView
        missCount = 0
        usingFallbackLayout = false
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            self?.updatePosition()
        }
        RunLoop.main.add(pollTimer!, forMode: .common)
        updatePosition()
    }

    func detach() {
        pollTimer?.invalidate()
        pollTimer = nil
        appleButton?.removeFromSuperview()
        appleButton = nil
        webView = nil
        containerView = nil
    }

    @objc private func onAppleTap() {
        webView?.evaluateJavaScript(Self.clickWebAppleScript, completionHandler: nil)
    }

    private func updatePosition() {
        guard let webView, let containerView else { return }
        webView.evaluateJavaScript(Self.findRectScript) { [weak self] result, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                self.layoutButton(from: result, webView: webView, containerView: containerView)
            }
        }
    }

    private func ensureButton(in containerView: UIView) {
        if appleButton != nil { return }
        let btn = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
        btn.addTarget(self, action: #selector(onAppleTap), for: .touchUpInside)
        btn.accessibilityIdentifier = "restorebraine-native-apple-sign-in"
        containerView.addSubview(btn)
        appleButton = btn
    }

    private func layoutButton(from result: Any?, webView: WKWebView, containerView: UIView) {
        if let dict = result as? [String: Any],
           dict["webHasLogo"] as? Int == 1 || dict["webHasLogo"] as? Double == 1 {
            missCount = 0
            appleButton?.isHidden = true
            return
        }

        if let dict = result as? [String: Any],
           dict["found"] as? Int == 1 || dict["found"] as? Double == 1,
           let x = dict["x"] as? Double,
           let y = dict["y"] as? Double,
           let w = dict["w"] as? Double,
           let h = dict["h"] as? Double,
           w > 40, h > 16 {
            missCount = 0
            usingFallbackLayout = false
            ensureButton(in: containerView)
            guard let appleButton else { return }
            appleButton.isHidden = false
            let height = max(44, min(h, 56))
            let rectInWebView = CGRect(x: x, y: y, width: w, height: height)
            appleButton.frame = webView.convert(rectInWebView, to: containerView)
            containerView.bringSubviewToFront(appleButton)
            return
        }

        missCount += 1
        guard missCount >= 8, isLikelyLoginPage(webView) else {
            appleButton?.isHidden = true
            return
        }

        ensureButton(in: containerView)
        guard let appleButton else { return }
        usingFallbackLayout = true
        appleButton.isHidden = false
        let inset: CGFloat = 32
        let width = containerView.bounds.width - inset * 2
        let height: CGFloat = 44
        let y = containerView.bounds.height * 0.42 - height / 2
        appleButton.frame = CGRect(x: inset, y: max(120, y), width: max(200, width), height: height)
        containerView.bringSubviewToFront(appleButton)
    }

    private func isLikelyLoginPage(_ webView: WKWebView) -> Bool {
        guard let url = webView.url?.absoluteString.lowercased() else { return true }
        if url.contains("restorebraine") || url.contains("base44") { return true }
        if url.contains("capacitor://") || url.contains("localhost") { return true }
        return false
    }
}
