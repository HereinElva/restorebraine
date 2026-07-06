import UIKit
import WebKit
import AuthenticationServices

/// Official Sign in with Apple button over hosted Base44 login — App Store HIG 4.8.
/// Must be added to the view controller's view (NOT webView — web content draws on top of webView subviews).
final class RestorebraineAppleLoginOverlay: NSObject {
    private weak var webView: WKWebView?
    private weak var containerView: UIView?
    private var appleButton: ASAuthorizationAppleIDButton?
    private var pollTimer: Timer?

    private static let findRectScript = """
    (function(){
      var nodes=document.querySelectorAll('button,[role="button"]');
      for(var i=0;i<nodes.length;i++){
        var b=nodes[i];
        var t=(b.textContent||'').replace(/\\s+/g,' ').trim();
        if(!/apple/i.test(t)||/google|microsoft|email/i.test(t))continue;
        if(!/continue with|sign in with/i.test(t))continue;
        if(b.querySelector('[data-rb-apple-logo]'))return null;
        var r=b.getBoundingClientRect();
        if(r.width<40||r.height<20)return null;
        b.setAttribute('data-rb-native-apple-cover','1');
        b.style.opacity='0.01';
        b.style.pointerEvents='none';
        return {x:r.left,y:r.top,w:r.width,h:Math.max(r.height,44)};
      }
      return null;
    })();
    """

    private static let clickWebAppleScript = """
    (function(){
      var b=document.querySelector('[data-rb-native-apple-cover]');
      if(!b){
        var nodes=document.querySelectorAll('button,[role="button"]');
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
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            self?.updatePosition()
        }
        RunLoop.main.add(pollTimer!, forMode: .common)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.updatePosition()
        }
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

    private func layoutButton(from result: Any?, webView: WKWebView, containerView: UIView) {
        guard let dict = result as? [String: Any],
              let x = dict["x"] as? Double,
              let y = dict["y"] as? Double,
              let w = dict["w"] as? Double,
              let h = dict["h"] as? Double,
              w > 40, h > 20 else {
            appleButton?.isHidden = true
            return
        }

        if appleButton == nil {
            let btn = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
            btn.addTarget(self, action: #selector(onAppleTap), for: .touchUpInside)
            btn.accessibilityIdentifier = "restorebraine-native-apple-sign-in"
            containerView.addSubview(btn)
            appleButton = btn
        }

        guard let appleButton else { return }
        appleButton.isHidden = false

        let height = max(44, min(h, 56))
        let rectInWebView = CGRect(x: x, y: y, width: w, height: height)
        let rectInContainer = webView.convert(rectInWebView, to: containerView)
        appleButton.frame = rectInContainer
        containerView.bringSubviewToFront(appleButton)
    }
}
