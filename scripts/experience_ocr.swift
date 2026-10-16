// Read actual screenshot pixels. Accessibility nodes are not visibility evidence.
import Foundation
import Vision
import ImageIO
import CoreGraphics

func containsHan(_ text: String) -> Bool {
    text.unicodeScalars.contains { (0x3400...0x9fff).contains($0.value) }
}

func isSubsequence(_ text: String, of other: String) -> Bool {
    var remaining = ArraySlice(Array(text))
    for character in other where remaining.first == character { remaining = remaining.dropFirst() }
    return remaining.isEmpty
}

func prefers(_ retry: VNRecognizedText, to candidate: VNRecognizedText) -> Bool {
    (retry.confidence >= 0.8 && retry.confidence > candidate.confidence) ||
    (retry.confidence >= 0.5 && retry.confidence >= candidate.confidence &&
     retry.string.count > candidate.string.count && isSubsequence(candidate.string, of: retry.string))
}

func recognizeLine(_ image: CGImage, box: CGRect, englishFirst: Bool, englishOnly: Bool = false) throws -> [(VNRecognizedText, CGRect)] {
    let height = box.height * Double(image.height)
    let rect = CGRect(x: box.minX * Double(image.width) - height,
                      y: (1 - box.maxY) * Double(image.height) - height * 0.3,
                      width: box.width * Double(image.width) + height * 2,
                      height: height * 1.6).integral
        .intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))
    guard let crop = image.cropping(to: rect) else { return [] }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = englishOnly ? ["en-US"] : englishFirst ? ["en-US", "zh-Hans"] : ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: crop).perform([request])
    return (request.results ?? []).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let local = observation.boundingBox
        let mapped = CGRect(x: (rect.minX + local.minX * rect.width) / Double(image.width),
                            y: 1 - (rect.minY + (1 - local.minY) * rect.height) / Double(image.height),
                            width: local.width * rect.width / Double(image.width),
                            height: local.height * rect.height / Double(image.height))
        return (candidate, mapped)
    }
}

func recognizeGlyph(_ image: CGImage, box: CGRect) throws -> VNRecognizedText? {
    // The detector may box only the inner strokes of an enclosed character.
    // Include one box-width/height of ORIGINAL pixels, without scaling or a
    // supplied vocabulary. Keep only one overlapping, confident character.
    let cropBox = CGRect(x: (box.minX - box.width) * Double(image.width),
                         y: (1 - box.maxY - box.height) * Double(image.height),
                         width: box.width * 3 * Double(image.width),
                         height: box.height * 3 * Double(image.height)).integral
        .intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))
    guard let crop = image.cropping(to: cropBox) else { return nil }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: crop).perform([request])
    let matches = (request.results ?? []).compactMap { observation -> VNRecognizedText? in
        guard let candidate = observation.topCandidates(1).first,
              candidate.string.count == 1, containsHan(candidate.string), candidate.confidence >= 0.8 else { return nil }
        let local = observation.boundingBox
        let mapped = CGRect(x: (cropBox.minX + local.minX * cropBox.width) / Double(image.width),
                            y: 1 - (cropBox.minY + (1 - local.minY) * cropBox.height) / Double(image.height),
                            width: local.width * cropBox.width / Double(image.width),
                            height: local.height * cropBox.height / Double(image.height))
        return mapped.contains(CGPoint(x: box.midX, y: box.midY)) ? candidate : nil
    }
    return matches.count == 1 ? matches[0] : nil
}

func recognize(_ url: URL, region: CGRect? = nil, englishFirst: Bool = false) throws -> [(VNRecognizedText, CGRect)] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = englishFirst ? ["en-US", "zh-Hans"] : ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = false
    if let region = region { request.regionOfInterest = region }
    try VNImageRequestHandler(url: url).perform([request])
    return (request.results ?? []).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        var box = observation.boundingBox
        // Vision reports boxes relative to the requested region.
        if let region = region {
            box = CGRect(x: region.minX + box.minX * region.width,
                         y: region.minY + box.minY * region.height,
                         width: box.width * region.width, height: box.height * region.height)
        }
        return (candidate, box)
    }
}

var output: [[String: Any]] = []
let arguments = Array(CommandLine.arguments.dropFirst())
let englishFirst = arguments.first == "--english-first"
let paths = englishFirst ? Array(arguments.dropFirst()) : arguments
do {
    for path in paths {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw NSError(domain: "ScreenshotOCR", code: 1)
        }
        let observations = try recognize(url, englishFirst: englishFirst)
        var regions: [Int: [(VNRecognizedText, CGRect)]] = [:]
        let lines = try observations.map { original, box -> [String: Any] in
            var candidate = original
            // Re-read original pixels with less surrounding layout. No expected
            // answer, vocabulary, or fuzzy text replacement is supplied.
            if containsHan(original.string) {
                let half = box.midX < 0.5 ? 0 : 1
                let region = CGRect(x: Double(half) * 0.5, y: 0, width: 0.5, height: 1)
                if region.contains(box) {
                    if regions[half] == nil { regions[half] = try recognize(url, region: region, englishFirst: englishFirst) }
                    for (retry, retryBox) in regions[half] ?? [] {
                        let overlap = box.intersection(retryBox)
                        let intersection = overlap.isNull ? 0 : overlap.width * overlap.height
                        let union = box.width * box.height + retryBox.width * retryBox.height - intersection
                        if union > 0 && intersection / union >= 0.6 &&
                            prefers(retry, to: candidate) {
                            candidate = retry
                        }
                    }
                }
                for (retry, retryBox) in try recognizeLine(image, box: box, englishFirst: englishFirst) {
                    let overlap = box.intersection(retryBox)
                    let intersection = overlap.isNull ? 0 : overlap.width * overlap.height
                    let union = box.width * box.height + retryBox.width * retryBox.height - intersection
                    if union > 0 && intersection / union >= 0.6 && prefers(retry, to: candidate) {
                        candidate = retry
                    }
                }
            }
            if !containsHan(original.string) && original.string.range(of: "[A-Za-z]", options: .regularExpression) != nil {
                for (retry, retryBox) in try recognizeLine(image, box: box, englishFirst: true, englishOnly: true) {
                    let overlap = box.intersection(retryBox)
                    let intersection = overlap.isNull ? 0 : overlap.width * overlap.height
                    let union = box.width * box.height + retryBox.width * retryBox.height - intersection
                    if union > 0 && intersection / union >= 0.6 && prefers(retry, to: candidate) {
                        candidate = retry
                    }
                }
            }
            if original.string.count == 1 && containsHan(original.string) && original.confidence <= 0.5,
               let glyph = try recognizeGlyph(image, box: box), glyph.confidence > candidate.confidence {
                candidate = glyph
            }
            var line: [String: Any] = ["text": candidate.string, "confidence": candidate.confidence,
                                      "x": box.minX, "y": box.minY]
            if candidate.string != original.string {
                line["pixel_refinement"] = ["original_text": original.string,
                                             "original_confidence": original.confidence,
                                             "method": "overlapping-original-pixels-ocr"]
            }
            return line
        }
        output.append(["path": path, "lines": lines])
    }
    let data = try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
} catch {
    fputs("Screenshot OCR failed: \(error)\n", stderr)
    exit(1)
}
