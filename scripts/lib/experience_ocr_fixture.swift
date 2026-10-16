// Synthetic counterexamples only. These pixels are never runtime UX evidence.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

struct Fixture: Decodable {
    let name: String
    let text: String
    let fontSize: Double
}
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let directory = URL(fileURLWithPath: CommandLine.arguments[2])
for fixture in try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: input)) {
    let width = 640, height = 400
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                            bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let font = CTFontCreateWithName("PingFangSC-Regular" as CFString, fixture.fontSize, nil)
    for (index, line) in fixture.text.components(separatedBy: "\n").enumerated() {
        let string = NSAttributedString(string: line, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1),
        ])
        context.textPosition = CGPoint(x: 80, y: 310 - Double(index) * fixture.fontSize * 1.5)
        CTLineDraw(CTLineCreateWithAttributedString(string), context)
    }
    let url = directory.appendingPathComponent(fixture.name + ".png")
    let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Fixture encoding failed") }
}
