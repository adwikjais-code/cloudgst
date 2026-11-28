import UIKit
import WebKit

/// In-app GST Portal sheet with automatic username/password pre-fill (iPad/iOS counterpart of PortalLoginActivity.java).
final class PortalLoginViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let username: String
    private let password: String
    private let gstin: String
    private let fp: String
    private let periodLabel: String
    private var webView: WKWebView!
    private var didFill = false
    private var didJumpGstr1 = false

    init(username: String, password: String, gstin: String, fp: String, periodLabel: String) {
        self.username = username
        self.password = password
        self.gstin = gstin
        self.fp = fp
        self.periodLabel = periodLabel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let titleParts = [gstin, periodLabel].filter { !$0.isEmpty }
        title = titleParts.isEmpty ? "GST Portal" : titleParts.joined(separator: " • ")

        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Close", style: .done, target: self, action: #selector(closeTapped))
        navigationItem.rightBarButtonItems = [
            UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reloadTapped)),
            UIBarButtonItem(title: "Fill ID", style: .plain, target: self, action: #selector(fillCredentials))
        ]

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .nonPersistent()
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        if let url = URL(string: "https://services.gst.gov.in/services/login") {
            webView.load(URLRequest(url: url))
        }
    }

    @objc private func closeTapped() { dismiss(animated: true) }
    @objc private func reloadTapped() { webView.reload() }

    @objc private func fillCredentials() {
        guard !username.isEmpty || !password.isEmpty else { return }
        let js = """
        (function(){try{
          function set(el,v){if(!el||!v)return;try{var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(el,v);}catch(e){el.value=v;}
          ['input','change','blur'].forEach(function(n){el.dispatchEvent(new Event(n,{bubbles:true}));});}
          var u=document.getElementById('username')||document.querySelector('input[name*=user i],input[id*=user i]');
          var p=document.getElementById('user_pass')||document.querySelector('input[type=password]');
          set(u,\(jsQuote(username)));set(p,\(jsQuote(password)));
        }catch(e){}})()
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let urlStr = (webView.url?.absoluteString ?? "").lowercased()
        if urlStr.contains("/login") && !didFill {
            didFill = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
                self?.fillCredentials()
            }
        } else if !fp.isEmpty && !didJumpGstr1 && urlStr.contains("/auth/dashboard") {
            didJumpGstr1 = true
            if let g1 = URL(string: "https://return.gst.gov.in/returns/auth/gstr1?fp=\(fp)") {
                webView.load(URLRequest(url: g1))
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    private func jsQuote(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
              let arr = String(data: data, encoding: .utf8),
              arr.count >= 2 else { return "\"\"" }
        return String(arr.dropFirst().dropLast())
    }
}
