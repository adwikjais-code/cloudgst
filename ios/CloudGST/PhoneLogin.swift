import UIKit
import WebKit

/// 📱 Phone/iPad mode 100% hidden GST Portal login — 5 parallel isolated WKWebsiteDataStore slots.
/// Har slot (0..4) apna alag nonPersistent WKWebsiteDataStore use karta hai, isliye 5 clients ek saath
/// bina session clash ke login aur fetch kar sakte hain.
final class PhoneLogin: NSObject, WKNavigationDelegate {
    typealias Callback = (_ requestId: String, _ payloadJson: String) -> Void

    private static let loginURL = URL(string: "https://services.gst.gov.in/services/login")!
    private static let desktopUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"

    private let slot: Int
    private let dataStore: WKWebsiteDataStore
    private let callback: Callback

    private var webView: WKWebView?
    private var reqId: String = ""
    private var username: String = ""
    private var password: String = ""
    private var lastLoggedInUser: String = ""
    private var captchaSrc: String = ""
    private var tries: Int = 0
    private var clicks: Int = 0
    private var phase: Int = 0 // 0=idle, 1=findCaptcha, 2=afterSubmit
    private var finished: Bool = false
    private var awaitingUserInput: Bool = false
    private var wrongCapPending: Bool = false
    private var tickWork: DispatchWorkItem?
    private var timeoutWork: DispatchWorkItem?
    private(set) var stage: String = "idle"

    var isBusy: Bool {
        !finished && !awaitingUserInput && webView != nil && phase != 0
    }

    init(slot: Int, dataStore: WKWebsiteDataStore, callback: @escaping Callback) {
        self.slot = max(0, slot)
        self.dataStore = dataStore
        self.callback = callback
        super.init()
    }

    func start(id: String, user: String, pass: String, host: UIView) {
        stage = "start"
        reqId = id
        let newUser = user.trimmingCharacters(in: .whitespacesAndNewlines)
        let switchingClient = !lastLoggedInUser.isEmpty
            && !newUser.isEmpty
            && lastLoggedInUser.caseInsensitiveCompare(newUser) != .orderedSame

        username = newUser
        password = pass
        finished = false
        awaitingUserInput = false
        wrongCapPending = false
        tries = 0
        clicks = 0
        captchaSrc = ""
        phase = 1
        cancelTimers()
        ensureWebView(host: host)

        let beginLoad = { [weak self] in
            guard let self = self, !self.finished, let wv = self.webView else { return }
            self.stage = "load:login"
            wv.load(URLRequest(url: Self.loginURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
            self.scheduleTick(delay: 1.4)
        }

        if switchingClient {
            stage = "clear-session"
            lastLoggedInUser = ""
            dataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {
                DispatchQueue.main.async { beginLoad() }
            }
        } else {
            beginLoad()
        }

        scheduleTimeout(seconds: 150)
    }

    func submitCaptcha(_ captcha: String) {
        stage = "submit-captcha"
        guard let wv = webView, !finished else { return }
        awaitingUserInput = false
        wrongCapPending = false
        phase = 2
        tries = 0
        cancelTimers()
        scheduleTimeout(seconds: 150)

        let js = """
        (function(){try{
          function set(el,v){if(!el)return false;try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');d.set.call(el,v);}catch(e){el.value=v;}
          el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));return true;}
          function byId(ids){for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);if(e)return e;}return null;}
          var u=byId(['username','user_name','userid','login_name','userId'])||document.querySelector('input[name*=user i],input[id*=user i]');
          var p=byId(['user_pass','password','pwd','userPassword_u'])||document.querySelector('input[type=password]');
          var cp=byId(['captcha','captcha_code','captchacode','imgCaptchaText','captchaText'])||document.querySelector('input[name*=captcha i],input[id*=captcha i]');
          set(u,\(jsQuote(username)));set(p,\(jsQuote(password)));set(cp,\(jsQuote(captcha)));
          var btns=(p&&p.form?p.form:document).querySelectorAll('button[type=submit],input[type=submit]');
          for(var i=0;i<btns.length;i++){if(/LOGIN|SIGN/i.test(btns[i].innerText||btns[i].value||'')){btns[i].click();return 'OK';}}
          if(btns[0]){btns[0].click();return 'OK';}
          var allBtns=[].slice.call(document.querySelectorAll('button,input[type=submit],a.btn'));
          for(var j=0;j<allBtns.length;j++){if(/LOGIN|SIGN IN/i.test(allBtns[j].innerText||allBtns[j].value||'')){allBtns[j].click();return 'CLICKED';}}
          var f=p&&p.form;if(f&&f.submit){f.submit();return 'SUBMITTED';}
          return 'NOTFOUND';
        }catch(e){return 'ERR';}})()
        """
        wv.evaluateJavaScript(js) { [weak self] _, _ in
            guard let self = self, !self.finished, !self.awaitingUserInput else { return }
            self.phase = 2
            self.tries = 0
            self.scheduleTick(delay: 2.2)
        }
    }

    func submitOtp(_ otp: String) {
        stage = "submit-otp"
        guard let wv = webView, !finished else { return }
        awaitingUserInput = false
        phase = 2
        tries = 0
        cancelTimers()
        scheduleTimeout(seconds: 150)

        let js = """
        (function(){try{
          var el=document.querySelector('input[name*=otp i],input[id*=otp i],input[type=tel]')||document.querySelector('input[placeholder*=OTP i]');
          if(!el)return 'NOFIELD';
          try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');d.set.call(el,\(jsQuote(otp)));}catch(e){el.value=\(jsQuote(otp));}
          el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
          var btns=[].slice.call(document.querySelectorAll('button,input[type=submit]'));
          for(var i=0;i<btns.length;i++){var t=((btns[i].innerText||btns[i].value||'')+'').toUpperCase();if(t.indexOf('VERIFY')>=0||t.indexOf('SUBMIT')>=0||t.indexOf('CONTINUE')>=0){btns[i].click();return 'CLICKED';}}
          var f=el.form;if(f&&f.submit){f.submit();return 'SUBMITTED';}return 'NOTFOUND';
        }catch(e){return 'ERR';}})()
        """
        wv.evaluateJavaScript(js) { [weak self] _, _ in
            guard let self = self, !self.finished, !self.awaitingUserInput else { return }
            self.tries = 0
            self.scheduleTick(delay: 2.4)
        }
    }

    func destroy() {
        finished = true
        cancelTimers()
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        webView = nil
    }

    private func ensureWebView(host: UIView) {
        if let wv = webView {
            wv.alpha = 0.01
            wv.isUserInteractionEnabled = false
            return
        }
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = dataStore
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: 1024, height: 768), configuration: cfg)
        wv.customUserAgent = Self.desktopUA
        wv.navigationDelegate = self
        wv.alpha = 0.01
        wv.isUserInteractionEnabled = false
        host.insertSubview(wv, at: 0)
        webView = wv
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !finished, !awaitingUserInput else { return }
        scheduleTick(delay: 0.9)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsErr = error as NSError
        if nsErr.code == NSURLErrorCancelled { return }
        deliver(err(code: "network", message: "Portal page load nahi hua (\(nsErr.localizedDescription)). Internet/DNS check karein."))
    }

    // MARK: - Tick Loop

    private func scheduleTick(delay: TimeInterval) {
        tickWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.runTick() }
        tickWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func scheduleTimeout(seconds: TimeInterval) {
        timeoutWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, !self.finished else { return }
            self.deliver(self.err(code: "timeout", message: "Phone login (Tab \(self.slot + 1)): portal ne \(Int(seconds))s me jawab nahi diya. Dobara try karein."))
        }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    private func cancelTimers() {
        tickWork?.cancel(); tickWork = nil
        timeoutWork?.cancel(); timeoutWork = nil
    }

    private func runTick() {
        guard !finished, let wv = webView else { return }
        tries += 1
        let js = (phase == 1) ? buildFindCaptchaScript() : buildAfterSubmitScript()
        wv.evaluateJavaScript(js) { [weak self] value, _ in
            guard let self = self, !self.finished else { return }
            let raw = (value as? String) ?? ""
            let dict = Self.parseJsonObject(raw)
            let t = (dict?["t"] as? String) ?? ""
            self.stage = "poll:\(t.isEmpty ? "wait" : t)"

            if t == "CLICKLOGIN" {
                if self.clicks < 2 {
                    self.clicks += 1
                    self.stage = "click-login"
                    self.scheduleTick(delay: 2.5)
                } else if self.tries >= 25 {
                    self.deliver(self.err(code: "login_timeout", message: "Portal login form nahi khula — dobara try karein."))
                } else {
                    self.scheduleTick(delay: 1.8)
                }
                return
            }
            if t == "CAPWAIT" {
                if self.tries >= 18 {
                    self.deliver(self.err(code: "captcha_missing", message: "Login page par captcha image load nahi hui — dobara Re-Fetch dabayein."))
                } else {
                    self.scheduleTick(delay: 1.4)
                }
                return
            }
            if t == "CAPTCHA" {
                self.captchaSrc = (dict?["src"] as? String) ?? ""
                self.grabCaptcha()
                return
            }
            if t == "IN" {
                self.lastLoggedInUser = self.username
                self.deliver(self.okPayload(kind: "loggedIn"))
                return
            }
            if t == "OTPREQ" {
                self.emitStep(self.okPayload(kind: "otpRequired"))
                return
            }
            if t == "WRONGCAP" {
                self.wrongCapPending = true
                self.phase = 1
                self.tries = 0
                self.stage = "reload-captcha"
                self.scheduleTick(delay: 1.2)
                return
            }
            if t == "ERRMSG" {
                let msg = (dict?["msg"] as? String) ?? "ID/password check karein"
                self.deliver(self.err(code: "login_failed", message: "Portal ne login rok diya: \(msg)"))
                return
            }
            if self.wrongCapPending && self.tries >= 4 {
                self.wrongCapPending = false
                wv.load(URLRequest(url: Self.loginURL))
                self.scheduleTick(delay: 1.8)
                return
            }
            if self.tries >= 45 {
                let tail = String(raw.prefix(140))
                self.deliver(self.err(code: "login_timeout", message: "Phone login: portal ne form/Dashboard nahi diya (aakhri: \(tail)). Dobara try karein."))
                return
            }
            self.scheduleTick(delay: 1.6)
        }
    }

    private func grabCaptcha() {
        stage = "captcha-image"
        let src = captchaSrc.trimmingCharacters(in: .whitespacesAndNewlines)
        if src.isEmpty {
            deliver(err(code: "captcha_missing", message: "Login page par captcha nahi mila — dobara Re-Fetch dabayein."))
            return
        }
        if src.hasPrefix("data:") {
            deliverCaptchaImage(src)
            return
        }
        let fullStr = src.hasPrefix("http") ? src : "https://services.gst.gov.in" + (src.hasPrefix("/") ? "" : "/") + src
        guard let url = URL(string: fullStr) else {
            deliver(err(code: "captcha_failed", message: "Captcha URL invalid."))
            return
        }
        dataStore.httpCookieStore.getAllCookies { [weak self] cookies in
            guard let self = self, !self.finished else { return }
            let cookieHeader = cookies
                .filter { url.host?.hasSuffix($0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) == true }
                .map { "\($0.name)=\($0.value)" }
                .joined(separator: "; ")
            var req = URLRequest(url: url, timeoutInterval: 15)
            if !cookieHeader.isEmpty { req.setValue(cookieHeader, forHTTPHeaderField: "Cookie") }
            req.setValue(Self.desktopUA, forHTTPHeaderField: "User-Agent")
            req.setValue(Self.loginURL.absoluteString, forHTTPHeaderField: "Referer")
            URLSession.shared.dataTask(with: req) { [weak self] data, resp, error in
                DispatchQueue.main.async {
                    guard let self = self, !self.finished else { return }
                    if let error = error {
                        self.deliver(self.err(code: "captcha_failed", message: "Captcha image nahi aa payi (\(error.localizedDescription))."))
                        return
                    }
                    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
                    guard code == 200, let data = data, !data.isEmpty else {
                        self.deliver(self.err(code: "captcha_failed", message: "Captcha image HTTP \(code) — dobara try karein."))
                        return
                    }
                    let b64 = "data:image/png;base64," + data.base64EncodedString()
                    self.deliverCaptchaImage(b64)
                }
            }.resume()
        }
    }

    private func deliverCaptchaImage(_ dataUrl: String) {
        if wrongCapPending {
            wrongCapPending = false
            emitStep(errWithCaptcha(code: "captcha_wrong", message: "Captcha galat tha — naya captcha daalein.", captchaB64: dataUrl))
        } else {
            emitStep(okCaptcha(dataUrl))
        }
    }

    private func buildFindCaptchaScript() -> String {
        return #"""
        (function(){try{
          function vis(e){return !!(e&&e.offsetParent!==null);}
          var D=document,Q=function(s,r){return [].slice.call((r||D).querySelectorAll(s));},
          T=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\s+/g,' ').trim();},
          imgToDataUrl=function(m){try{if(!m)return '';if(m.tagName==='CANVAS')return m.toDataURL('image/png');
          if(!m.complete||!m.naturalWidth)return '';var c=D.createElement('canvas');c.width=m.naturalWidth;c.height=m.naturalHeight;
          c.getContext('2d').drawImage(m,0,0);return c.toDataURL('image/png');}catch(e){return (m&&m.src&&m.complete&&m.naturalWidth)?m.src:'';}},
          F=function(e,v){try{e.focus();var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
          if(d&&d.set)d.set.call(e,v);else e.value=v;
          ['input','keyup','change','blur'].forEach(function(n){e.dispatchEvent(new Event(n,{bubbles:true}));});
          try{if(window.angular){var s=angular.element(e).scope();if(s&&s.$apply)s.$apply();}}catch(a){}}catch(x){}};
          var B=T(D.body||D.documentElement),pw=null,u=null,cf=null;
          Q('input').forEach(function(e){var g=((e.type||'')+' '+(e.id||'')+' '+(e.name||'')+' '+(e.placeholder||'')).toLowerCase();
          if(!cf&&/captcha/.test(g))cf=e;else if(!pw&&(e.type==='password'||/pass|pwd/.test(g)))pw=e;
          else if(!u&&/user|login|gstin|id/.test(g)&&(e.type||'text')!=='hidden')u=e;});
          var cs='',di=D.getElementById('imgCaptcha')||D.querySelector('img[src*=captcha i],img[id*=captcha i]');
          if(di)cs=imgToDataUrl(di);
          if(!cs){Q('img,canvas').some(function(m){var id=((m.id||'')+' '+(m.src||'')+' '+(m.className||'')).toLowerCase();
          if(m.tagName==='CANVAS'||/captcha/.test(id)){cs=imgToDataUrl(m);return !!cs;}return false;});}
          if(!cs&&cf){var bx=cf.closest&&cf.closest('div,td,li,section,form');if(bx)Q('img,canvas',bx).some(function(m){cs=imgToDataUrl(m);return !!cs;});}
          if(pw&&cs)return JSON.stringify({t:'CAPTCHA',src:cs});
          if(pw&&!cs){if(u&&!window.__cgCapTrig){window.__cgCapTrig=1;F(u,'gstuser');try{pw.focus();pw.click();}catch(e){}}return JSON.stringify({t:'CAPWAIT'});}
          if(!pw&&/dashboard|logout|sign out|return dashboard/i.test(B))return JSON.stringify({t:'IN'});
          var hit=Q('button,a,input[type=button],input[type=submit]').some(function(b){if(!vis(b))return false;
          if(/^(LOGIN|LOG IN|SIGN IN|PROCEED|CONTINUE|CLICK HERE)/.test(T(b).toUpperCase())){try{b.click();}catch(e){}return true;}return false;});
          if(hit)return JSON.stringify({t:'CLICKLOGIN'});
          return JSON.stringify({t:'WAIT',u:String(location.href||'').slice(0,90),pw:!!pw,user:!!u,cap:!!cs});
        }catch(e){return JSON.stringify({t:'ERR',m:String((e&&e.message)||e)});}})()
        """#
    }

    private func buildAfterSubmitScript() -> String {
        return #"""
        (function(){try{
          var body=String(((document.body&&(document.body.innerText||document.body.textContent))||'')).replace(/\s+/g,' ');
          var otp=document.querySelector('input[name*=otp i],input[id*=otp i],input[placeholder*=OTP i]');
          if(otp)return JSON.stringify({t:'OTPREQ'});
          var hasPw=!!document.querySelector('input[type=password]');
          if(!hasPw&&/dashboard|logout|sign out|return dashboard/i.test(body))return JSON.stringify({t:'IN'});
          if(/invalid\s+captcha|wrong\s+captcha|captcha.*(mismatch|incorrect|invalid)|enter\s+valid\s+characters/i.test(body))return JSON.stringify({t:'WRONGCAP'});
          if(/invalid\s+(user\s*id|username|password)|user\s*id.*not\s*(valid|exist)|incorrect\s+password|account\s+locked/i.test(body))return JSON.stringify({t:'ERRMSG',msg:body.slice(0,140)});
          return JSON.stringify({t:'WAIT',u:String(location.href||'')});
        }catch(e){return JSON.stringify({t:'WAIT'});}})()
        """#
    }

    // MARK: - Payload Helpers

    private func okPayload(kind: String) -> String {
        var d: [String: Any] = ["ok": true, "source": "phone"]
        if kind == "loggedIn" { d["loggedIn"] = true }
        if kind == "otpRequired" { d["otpRequired"] = true }
        return Self.jsonString(d)
    }

    private func okCaptcha(_ b64: String) -> String {
        Self.jsonString(["ok": true, "source": "phone", "stage": "captcha", "captchaBase64": b64])
    }

    private func err(code: String, message: String) -> String {
        Self.jsonString(["ok": false, "source": "phone", "code": code, "error": message])
    }

    private func errWithCaptcha(code: String, message: String, captchaB64: String) -> String {
        Self.jsonString(["ok": false, "source": "phone", "code": code, "error": message, "captchaBase64": captchaB64])
    }

    private func emitStep(_ payload: String) {
        guard !finished else { return }
        awaitingUserInput = true
        stage = "await-user"
        cancelTimers()
        let rid = reqId
        DispatchQueue.main.async { [weak self] in
            self?.callback(rid, payload)
        }
    }

    private func deliver(_ payload: String) {
        guard !finished else { return }
        finished = true
        awaitingUserInput = false
        stage = "done"
        cancelTimers()
        let rid = reqId
        DispatchQueue.main.async { [weak self] in
            self?.callback(rid, payload)
        }
    }

    private func jsQuote(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
              let arr = String(data: data, encoding: .utf8),
              arr.count >= 2 else { return "\"\"" }
        return String(arr.dropFirst().dropLast())
    }

    private static func jsonString(_ obj: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
              let str = String(data: data, encoding: .utf8) else { return "{}" }
        return str
    }

    private static func parseJsonObject(_ raw: String) -> [String: Any]? {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj
    }
}
