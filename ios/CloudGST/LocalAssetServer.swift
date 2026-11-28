import Foundation
import Network

/// Embedded loopback-only HTTP server (127.0.0.1) serving Bundle.main/app/
/// so WKWebView gets a stable HTTP origin (persistent localStorage, PDF.js worker, standard CORS fetch).
final class LocalAssetServer {
    static let preferredPort: UInt16 = 18472
    private let queue = DispatchQueue(label: "com.cloudgst.localserver", qos: .userInitiated)
    private var listener: NWListener?
    private let rootURL: URL
    private(set) var port: UInt16 = preferredPort
    private(set) var isReady = false

    init(rootURL: URL) {
        self.rootURL = rootURL.standardizedFileURL
    }

    var baseURL: URL {
        URL(string: "http://127.0.0.1:\(port)/index.html")!
    }

    func start(completion: @escaping (URL) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            if self.isReady, let l = self.listener, l.state == .ready {
                let url = self.baseURL
                DispatchQueue.main.async { completion(url) }
                return
            }
            self.startOnPort(Self.preferredPort, fallbackAllowed: true, completion: completion)
        }
    }

    func ensureRunning() {
        queue.async { [weak self] in
            guard let self = self else { return }
            if let l = self.listener, l.state == .ready { return }
            self.startOnPort(self.port, fallbackAllowed: true) { _ in }
        }
    }

    func stop() {
        queue.async { [weak self] in
            self?.listener?.cancel()
            self?.listener = nil
            self?.isReady = false
        }
    }

    private func startOnPort(_ targetPort: UInt16, fallbackAllowed: Bool, completion: @escaping (URL) -> Void) {
        listener?.cancel()
        listener = nil
        isReady = false

        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host("127.0.0.1"),
            port: NWEndpoint.Port(rawValue: targetPort)!
        )

        do {
            let newListener = try NWListener(using: params)
            var didComplete = false
            newListener.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready:
                    self.port = newListener.port?.rawValue ?? targetPort
                    self.isReady = true
                    if !didComplete {
                        didComplete = true
                        let url = self.baseURL
                        DispatchQueue.main.async { completion(url) }
                    }
                case .failed:
                    self.isReady = false
                    newListener.cancel()
                    if !didComplete && fallbackAllowed {
                        didComplete = true
                        self.startOnPort(targetPort + 1, fallbackAllowed: false, completion: completion)
                    }
                case .cancelled:
                    self.isReady = false
                default:
                    break
                }
            }
            newListener.newConnectionHandler = { [weak self] conn in
                self?.handleConnection(conn)
            }
            self.listener = newListener
            newListener.start(queue: queue)
        } catch {
            if fallbackAllowed {
                startOnPort(targetPort + 1, fallbackAllowed: false, completion: completion)
            }
        }
    }

    private func handleConnection(_ conn: NWConnection) {
        conn.start(queue: queue)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 32768) { [weak self] data, _, _, _ in
            guard let self = self else { conn.cancel(); return }
            guard let data = data, !data.isEmpty, let reqStr = String(data: data, encoding: .utf8) else {
                conn.cancel()
                return
            }
            let firstLine = reqStr.split(separator: "\r\n", maxSplits: 1).first ?? ""
            let parts = firstLine.split(separator: " ")
            let method = parts.count > 0 ? String(parts[0]) : "GET"
            var rawPath = parts.count > 1 ? String(parts[1]) : "/index.html"
            if let qIdx = rawPath.firstIndex(of: "?") {
                rawPath = String(rawPath[..<qIdx])
            }
            rawPath = rawPath.removingPercentEncoding ?? rawPath
            if rawPath == "/" || rawPath.isEmpty { rawPath = "/index.html" }
            while rawPath.hasPrefix("/") { rawPath.removeFirst() }

            let fileURL = self.rootURL.appendingPathComponent(rawPath).standardizedFileURL
            // Guard against path traversal outside bundle app/
            guard fileURL.path.hasPrefix(self.rootURL.path),
                  FileManager.default.fileExists(atPath: fileURL.path),
                  let body = try? Data(contentsOf: fileURL) else {
                let notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found"
                conn.send(content: notFound.data(using: .utf8), completion: .contentProcessed { _ in conn.cancel() })
                return
            }

            let mime = Self.mimeType(for: fileURL.pathExtension.lowercased())
            let header = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: \(mime)\r\n"
                + "Content-Length: \(body.count)\r\n"
                + "Cache-Control: no-cache\r\n"
                + "Connection: close\r\n\r\n"
            var response = Data(header.utf8)
            if method.uppercased() != "HEAD" {
                response.append(body)
            }
            conn.send(content: response, completion: .contentProcessed { _ in
                conn.cancel()
            })
        }
    }

    private static func mimeType(for ext: String) -> String {
        switch ext {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "ico": return "image/x-icon"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }
}
