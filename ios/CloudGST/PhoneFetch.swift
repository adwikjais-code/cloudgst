import UIKit
import WebKit

/// 📱 Phone/iPad mode 100% hidden background fetch (GSTR-2B + E-Commerce/TCS) & GSTR-1 JSON Upload.
/// Uses the exact same per-slot WKWebsiteDataStore as PhoneLogin(slot) for 5 parallel isolated tabs.
final class PhoneFetch: NSObject, WKNavigationDelegate, WKDownloadDelegate {
    typealias Callback = (_ requestId: String, _ payloadJson: String) -> Void

    private static let authDashboard = URL(string: "https://services.gst.gov.in/services/auth/dashboard")!
    private static let returnsDashboard = URL(string: "https://return.gst.gov.in/returns/auth/dashboard")!
    private static let desktopUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"
    private static let tickDelay: TimeInterval = 2.4
    private static let hardTimeoutSec: TimeInterval = 165

    private let slot: Int
    private let dataStore: WKWebsiteDataStore
    private let callback: Callback

    private var webView: WKWebView?
    private var reqId: String?
    private var fyLabel: String = ""
    private var monFull: String = ""
    private var monShort: String = ""
    private var ticks: Int = 0
    private var clicked: Bool = false
    private var finished: Bool = false
    private var retriedDirect: Bool = false
    private var netRetried: Bool = false
    private var lastToken: String = ""
    private var lastDiag: [String: Any]?
    private var uploadMode: Bool = false
    private var uploadFileName: String = "GSTR1.json"
    private var uploadJsonB64: String = ""
    private var downloadDestURL: URL?
    private var readingBlob: Bool = false
    private var tickWork: DispatchWorkItem?
    private var timeoutWork: DispatchWorkItem?
    private(set) var stage: String = "idle"

    var isBusy: Bool {
        reqId != nil && !finished
    }

    init(slot: Int, dataStore: WKWebsiteDataStore, callback: @escaping Callback) {
        self.slot = max(0, slot)
        self.dataStore = dataStore
        self.callback = callback
        super.init()
    }

    func start(id: String, fy: String, mon: String, host: UIView) {
        if isBusy {
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.callback(id, self.err(code: "busy", message: "Tab \(self.slot + 1) par fetch pehle se chal raha hai."))
            }
            return
        }
        resetState(id: id, fy: fy, mon: mon, upload: false)
        stage = "load"
        ensureWebView(host: host)
        webView?.load(URLRequest(url: Self.authDashboard))
        scheduleTimeout()
    }

    func startUploadGstr1(id: String, fy: String, mon: String, fileName: String, jsonBase64: String, host: UIView) {
        if isBusy {
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.callback(id, self.err(code: "busy", message: "Tab \(self.slot + 1) par kaam pehle se chal raha hai."))
            }
            return
        }
        let trimmed = jsonBase64.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.callback(id, self.err(code: "bad_json", message: "GSTR-1 JSON content missing hai."))
            }
            return
        }
        resetState(id: id, fy: fy, mon: mon, upload: true)
        uploadFileName = Self.sanitizeJsonName(fileName)
        uploadJsonB64 = trimmed
        stage = "upload_load"
        ensureWebView(host: host)
        webView?.load(URLRequest(url: Self.authDashboard))
        scheduleTimeout()
    }

    func destroy() {
        finished = true
        uploadJsonB64 = ""
        cancelTimers()
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        webView = nil
    }

    private func resetState(id: String, fy: String, mon: String, upload: Bool) {
        reqId = id
        fyLabel = fy.trimmingCharacters(in: .whitespacesAndNewlines)
        var m = mon.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if let cut = m.firstIndex(of: "(") {
            m = String(m[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        monFull = m
        monShort = m.count >= 3 ? String(m.prefix(3)) : m
        ticks = 0
        clicked = false
        finished = false
        retriedDirect = false
        netRetried = false
        uploadMode = upload
        uploadFileName = "GSTR1.json"
        uploadJsonB64 = ""
        readingBlob = false
        lastToken = ""
        lastDiag = nil
        cancelTimers()
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
        guard !finished else { return }
        injectBlobShim(webView)
        scheduleTick(delay: 0.9)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsErr = error as NSError
        if nsErr.code == NSURLErrorCancelled || nsErr.code == 102 { return }
        guard !finished else { return }
        if !netRetried {
            netRetried = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
                guard let self = self, !self.finished else { return }
                self.webView?.load(URLRequest(url: Self.authDashboard))
            }
            return
        }
        deliver(reqId, err(code: "network", message: "Phone mode: portal ka server hi nahi mila (\(nsErr.localizedDescription)). Internet/DNS check karein.\(diagText())"))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if !uploadMode, let url = navigationAction.request.url {
            if url.scheme == "blob" {
                decisionHandler(.cancel)
                startBlobCapture()
                return
            }
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if !uploadMode {
            let httpResp = navigationResponse.response as? HTTPURLResponse
            let disp = (httpResp?.allHeaderFields["Content-Disposition"] as? String)
                ?? (httpResp?.allHeaderFields["content-disposition"] as? String) ?? ""
            let mime = (navigationResponse.response.mimeType ?? "").lowercased()
            let isAttachment = disp.lowercased().contains("attachment")
                || mime.contains("zip")
                || mime.contains("octet-stream")
                || mime.contains("application/json")
                || !navigationResponse.canShowMIMEType
            if isAttachment {
                decisionHandler(.download)
                return
            }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    // MARK: - WKDownloadDelegate

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        stage = "download"
        let clean = suggestedFilename.replacingOccurrences(of: "/", with: "_")
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("cg_dl_s\(slot)_\(Int(Date().timeIntervalSince1970))_\(clean)")
        try? FileManager.default.removeItem(at: dest)
        downloadDestURL = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard !finished, let dest = downloadDestURL else { return }
        defer { try? FileManager.default.removeItem(at: dest) }
        guard let data = try? Data(contentsOf: dest) else {
            deliver(reqId, err(code: "download_failed", message: "Phone mode: downloaded file read nahi ho payi."))
            return
        }
        handleBytes(data)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        guard !finished else { return }
        deliver(reqId, err(code: "download_failed", message: "Phone mode: download fail (\(error.localizedDescription)). Dobara try karein."))
    }

    // MARK: - Blob Capture (TCS + client-side GSTR-2B blob downloads)

    private func injectBlobShim(_ view: WKWebView) {
        let shim = #"""
        (function(){try{
          if(window.__cgBlobShim)return;window.__cgBlobShim=1;
          var map={};var origCreate=URL.createObjectURL;
          URL.createObjectURL=function(b){var u=origCreate.call(URL,b);
          try{if(b&&b.size){map[u]=b;var fr=new FileReader();
          fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};
          fr.readAsDataURL(b);}}catch(e){}return u;};
          var origClick=HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click=function(){try{
          var h=this.getAttribute('href')||'';
          if(h.indexOf('blob:')===0){
            if(map[h]){var fr=new FileReader();fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};fr.readAsDataURL(map[h]);}
            else if(window.fetch){fetch(h).then(function(r){return r.blob();}).then(function(b){var fr=new FileReader();fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};fr.readAsDataURL(b);}).catch(function(){});}
          }}catch(e){}return origClick.call(this);};
        }catch(e){}})()
        """#
        view.evaluateJavaScript(shim, completionHandler: nil)
    }

    private func startBlobCapture() {
        guard !finished, !readingBlob else { return }
        readingBlob = true
        stage = "download"
        readBlobChunk(offset: 0, acc: "", retries: 0)
    }

    private func readBlobChunk(offset: Int, acc: String, retries: Int) {
        guard !finished, let wv = webView else { return }
        let ch = 200_000
        let js = "(function(){try{var s=window.__cgBlobB64||'';return s.slice(\(offset),\(offset + ch));}catch(e){return '';}})()"
        wv.evaluateJavaScript(js) { [weak self] value, _ in
            guard let self = self, !self.finished else { return }
            let chunk = (value as? String) ?? ""
            if chunk.isEmpty {
                if acc.count > 100, let data = Data(base64Encoded: acc, options: .ignoreUnknownCharacters) {
                    self.handleBytes(data)
                } else if offset == 0 && retries < 15 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                        self?.readBlobChunk(offset: 0, acc: acc, retries: retries + 1)
                    }
                } else {
                    self.readingBlob = false
                    self.deliver(self.reqId, self.err(code: "download_failed", message: "Phone mode: portal blob download data padh nahi paye. Dobara try karein."))
                }
                return
            }
            let nextAcc = acc + chunk
            if chunk.count < ch {
                if let data = Data(base64Encoded: nextAcc, options: .ignoreUnknownCharacters) {
                    self.handleBytes(data)
                } else {
                    self.deliver(self.reqId, self.err(code: "bad_file", message: "Phone mode: blob base64 invalid."))
                }
            } else {
                self.readBlobChunk(offset: offset + ch, acc: nextAcc, retries: retries)
            }
        }
    }

    private func checkInlineBlobIfReady() {
        guard !finished, !uploadMode, !readingBlob, let wv = webView else { return }
        wv.evaluateJavaScript("(window.__cgBlobB64 && window.__cgBlobB64.length) || 0") { [weak self] val, _ in
            guard let self = self, !self.finished, !self.readingBlob else { return }
            if let len = val as? Int, len > 60 {
                self.startBlobCapture()
            }
        }
    }

    // MARK: - Tick Loop

    private func scheduleTick(delay: TimeInterval) {
        tickWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.runTick() }
        tickWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func scheduleTimeout() {
        timeoutWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, !self.finished else { return }
            if self.uploadMode {
                if self.clicked {
                    self.deliver(self.reqId, self.err(code: "upload_timeout", message: "Phone mode: GSTR-1 JSON bhej di gayi par portal ka jawab nahi aaya. Portal par status check karein."))
                } else {
                    self.deliver(self.reqId, self.err(code: "timeout", message: "Phone mode: GSTR-1 upload page nahi khula (\(Int(Self.hardTimeoutSec))s)\(self.diagText())."))
                }
            } else if self.clicked {
                self.deliver(self.reqId, self.err(code: "download_timeout", message: "Phone mode: download shuru hui par file nahi aayi. Dobara try karein."))
            } else {
                self.deliver(self.reqId, self.err(code: "timeout", message: "Phone mode: portal ne \(Int(Self.hardTimeoutSec))s me page nahi diya\(self.diagText())."))
            }
        }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.hardTimeoutSec, execute: work)
    }

    private func cancelTimers() {
        tickWork?.cancel(); tickWork = nil
        timeoutWork?.cancel(); timeoutWork = nil
    }

    private func runTick() {
        guard !finished, let wv = webView else { return }
        ticks += 1
        let script = uploadMode ? buildUploadTickScript() : buildTickScript()
        wv.evaluateJavaScript(script) { [weak self] value, _ in
            guard let self = self, !self.finished else { return }
            let raw = (value as? String) ?? ""
            let parsed = Self.parseJsonObject(raw)
            let tok = (parsed?["t"] as? String) ?? raw.replacingOccurrences(of: "\"", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            if let p = parsed, (p["u"] != nil || p["b"] != nil) {
                self.lastDiag = p
            }
            self.lastToken = tok
            self.stage = (self.uploadMode ? "up:" : "poll:") + tok

            if tok.hasPrefix("ERR:") {
                self.deliver(self.reqId, self.err(code: "script_error", message: "Phone mode: portal page par script error (\(tok.dropFirst(4)))\(self.diagText())"))
                return
            }
            if tok == "LOGIN" {
                self.deliver(self.reqId, self.err(code: "login_required", message: "Is client ka GST portal login expire ho gaya — dobara try karein."))
                return
            }
            if tok == "UP_ERR" {
                let msg = (parsed?["msg"] as? String) ?? ""
                self.deliver(self.reqId, self.err(code: "upload_failed", message: "Portal ne GSTR-1 upload me error diya: \(msg.isEmpty ? "Upload reject hua" : msg)"))
                return
            }
            if tok == "UP_OK" {
                let verified = (parsed?["verified"] as? Bool) ?? false
                let alertText = (parsed?["msg"] as? String) ?? ""
                let rowArr = (parsed?["row"] as? [Any]) ?? []
                let p: [String: Any] = [
                    "ok": true,
                    "source": "phone",
                    "uploaded": true,
                    "verified": verified,
                    "message": verified
                        ? "GSTR-1 JSON iPad se portal par upload ho gayi (portal ne confirm kiya). Ab portal par summary check karke Submit & File (EVC/DSC) karein."
                        : "⚠️ GSTR-1 JSON portal ko bhej di gayi, par portal ki taraf se confirmation message padh nahi paya. Portal par upload status zaroor check karein.",
                    "portalStatus": [
                        "alertText": alertText,
                        "latestRow": rowArr
                    ]
                ]
                self.deliver(self.reqId, Self.jsonString(p))
                return
            }
            if tok == "UPLOADED_FILE" {
                self.clicked = true
            }
            if tok == "NOTGEN" {
                let p: [String: Any] = [
                    "ok": true,
                    "source": "phone",
                    "notGenerated2b": true,
                    "gstr2b": ["summary": NSNull()],
                    "warnings": ["GSTR-2B not generated this month"]
                ]
                self.deliver(self.reqId, Self.jsonString(p))
                return
            }
            if tok == "CLICKED" {
                self.clicked = true
                self.checkInlineBlobIfReady()
            } else if self.clicked && !self.uploadMode {
                self.checkInlineBlobIfReady()
            }
            if tok == "NONE" && self.ticks == 6 && !self.retriedDirect && !self.fyLabel.hasPrefix("TCS|") {
                self.retriedDirect = true
                wv.load(URLRequest(url: Self.returnsDashboard))
            }
            if self.ticks >= 60 {
                self.deliver(self.reqId, self.err(code: "timeout", message: "Phone mode: portal ne jawab nahi diya (aakhri: \(self.lastToken))\(self.diagText())"))
                return
            }
            self.scheduleTick(delay: Self.tickDelay)
        }
    }

    private func handleBytes(_ data: Data) {
        guard !finished else { return }
        guard let json = ZipJsonExtractor.extractJson(from: data), json.count >= 40 else {
            deliver(reqId, err(code: "bad_file", message: "Phone mode: download me valid JSON nahi mila."))
            return
        }
        let jsonData = Data(json.utf8)
        let p: [String: Any] = [
            "ok": true,
            "source": "phone",
            "gstr2b": [
                "jsonBase64": jsonData.base64EncodedString(),
                "fileName": "gstr2b.json",
                "bytes": jsonData.count
            ],
            "warnings": []
        ]
        deliver(reqId, Self.jsonString(p))
    }

    // MARK: - Portal Automation Scripts (exact parity with Android PhoneFetch.java)

    private func buildUploadTickScript() -> String {
        return """
        (function(){
        var out=function(t,extra){var b='';try{b=String((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim().slice(0,140);}catch(x){}
        var o={t:t,u:String(location.href||'').slice(0,120),b:b};if(extra)for(var k in extra)o[k]=extra[k];return JSON.stringify(o);};
        var vis=function(e){return !!(e&&e.offsetParent!==null);},
        flat=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();};
        try{var FY=\(jsQuote(fyLabel)),MONF=\(jsQuote(monFull)),MONS=\(jsQuote(monShort)),FNAME=\(jsQuote(uploadFileName)),B64=\(jsQuote(uploadJsonB64));
        var href=String(location.href||'').toLowerCase(),W=window,D=document,Q=(s,r)=>[...(r||D).querySelectorAll(s)],
        F=flat,V=vis,O=out,cl=e=>(e.click(),O('OPENING')),fv=(a,r)=>a.find(e=>V(e)&&r.test(F(e))),sv;
        if(href.includes('/login')||D.querySelector('[type=password]'))return O('LOGIN');
        var B=F(D.body);
        if(/access.?denied/i.test(href+B))return !W.__cA?(W.__cA=1,location='/services/auth/dashboard',O('OPENING')):O('LOGIN');
        Q('.modal button').forEach(b=>V(b)&&/REMIND|SKIP|CLOSE/i.test(F(b))&&b.click());
        var fi=D.querySelector('input[type="file"]');
        if(fi){
          if(!W.__cgUpSent){
            var tr0=D.querySelector('table tbody tr');W.__cgUpPrevRow=tr0?F(tr0):'';
            var bin=atob(B64),bytes=new Uint8Array(bin.length);
            for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
            var file=new File([bytes],FNAME,{type:'application/json'});
            var dt=new DataTransfer();dt.items.add(file);fi.files=dt.files;
            fi.dispatchEvent(new Event('input',{bubbles:true}));
            fi.dispatchEvent(new Event('change',{bubbles:true}));
            W.__cgUpSent=1;W.__cgUpTicks=0;return O('UPLOADED_FILE');
          }
          W.__cgUpTicks=(W.__cgUpTicks||0)+1;
          if(W.__cgUpTicks<2)return O('UP_WAIT');
          var alerts=Q('.alert-success,.alert-info,.alert-danger,.err,.text-danger,.alert-warning').filter(V).map(F).filter(Boolean);
          var alertText=alerts.join(' | ');
          var tr=D.querySelector('table tbody tr');
          var rowArr=tr?[...tr.querySelectorAll('td')].map(F):[];
          var rowStr=tr?F(tr):'';
          var ERR_RE=/\\b(error|failed|invalid|unable|reject|corrupt|mismatch|not\\s+valid|already\\s+filed|cannot\\s+be\\s+uploaded|something\\s+went\\s+wrong)\\b/i;
          var OK_RE=/\\b(success|uploaded|processed|in\\s+progress|accepted|reference|received|queued)\\b/i;
          if(alertText&&ERR_RE.test(alertText))return O('UP_ERR',{msg:alertText,row:rowArr});
          var comb=alertText+' '+rowStr;
          if(OK_RE.test(comb)&&(alertText||(rowStr&&rowStr!==W.__cgUpPrevRow)))return O('UP_OK',{verified:true,msg:alertText,row:rowArr});
          if(W.__cgUpTicks>=8)return O('UP_OK',{verified:false,msg:alertText,row:rowArr});
          return O('UP_WAIT');
        }
        var bs=Q('button,a'),al=Q('a,button,span,li');
        for(var b of bs){if(!V(b))continue;var t=F(b);
          if(/PREPARE\\s+OFFLINE/i.test(t)){
            for(var p=b.parentNode,h=0;p&&h<6;p=p.parentNode,h++){
              var pt=F(p);if(pt.length>1200)break;
              if(/GSTR-?1(?!A)\\b/i.test(pt)&&!/GSTR-?1A/i.test(pt))return !W.__cgUpPo?(W.__cgUpPo=1,b.click(),O('OPENING')):O('DASH');
            }
          }
        }
        var P=ss=>{if(!ss.length)return '';var ch=0,qn=('APRMAYJUNJULAUGSEPOCTNOVDECJANFEBMAR'.indexOf(MONS)/9|0)+1,
        qR=[0,/APR/,/JUL/,/OCT/,/JAN/],mR=MONS.length>2?new RegExp('(^|[^A-Z])'+MONS+'([^A-Z]|$)'):0;
        ss.forEach(sl=>{var ops=sl.options,at=F(sl).toUpperCase(),iF=/20\\d{2}/.test(at),iQ=/QUARTER|APR.*JUN/.test(at);
        for(var o=0;o<ops.length;o++){var ot=ops[o].text.toUpperCase().trim();if(/^$|SELECT/.test(ot))continue;
        if((iF&&ot.includes(FY))||(iQ&&qn&&(ot.includes('QUARTER '+qn)||qR[qn].test(ot)))||(!iF&&!iQ&&(ot.includes(MONF)||(mR&&mR.test(ot))))){
        if(sl.selectedIndex-o)sl.selectedIndex=o,sl.dispatchEvent(new Event('change',{bubbles:1})),ch=1;break;}}});
        return ch?O('SETTING'):(sv=fv(bs,/^SEARCH$/i))?(sv.click(),O('SEARCHED')):O('DASH');};
        if(href.includes('/returns')&&(sv=P(Q('select'))))return sv;
        if(sv=D.querySelector('a[href*="/returns/auth/dash"]'))return cl(sv);
        return (sv=fv(al,/^RETURNS? DASHBOARD$/i)||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');
        }catch(e){return O('ERR:'+e);}})()
        """
    }

    private func buildTickScript() -> String {
        return """
        (function(){
        var out=function(t){var b='';try{b=String((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim().slice(0,120);}catch(x){}
        return JSON.stringify({t:t,u:String(location.href||'').slice(0,120),b:b});};
        var vis=function(e){return !!(e&&e.offsetParent!==null);},
        flat=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();},
        sendJ=function(o){if(window.__cTD)return out('CLICKED');window.__cTD=1;o.p='0'.repeat(120);
        var j=JSON.stringify(o);window.__cgBlobB64=btoa(unescape(encodeURIComponent(j)));
        location.href=URL.createObjectURL(new Blob([j],{type:'application/octet-stream'}));return out('CLICKED');};
        try{var FY=\(jsQuote(fyLabel)),MONF=\(jsQuote(monFull)),MONS=\(jsQuote(monShort));
        var href=String(location.href||'').toLowerCase(),W=window,D=document,Q=(s,r)=>[...(r||D).querySelectorAll(s)],
        F=flat,V=vis,O=out,cl=e=>(e.click(),O('OPENING')),fv=(a,r)=>a.find(e=>V(e)&&r.test(F(e))),sv;
        if(href.includes('/login')||D.querySelector('[type=password]'))return O('LOGIN');
        var B=F(D.body);
        if(/access.?denied/i.test(href+B))return !W.__cA?(W.__cA=1,location='/services/auth/dashboard',O('OPENING')):O('LOGIN');
        Q('.modal button').forEach(b=>V(b)&&/REMIND|SKIP|CLOSE/i.test(F(b))&&b.click());
        var bs=Q('button,a'),al=Q('a,button,span,li');
        var P=ss=>{if(!ss.length)return '';var ch=0,qn=('APRMAYJUNJULAUGSEPOCTNOVDECJANFEBMAR'.indexOf(MONS)/9|0)+1,
        qR=[0,/APR/,/JUL/,/OCT/,/JAN/],mR=MONS.length>2?new RegExp('(^|[^A-Z])'+MONS+'([^A-Z]|$)'):0;
        ss.forEach(sl=>{var ops=sl.options,at=F(sl).toUpperCase(),iF=/20\\d{2}/.test(at),iQ=/QUARTER|APR.*JUN/.test(at);
        for(var o=0;o<ops.length;o++){var ot=ops[o].text.toUpperCase().trim();if(/^$|SELECT/.test(ot))continue;
        if((iF&&ot.includes(FY))||(iQ&&qn&&(ot.includes('QUARTER '+qn)||qR[qn].test(ot)))||(!iF&&!iQ&&(ot.includes(MONF)||(mR&&mR.test(ot))))){
        if(sl.selectedIndex-o)sl.selectedIndex=o,sl.dispatchEvent(new Event('change',{bubbles:1})),ch=1;break;}}});
        return ch?O('SETTING'):(sv=fv(bs,/^SEARCH$/i))?(sv.click(),O('SEARCHED')):O('DASH');};
        if(FY.startsWith('TCS|')){FY=FY.slice(4);
        var si=B.search(/TCS Credit Received - Summary/i),sb2=si<0?'':B.slice(si,si+1500),
        hG=/\\d{2}[A-Z]{5}\\d{4}[A-Z]\\w{3}/i.test(sb2);
        if(si>=0){
        if(!hG&&(W.__w=(W.__w||0)+1)<5&&!/no record/i.test(sb2))return O('DASH');
        return sendJ({__cgTcs:1,b:sb2,tables:Q('table').map(t=>({
        head:Q('thead tr',t).map(r=>[...r.cells].map(c=>({t:F(c),cs:c.colSpan||1,rs:c.rowSpan||1}))),
        body:Q('tbody tr',t).map(r=>[...r.cells].map(F))}))});}
        var cr;if(sv=Q('div,span,p,h2,h3,h4,h5,a,button,li').find(e=>{if(V(e)&&/^TCS credit received$/i.test(F(e)))
        for(var t,p=e,k=0;p&&k<5;p=p.parentNode,k++)if((t=F(p)).length<500&&/records/i.test(t)&&!/amend/i.test(t))return cr=p;})){
        var m=(W.__m=(W.__m||0)+1)%3;
        return cl(m==1?sv:m==2?cr:Q('*',cr).find(x=>/records/i.test(F(x))&&!x.children.length)||cr);}
        if(/tdstcs|TDS and TCS/i.test(href+B)){if(sv=fv(bs,/PREPARE ONLINE|^VIEW\\b/i))return cl(sv);if(sv=P(Q('select')))return sv;}
        return (sv=Q('a').find(a=>/TDS and TCS|tdstcs/i.test(F(a)+a.href))||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');}
        if(/no record for gstr.?2b|gstr.?2b.*not .*generated/i.test(B)||(/(not\\s+generated|could\\s+not\\s+be\\s+generated)/i.test(B)&&/2B/i.test(B)))return O('NOTGEN');
        for(var b of bs){if(!V(b))continue;var t=F(b);
        if(/GENERATE JSON FILE TO DOWNLOAD/i.test(t))return !W.__cG?(W.__cG=1,b.click(),O('CLICKED')):O('DASH');
        if(/DOWNLOAD/i.test(t))for(var p=b.parentNode,h=0;p&&h<5;p=p.parentNode,h++)if(/GSTR-?2B/i.test(F(p)))return b.click(),O('CLICKED');}
        if(href.includes('/returns')&&(sv=P(Q('select'))))return sv;
        if(sv=D.querySelector('a[href*="/returns/auth/dash"]'))return cl(sv);
        return (sv=fv(al,/^RETURNS? DASHBOARD$/i)||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');
        }catch(e){return O('ERR:'+e);}})()
        """
    }

    // MARK: - Helpers

    private func diagText() -> String {
        guard let d = lastDiag else { return "" }
        var out = ""
        if let u = d["u"] as? String, !u.isEmpty { out += " | page: \(u)" }
        if let b = d["b"] as? String, !b.isEmpty { out += " | text: \(b)" }
        return String(out.prefix(280))
    }

    private func err(code: String, message: String) -> String {
        Self.jsonString(["ok": false, "source": "phone", "code": code, "error": message])
    }

    private func deliver(_ id: String?, _ payload: String) {
        guard !finished else { return }
        finished = true
        uploadJsonB64 = ""
        cancelTimers()
        let rid = id ?? reqId ?? ""
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

    private static func sanitizeJsonName(_ raw: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
        var n = String(raw.trimmingCharacters(in: .whitespacesAndNewlines).unicodeScalars.map {
            allowed.contains($0) ? Character($0) : "_"
        })
        if n.isEmpty { n = "GSTR1.json" }
        if !n.lowercased().hasSuffix(".json") { n += ".json" }
        if n.count > 80 { n = String(n.suffix(80)) }
        return n
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
