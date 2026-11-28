import UIKit
import WebKit
import LocalAuthentication
import UniformTypeIdentifiers

final class MainViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private static let maxSlots = 5
    private static let prefBioLock = "cloudgst_bio_lock"
    private static let maxShareBytes = 20 * 1024 * 1024
    private static let maxShareFiles = 10

    private struct PendingShareFile {
        let name: String
        let mime: String
        let size: Int
        let b64: String
    }

    private var server: LocalAssetServer?
    private var webView: WKWebView!
    private var lockView: UIView?
    private var bioUnlocked = false
    private var pageFinished = false

    private let slotDataStores: [WKWebsiteDataStore] = (0..<maxSlots).map { _ in WKWebsiteDataStore.nonPersistent() }
    private var phoneLogins: [PhoneLogin?] = Array(repeating: nil, count: maxSlots)
    private var phoneFetches: [PhoneFetch?] = Array(repeating: nil, count: maxSlots)
    private var uploadBuffers: [String] = Array(repeating: "", count: maxSlots)
    private var pendingShares: [PendingShareFile] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x12 / 255.0, green: 0x26 / 255.0, blue: 0x5C / 255.0, alpha: 1.0)
        setupWebView()
        if needsLock() {
            showLockScreen()
        } else {
            startServerAndLoad()
        }
    }

    func onAppWillEnterForeground() {
        server?.ensureRunning()
    }

    // MARK: - WebView Setup & Synchronous JS Bridge Shim

    private func setupWebView() {
        let ucc = WKUserContentController()
        ucc.add(self, name: "cloudgst")

        let bridgeScript = WKUserScript(
            source: buildNativeBridgeShimScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        ucc.addUserScript(bridgeScript)

        let cfg = WKWebViewConfiguration()
        cfg.userContentController = ucc
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        cfg.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.backgroundColor = .systemBackground

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func startServerAndLoad() {
        guard let appFolder = Bundle.main.url(forResource: "app", withExtension: nil) else {
            showToast("❌ App web bundle missing in IPA")
            return
        }
        if server == nil {
            server = LocalAssetServer(rootURL: appFolder)
        }
        server?.start { [weak self] indexURL in
            guard let self = self else { return }
            if self.webView.url == nil {
                self.webView.load(URLRequest(url: indexURL))
            }
        }
    }

    private func buildNativeBridgeShimScript() -> String {
        let appVer = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "6.2.1"
        let bioStat = bioStatusText()
        let bioEnabled = UserDefaults.standard.bool(forKey: Self.prefBioLock)
        return """
        (function(){
          if (window.CloudGSTNative) return;
          var C = window.__iosBridgeCache = {
            payloads: Object.create(null),
            stage: 'idle',
            bioStatus: \(jsQuote(bioStat)),
            bioEnabled: \(bioEnabled ? "true" : "false"),
            pendingShares: []
          };
          function post(obj) {
            try { window.webkit.messageHandlers.cloudgst.postMessage(obj); } catch (e) {}
          }
          function mkId(prefix, slot) {
            return prefix + '_' + slot + '_' + Date.now() + '_' + Math.floor(Math.random() * 9000 + 1000);
          }
          window.__iosSetPayloadChunk = function(id, chunk, append) {
            C.payloads[id] = append ? ((C.payloads[id] || '') + chunk) : chunk;
          };
          window.__iosSetStage = function(st) { C.stage = String(st || 'idle'); };
          window.__iosSetBio = function(st, en) { C.bioStatus = String(st || 'none'); C.bioEnabled = !!en; };
          window.__iosClearShares = function() { C.pendingShares = []; };
          window.__iosPushShareMeta = function(idx, name, mime, size) {
            C.pendingShares[idx] = { idx: idx, name: name, mime: mime, size: size, b64: '' };
          };
          window.__iosAppendShareChunk = function(idx, chunk) {
            if (C.pendingShares[idx]) C.pendingShares[idx].b64 += chunk;
          };

          window.CloudGSTNative = {
            appVersion: function() { return \(jsQuote(appVer)); },
            hasBiometric: function() { return C.bioStatus !== 'none'; },
            bioStatus: function() { return C.bioStatus; },
            isBioLockEnabled: function() { return !!C.bioEnabled; },
            setBioLock: function(en) { C.bioEnabled = !!en; post({ cmd: 'setBioLock', enable: !!en }); },
            saveBase64: function(name, b64) { post({ cmd: 'saveBase64', name: String(name || 'file'), b64: String(b64 || '') }); },
            shareBase64: function(name, b64, text) { post({ cmd: 'shareBase64', name: String(name || 'file'), b64: String(b64 || ''), text: String(text || '') }); },
            shareText: function(text, title) { post({ cmd: 'shareText', text: String(text || ''), title: String(title || 'Share') }); },
            openPortal: function(u, p, g, fp, per) {
              post({ cmd: 'openPortal', u: String(u || ''), p: String(p || ''), g: String(g || ''), fp: String(fp || ''), per: String(per || '') });
            },
            phoneMaxParallel: function() { return \(Self.maxSlots); },
            phoneLoginAvailable: function() { return true; },
            phoneFetchAvailable: function() { return true; },
            phoneUploadAvailable: function() { return true; },
            phoneLoginVisible: function(show) {},
            phoneLoginStartSlot: function(slot, user, pass) {
              var s = Math.max(0, Math.min(\(Self.maxSlots - 1), Number(slot) || 0));
              var id = mkId('pl', s);
              delete C.payloads[id];
              post({ cmd: 'phoneLoginStartSlot', slot: s, id: id, user: String(user || ''), pass: String(pass || '') });
              return id;
            },
            phoneLoginStart: function(user, pass) { return this.phoneLoginStartSlot(0, user, pass); },
            phoneLoginCaptchaSlot: function(slot, captcha) {
              post({ cmd: 'phoneLoginCaptchaSlot', slot: Number(slot) || 0, captcha: String(captcha || '') });
            },
            phoneLoginCaptcha: function(captcha) { this.phoneLoginCaptchaSlot(0, captcha); },
            phoneLoginOtpSlot: function(slot, otp) {
              post({ cmd: 'phoneLoginOtpSlot', slot: Number(slot) || 0, otp: String(otp || '') });
            },
            phoneLoginOtp: function(otp) { this.phoneLoginOtpSlot(0, otp); },
            phoneFetch2bSlot: function(slot, fyLabel, monLabel) {
              var s = Math.max(0, Math.min(\(Self.maxSlots - 1), Number(slot) || 0));
              var id = mkId('pf', s);
              delete C.payloads[id];
              post({ cmd: 'phoneFetch2bSlot', slot: s, id: id, fy: String(fyLabel || ''), mon: String(monLabel || '') });
              return id;
            },
            phoneFetch2b: function(fyLabel, monLabel) { return this.phoneFetch2bSlot(0, fyLabel, monLabel); },
            phoneUploadInit: function(slot) {
              post({ cmd: 'phoneUploadInit', slot: Number(slot) || 0 });
              return true;
            },
            phoneUploadAppend: function(slot, chunk) {
              post({ cmd: 'phoneUploadAppend', slot: Number(slot) || 0, chunk: String(chunk || '') });
              return true;
            },
            phoneUploadGstr1Slot: function(slot, fyLabel, monLabel, fileName) {
              var s = Math.max(0, Math.min(\(Self.maxSlots - 1), Number(slot) || 0));
              var id = mkId('pu', s);
              delete C.payloads[id];
              post({ cmd: 'phoneUploadGstr1Slot', slot: s, id: id, fy: String(fyLabel || ''), mon: String(monLabel || ''), fileName: String(fileName || 'GSTR1.json') });
              return id;
            },
            phonePayloadFor: function(id) {
              var v = C.payloads[String(id || '')];
              return typeof v === 'string' ? v : '';
            },
            phoneFetchChunk: function(id, offset, len) {
              var p = C.payloads[String(id || '')];
              if (!p) return '';
              var off = Math.max(0, Number(offset) || 0);
              var L = Math.max(1, Math.min(Number(len) || 200000, 400000));
              return p.slice(off, off + L);
            },
            clearPhonePayload: function(id) { delete C.payloads[String(id || '')]; },
            phoneStage: function() { return C.stage || 'idle'; },
            hasExternalKeyboard: function() { return false; },
            hideSoftKeyboard: function() {},
            getPendingShareMeta: function() {
              var arr = (C.pendingShares || []).filter(Boolean).map(function(f, i) {
                return { idx: i, name: f.name, mime: f.mime, size: f.size, b64Len: (f.b64 || '').length };
              });
              return JSON.stringify(arr);
            },
            getPendingShareChunk: function(idx, offset, len) {
              var list = (C.pendingShares || []).filter(Boolean);
              var f = list[Number(idx) || 0];
              if (!f || !f.b64) return '';
              var off = Math.max(0, Number(offset) || 0);
              var L = Math.max(1, Number(len) || 200000);
              return f.b64.slice(off, off + L);
            },
            clearPendingShare: function() { C.pendingShares = []; post({ cmd: 'clearPendingShare' }); },
            toast: function(msg) { post({ cmd: 'toast', msg: String(msg || '') }); }
          };

          // Bridge <a download> blob downloads to native iOS share/save sheet
          document.addEventListener('click', function(ev) {
            var a = ev.target && ev.target.closest ? ev.target.closest('a[download]') : null;
            if (!a || !a.href || a.href.indexOf('blob:') !== 0) return;
            ev.preventDefault();
            var fname = a.getAttribute('download') || 'CloudGST_file';
            fetch(a.href).then(function(r){ return r.blob(); }).then(function(b){
              var fr = new FileReader();
              fr.onload = function() {
                var b64 = String(fr.result || '').split(',')[1] || '';
                if (b64) window.CloudGSTNative.saveBase64(fname, b64);
              };
              fr.readAsDataURL(b);
            }).catch(function(){});
          }, true);
        })();
        """
    }

    // MARK: - WKNavigationDelegate & WKUIDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageFinished = true
        webView.evaluateJavaScript("document.documentElement.classList.add('native-app');", completionHandler: nil)
        if bioUnlocked {
            webView.evaluateJavaScript("(window.cloudGstNativeUnlocked&&window.cloudGstNativeUnlocked())", completionHandler: nil)
        }
        flushPendingSharesToWeb()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        let scheme = (url.scheme ?? "").lowercased()
        let host = (url.host ?? "").lowercased()
        if scheme == "http" && host == "127.0.0.1" {
            decisionHandler(.allow)
            return
        }
        if scheme == "tel" || scheme == "mailto" || scheme == "whatsapp" || host == "wa.me" || host == "api.whatsapp.com" || scheme == "https" {
            if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let ac = UIAlertController(title: "CloudGST", message: message, preferredStyle: .alert)
        ac.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(ac, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let ac = UIAlertController(title: "CloudGST", message: message, preferredStyle: .alert)
        ac.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        ac.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(ac, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let ac = UIAlertController(title: "CloudGST", message: prompt, preferredStyle: .alert)
        ac.addTextField { $0.text = defaultText }
        ac.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        ac.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(ac.textFields?.first?.text) })
        present(ac, animated: true)
    }

    // MARK: - WKScriptMessageHandler (JS -> Native)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let cmd = body["cmd"] as? String else { return }

        switch cmd {
        case "phoneLoginStartSlot":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let id = body["id"] as? String ?? ""
            let user = body["user"] as? String ?? ""
            let pass = body["pass"] as? String ?? ""
            startPhoneLoginSlot(slot: slot, id: id, user: user, pass: pass)

        case "phoneLoginCaptchaSlot":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let cap = body["captcha"] as? String ?? ""
            phoneLogins[slot]?.submitCaptcha(cap)

        case "phoneLoginOtpSlot":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let otp = body["otp"] as? String ?? ""
            phoneLogins[slot]?.submitOtp(otp)

        case "phoneFetch2bSlot":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let id = body["id"] as? String ?? ""
            let fy = body["fy"] as? String ?? ""
            let mon = body["mon"] as? String ?? ""
            startPhoneFetchSlot(slot: slot, id: id, fy: fy, mon: mon)

        case "phoneUploadInit":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            uploadBuffers[slot] = ""

        case "phoneUploadAppend":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let chunk = body["chunk"] as? String ?? ""
            uploadBuffers[slot].append(chunk)

        case "phoneUploadGstr1Slot":
            let slot = clampSlot(body["slot"] as? Int ?? 0)
            let id = body["id"] as? String ?? ""
            let fy = body["fy"] as? String ?? ""
            let mon = body["mon"] as? String ?? ""
            let fileName = body["fileName"] as? String ?? "GSTR1.json"
            startPhoneUploadSlot(slot: slot, id: id, fy: fy, mon: mon, fileName: fileName)

        case "openPortal":
            let vc = PortalLoginViewController(
                username: body["u"] as? String ?? "",
                password: body["p"] as? String ?? "",
                gstin: body["g"] as? String ?? "",
                fp: body["fp"] as? String ?? "",
                periodLabel: body["per"] as? String ?? ""
            )
            let nav = UINavigationController(rootViewController: vc)
            nav.modalPresentationStyle = .pageSheet
            present(nav, animated: true)

        case "saveBase64":
            presentShareFile(name: body["name"] as? String ?? "CloudGST_file", b64: body["b64"] as? String ?? "", text: nil)

        case "shareBase64":
            presentShareFile(name: body["name"] as? String ?? "CloudGST_file", b64: body["b64"] as? String ?? "", text: body["text"] as? String)

        case "shareText":
            let txt = body["text"] as? String ?? ""
            let av = UIActivityViewController(activityItems: [txt], applicationActivities: nil)
            configurePopover(av)
            present(av, animated: true)

        case "setBioLock":
            let en = body["enable"] as? Bool ?? false
            setBioLock(en)

        case "clearPendingShare":
            pendingShares.removeAll()

        case "toast":
            if let msg = body["msg"] as? String, !msg.isEmpty {
                showToast(msg)
            }

        default:
            break
        }
    }

    // MARK: - 5-Slot Parallel Phone Mode Orchestration

    private func clampSlot(_ slot: Int) -> Int {
        max(0, min(Self.maxSlots - 1, slot))
    }

    private func startPhoneLoginSlot(slot: Int, id: String, user: String, pass: String) {
        if phoneLogins[slot] == nil {
            phoneLogins[slot] = PhoneLogin(slot: slot, dataStore: slotDataStores[slot]) { [weak self] reqId, payload in
                self?.pushPayloadToWeb(id: reqId, payload: payload)
            }
        }
        phoneLogins[slot]?.start(id: id, user: user, pass: pass, host: view)
    }

    private func startPhoneFetchSlot(slot: Int, id: String, fy: String, mon: String) {
        if phoneFetches[slot] == nil {
            phoneFetches[slot] = PhoneFetch(slot: slot, dataStore: slotDataStores[slot]) { [weak self] reqId, payload in
                self?.pushPayloadToWeb(id: reqId, payload: payload)
            }
        }
        phoneFetches[slot]?.start(id: id, fy: fy, mon: mon, host: view)
    }

    private func startPhoneUploadSlot(slot: Int, id: String, fy: String, mon: String, fileName: String) {
        let jsonB64 = uploadBuffers[slot]
        uploadBuffers[slot] = ""
        if phoneFetches[slot] == nil {
            phoneFetches[slot] = PhoneFetch(slot: slot, dataStore: slotDataStores[slot]) { [weak self] reqId, payload in
                self?.pushPayloadToWeb(id: reqId, payload: payload)
            }
        }
        phoneFetches[slot]?.startUploadGstr1(id: id, fy: fy, mon: mon, fileName: fileName, jsonBase64: jsonB64, host: view)
    }

    private func pushPayloadToWeb(id: String, payload: String) {
        guard !id.isEmpty else { return }
        let chunkSize = 200_000
        var offset = payload.startIndex
        var isFirst = true
        while offset < payload.endIndex {
            let end = payload.index(offset, offsetBy: chunkSize, limitedBy: payload.endIndex) ?? payload.endIndex
            let chunk = String(payload[offset..<end])
            let js = "window.__iosSetPayloadChunk&&window.__iosSetPayloadChunk(\(jsQuote(id)),\(jsQuote(chunk)),\(isFirst ? "false" : "true"));"
            webView.evaluateJavaScript(js, completionHandler: nil)
            isFirst = false
            offset = end
        }
        if isFirst {
            let js = "window.__iosSetPayloadChunk&&window.__iosSetPayloadChunk(\(jsQuote(id)),'',false);"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
        pushStageToWeb()
    }

    private func pushStageToWeb() {
        var parts: [String] = []
        for i in 0..<Self.maxSlots {
            if let l = phoneLogins[i], l.isBusy {
                parts.append("T\(i + 1):login:\(l.stage)")
            } else if let f = phoneFetches[i], f.isBusy {
                parts.append("T\(i + 1):fetch:\(f.stage)")
            }
        }
        let st = parts.isEmpty ? "idle" : parts.joined(separator: " | ")
        webView.evaluateJavaScript("window.__iosSetStage&&window.__iosSetStage(\(jsQuote(st)));", completionHandler: nil)
    }

    // MARK: - Incoming Shared / Open-In Files (WhatsApp / Files / Mail / Safari -> CloudGST)

    func handleIncomingShareURLs(_ urls: [URL]) {
        guard !urls.isEmpty else { return }
        let limited = Array(urls.prefix(Self.maxShareFiles))
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var loaded: [PendingShareFile] = []
            var skippedLarge = 0
            for url in limited {
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { continue }
                if data.count > Self.maxShareBytes {
                    skippedLarge += 1
                    continue
                }
                let name = url.lastPathComponent.isEmpty ? "Shared_\(Int(Date().timeIntervalSince1970))" : url.lastPathComponent
                let mime = Self.guessMime(fileName: name)
                loaded.append(PendingShareFile(name: name, mime: mime, size: data.count, b64: data.base64EncodedString()))
            }
            DispatchQueue.main.async {
                if loaded.isEmpty {
                    self.showToast(skippedLarge > 0 ? "⚠️ Shared file 20 MB se badi hai — upload nahi ho sakti." : "⚠️ Shared file padh nahi paye.")
                    return
                }
                self.pendingShares = loaded
                if skippedLarge > 0 {
                    self.showToast("⚠️ \(skippedLarge) file 20 MB se badi thi, skip kar di gayi.")
                }
                self.flushPendingSharesToWeb()
            }
        }
    }

    private func flushPendingSharesToWeb() {
        guard lockView == nil, pageFinished, !pendingShares.isEmpty else { return }
        let files = pendingShares
        pendingShares.removeAll()

        webView.evaluateJavaScript("window.__iosClearShares&&window.__iosClearShares();", completionHandler: nil)
        let chunkSize = 200_000
        for (idx, f) in files.enumerated() {
            let metaJs = "window.__iosPushShareMeta&&window.__iosPushShareMeta(\(idx),\(jsQuote(f.name)),\(jsQuote(f.mime)),\(f.size));"
            webView.evaluateJavaScript(metaJs, completionHandler: nil)
            var off = f.b64.startIndex
            while off < f.b64.endIndex {
                let end = f.b64.index(off, offsetBy: chunkSize, limitedBy: f.b64.endIndex) ?? f.b64.endIndex
                let chunk = String(f.b64[off..<end])
                let chunkJs = "window.__iosAppendShareChunk&&window.__iosAppendShareChunk(\(idx),\(jsQuote(chunk)));"
                webView.evaluateJavaScript(chunkJs, completionHandler: nil)
                off = end
            }
        }
        webView.evaluateJavaScript("(function(){try{if(window.cloudGstHandleSharedFiles)window.cloudGstHandleSharedFiles();}catch(e){}})()", completionHandler: nil)
    }

    // MARK: - File Export / Share Sheet (PDF, CSV, JSON)

    private func presentShareFile(name: String, b64: String, text: String?) {
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
            showToast("❌ File decode nahi ho payi")
            return
        }
        let cleanName = name.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "\\", with: "_")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(cleanName.isEmpty ? "CloudGST_file" : cleanName)
        do {
            try data.write(to: url, options: .atomic)
            var items: [Any] = [url]
            if let t = text, !t.isEmpty { items.append(t) }
            let av = UIActivityViewController(activityItems: items, applicationActivities: nil)
            configurePopover(av)
            present(av, animated: true)
        } catch {
            showToast("❌ Save fail: \(error.localizedDescription)")
        }
    }

    private func configurePopover(_ av: UIActivityViewController) {
        if let pop = av.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
    }

    // MARK: - Touch ID / Face ID / Passcode Lock

    private func bioStatusText() -> String {
        let ctx = LAContext()
        var err: NSError?
        if ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) {
            return "fingerprint"
        }
        if ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) {
            return "device_pin"
        }
        return "none"
    }

    private func needsLock() -> Bool {
        bioStatusText() != "none" && UserDefaults.standard.bool(forKey: Self.prefBioLock)
    }

    private func setBioLock(_ enable: Bool) {
        if !enable {
            UserDefaults.standard.set(false, forKey: Self.prefBioLock)
            bioUnlocked = false
            showToast("Touch ID / Face ID lock OFF")
            return
        }
        if bioStatusText() == "none" {
            showToast("iPad Settings me pehle Touch ID / Passcode set karein")
            return
        }
        UserDefaults.standard.set(true, forKey: Self.prefBioLock)
        showToast("Touch ID / Passcode lock ON")
    }

    private func showLockScreen() {
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = UIColor(red: 0x12 / 255.0, green: 0x26 / 255.0, blue: 0x5C / 255.0, alpha: 1.0)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        let titleLbl = UILabel()
        titleLbl.text = "CloudGST"
        titleLbl.font = .boldSystemFont(ofSize: 28)
        titleLbl.textColor = .white

        let subLbl = UILabel()
        subLbl.text = "Touch ID / Face ID ya Passcode se kholein"
        subLbl.font = .systemFont(ofSize: 15)
        subLbl.textColor = UIColor(red: 0xC1 / 255.0, green: 0x9A / 255.0, blue: 0x38 / 255.0, alpha: 1.0)

        let btn = UIButton(type: .system)
        btn.setTitle("👆 Unlock", for: .normal)
        btn.titleLabel?.font = .boldSystemFont(ofSize: 17)
        btn.backgroundColor = UIColor(red: 0xC1 / 255.0, green: 0x9A / 255.0, blue: 0x38 / 255.0, alpha: 1.0)
        btn.setTitleColor(UIColor(red: 0x12 / 255.0, green: 0x26 / 255.0, blue: 0x5C / 255.0, alpha: 1.0), for: .normal)
        btn.layer.cornerRadius = 12
        btn.contentEdgeInsets = UIEdgeInsets(top: 12, left: 32, bottom: 12, right: 32)
        btn.addTarget(self, action: #selector(unlockTapped), for: .touchUpInside)

        stack.addArrangedSubview(titleLbl)
        stack.addArrangedSubview(subLbl)
        stack.addArrangedSubview(btn)
        overlay.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: overlay.centerYAnchor)
        ])

        view.addSubview(overlay)
        lockView = overlay
        askBiometric()
    }

    @objc private func unlockTapped() { askBiometric() }

    private func askBiometric() {
        let ctx = LAContext()
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "CloudGST unlock karein") { [weak self] ok, _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if ok {
                    self.bioUnlocked = true
                    self.lockView?.removeFromSuperview()
                    self.lockView = nil
                    self.startServerAndLoad()
                    if self.pageFinished {
                        self.webView.evaluateJavaScript("(window.cloudGstNativeUnlocked&&window.cloudGstNativeUnlocked())", completionHandler: nil)
                        self.flushPendingSharesToWeb()
                    }
                }
            }
        }
    }

    // MARK: - Toast & Utils

    private func showToast(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let lbl = UILabel()
            lbl.text = "  \(message)  "
            lbl.textColor = .white
            lbl.backgroundColor = UIColor.black.withAlphaComponent(0.84)
            lbl.font = .systemFont(ofSize: 13, weight: .medium)
            lbl.numberOfLines = 3
            lbl.textAlignment = .center
            lbl.layer.cornerRadius = 10
            lbl.clipsToBounds = true
            lbl.translatesAutoresizingMaskIntoConstraints = false
            self.view.addSubview(lbl)
            NSLayoutConstraint.activate([
                lbl.centerXAnchor.constraint(equalTo: self.view.centerXAnchor),
                lbl.bottomAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
                lbl.widthAnchor.constraint(lessThanOrEqualTo: self.view.widthAnchor, multiplier: 0.85),
                lbl.heightAnchor.constraint(greaterThanOrEqualToConstant: 36)
            ])
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) {
                UIView.animate(withDuration: 0.25, animations: { lbl.alpha = 0 }) { _ in lbl.removeFromSuperview() }
            }
        }
    }

    private func jsQuote(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
              let arr = String(data: data, encoding: .utf8),
              arr.count >= 2 else { return "\"\"" }
        return String(arr.dropFirst().dropLast())
    }

    private static func guessMime(fileName: String) -> String {
        let ext = (fileName as NSString).pathExtension.lowercased()
        switch ext {
        case "pdf": return "application/pdf"
        case "csv": return "text/csv"
        case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "xls": return "application/vnd.ms-excel"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "heic": return "image/heic"
        default:
            if let ut = UTType(filenameExtension: ext), let mime = ut.preferredMIMEType {
                return mime
            }
            return "application/octet-stream"
        }
    }
}
