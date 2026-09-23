// Read actual screenshot pixels. Accessibility nodes are not visibility evidence.
import Foundation
import Vision
import ImageIO

var output: [[String: Any]] = []
let arguments = Array(CommandLine.arguments.dropFirst())
let englishFirst = arguments.first == "--english-first"
let paths = englishFirst ? Array(arguments.dropFirst()) : arguments
do {
    for path in paths {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        // Chinese must select the non-Latin recognizer; English remains supported.
        request.recognitionLanguages = englishFirst ? ["en-US", "zh-Hans"] : ["zh-Hans", "en-US"]
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
        let lines = (request.results ?? []).compactMap { observation -> [String: Any]? in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return ["text": candidate.string, "confidence": candidate.confidence,
                    "x": observation.boundingBox.minX, "y": observation.boundingBox.minY]
        }
        output.append(["path": path, "lines": lines])
    }
    let data = try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
} catch {
    fputs("Screenshot OCR failed: \(error)\n", stderr)
    exit(1)
}
