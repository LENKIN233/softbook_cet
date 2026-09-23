// Read actual screenshot pixels. Accessibility nodes are not visibility evidence.
import Foundation
import Vision
import ImageIO

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
        let observations = try recognize(url, englishFirst: englishFirst)
        var regions: [Int: [(VNRecognizedText, CGRect)]] = [:]
        let lines = try observations.map { original, box -> [String: Any] in
            var candidate = original
            // A lone wrapped glyph can be mistaken for a UI shape in the full
            // screen. Re-read its original pixels with less surrounding layout.
            // No expected answer or vocabulary is supplied to either OCR pass.
            if original.confidence < 0.5 && original.string.count <= 2 {
                let half = box.midX < 0.5 ? 0 : 1
                let region = CGRect(x: Double(half) * 0.5, y: 0, width: 0.5, height: 1)
                if region.contains(box) {
                    if regions[half] == nil { regions[half] = try recognize(url, region: region, englishFirst: englishFirst) }
                    for (retry, retryBox) in regions[half] ?? [] {
                        let overlap = box.intersection(retryBox)
                        let intersection = overlap.isNull ? 0 : overlap.width * overlap.height
                        let union = box.width * box.height + retryBox.width * retryBox.height - intersection
                        if union > 0 && intersection / union >= 0.6 &&
                            retry.string.count == original.string.count &&
                            retry.confidence >= 0.8 && retry.confidence > candidate.confidence {
                            candidate = retry
                        }
                    }
                }
            }
            var line: [String: Any] = ["text": candidate.string, "confidence": candidate.confidence,
                                      "x": box.minX, "y": box.minY]
            if candidate.string != original.string {
                line["pixel_refinement"] = ["original_text": original.string,
                                             "original_confidence": original.confidence,
                                             "method": "overlapping-region-ocr"]
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
