import AppKit
import Vision
import Foundation

struct Line: Codable { let text: String; let confidence: Float; let bbox: [Double] }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US"]
request.usesLanguageCorrection = true
request.minimumTextHeight = 0.004
do {
    try VNImageRequestHandler(url: url).perform([request])
    let lines = (request.results ?? []).compactMap { result -> Line? in
        guard let candidate = result.topCandidates(1).first else { return nil }
        let b = result.boundingBox
        return Line(text: candidate.string, confidence: candidate.confidence, bbox: [b.minX,b.minY,b.width,b.height])
    }
    let data = try JSONEncoder().encode(lines)
    print(String(data: data, encoding: .utf8)!)
} catch { fputs("\(error)\n", stderr); exit(1) }
