import Foundation
import Compression

/// Extracts a JSON string from either raw UTF-8 JSON bytes or a ZIP archive containing a .json file
/// (using Apple's built-in Compression framework — zero external dependencies).
enum ZipJsonExtractor {
    static let maxDecompressedBytes = 25 * 1024 * 1024

    static func extractJson(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        let bytes = [UInt8](data)
        let isZip = bytes.count > 4 && bytes[0] == 0x50 && bytes[1] == 0x4B
        if !isZip {
            let text = (String(data: data, encoding: .utf8) ?? "")
                .replacingOccurrences(of: "\u{FEFF}", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if text.hasPrefix("{") || text.hasPrefix("[") { return text }
            return nil
        }

        // 1) Try reading from Central Directory (handles data descriptors where local header sizes == 0)
        if let json = extractFromCentralDirectory(bytes) {
            return json
        }
        // 2) Fallback: scan Local File Headers directly
        return extractFromLocalHeaders(bytes)
    }

    private static func u16(_ b: [UInt8], _ o: Int) -> Int {
        guard o + 1 < b.count else { return 0 }
        return Int(b[o]) | (Int(b[o + 1]) << 8)
    }

    private static func u32(_ b: [UInt8], _ o: Int) -> Int {
        guard o + 3 < b.count else { return 0 }
        return Int(b[o]) | (Int(b[o + 1]) << 8) | (Int(b[o + 2]) << 16) | (Int(b[o + 3]) << 24)
    }

    private static func extractFromCentralDirectory(_ b: [UInt8]) -> String? {
        // Locate End of Central Directory (0x06054b50) scanning backwards from end
        let minStart = max(0, b.count - 65557)
        var eocd = -1
        if b.count >= 22 {
            var i = b.count - 22
            while i >= minStart {
                if b[i] == 0x50 && b[i + 1] == 0x4B && b[i + 2] == 0x05 && b[i + 3] == 0x06 {
                    eocd = i
                    break
                }
                i -= 1
            }
        }
        guard eocd >= 0 else { return nil }
        let cdOffset = u32(b, eocd + 16)
        let cdSize = u32(b, eocd + 12)
        guard cdOffset >= 0 && cdOffset + cdSize <= b.count else { return nil }

        var pos = cdOffset
        let cdEnd = cdOffset + cdSize
        while pos + 46 <= cdEnd {
            guard b[pos] == 0x50 && b[pos + 1] == 0x4B && b[pos + 2] == 0x01 && b[pos + 3] == 0x02 else { break }
            let method = u16(b, pos + 10)
            let compSize = u32(b, pos + 20)
            let uncompSize = u32(b, pos + 24)
            let nameLen = u16(b, pos + 28)
            let extraLen = u16(b, pos + 30)
            let commentLen = u16(b, pos + 32)
            let localOffset = u32(b, pos + 42)
            let nameStart = pos + 46
            let nameEnd = nameStart + nameLen
            if nameEnd <= cdEnd {
                let name = (String(bytes: b[nameStart..<nameEnd], encoding: .utf8) ?? "").lowercased()
                if name.hasSuffix(".json") && localOffset + 30 <= b.count {
                    let lNameLen = u16(b, localOffset + 26)
                    let lExtraLen = u16(b, localOffset + 28)
                    let dataStart = localOffset + 30 + lNameLen + lExtraLen
                    if dataStart + compSize <= b.count {
                        let slice = Array(b[dataStart..<(dataStart + compSize)])
                        if let text = decodeEntry(slice, method: method, expectedSize: uncompSize) {
                            return text
                        }
                    }
                }
            }
            pos = nameEnd + extraLen + commentLen
        }
        return nil
    }

    private static func extractFromLocalHeaders(_ b: [UInt8]) -> String? {
        var pos = 0
        while pos + 30 <= b.count {
            guard b[pos] == 0x50 && b[pos + 1] == 0x4B && b[pos + 2] == 0x03 && b[pos + 3] == 0x04 else { break }
            let method = u16(b, pos + 8)
            let compSize = u32(b, pos + 18)
            let uncompSize = u32(b, pos + 22)
            let nameLen = u16(b, pos + 26)
            let extraLen = u16(b, pos + 28)
            let nameStart = pos + 30
            let dataStart = nameStart + nameLen + extraLen
            guard compSize > 0, dataStart + compSize <= b.count else { break }
            let name = (String(bytes: b[nameStart..<(nameStart + nameLen)], encoding: .utf8) ?? "").lowercased()
            if name.hasSuffix(".json") {
                let slice = Array(b[dataStart..<(dataStart + compSize)])
                if let text = decodeEntry(slice, method: method, expectedSize: uncompSize) {
                    return text
                }
            }
            pos = dataStart + compSize
        }
        return nil
    }

    private static func decodeEntry(_ compressed: [UInt8], method: Int, expectedSize: Int) -> String? {
        let rawData: Data?
        if method == 0 {
            rawData = Data(compressed)
        } else if method == 8 {
            rawData = inflateRawDeflate(compressed, expectedSize: expectedSize)
        } else {
            rawData = nil
        }
        guard let d = rawData else { return nil }
        let text = (String(data: d, encoding: .utf8) ?? "")
            .replacingOccurrences(of: "\u{FEFF}", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (text.hasPrefix("{") || text.hasPrefix("[")) ? text : nil
    }

    private static func inflateRawDeflate(_ src: [UInt8], expectedSize: Int) -> Data? {
        guard !src.isEmpty else { return nil }
        var dstCap = max(expectedSize + 1024, src.count * 6)
        dstCap = min(max(dstCap, 65536), maxDecompressedBytes)
        var dst = [UInt8](repeating: 0, count: dstCap)
        let decodedCount = src.withUnsafeBufferPointer { sPtr -> Int in
            guard let sBase = sPtr.baseAddress else { return 0 }
            return compression_decode_buffer(
                &dst, dstCap,
                sBase, src.count,
                nil,
                COMPRESSION_ZLIB
            )
        }
        guard decodedCount > 0 else { return nil }
        return Data(dst.prefix(decodedCount))
    }
}
