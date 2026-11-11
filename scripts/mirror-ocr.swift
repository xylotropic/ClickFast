// Offline verification of screenshots obtained through the authorized CUA capture API.
import Foundation
import AppKit
import Vision
struct Line: Codable { let text: String; let confidence: Float; let x: Double; let y: Double; let width: Double; let height: Double }
do {
 guard CommandLine.arguments.count == 2, let image = NSImage(contentsOfFile: CommandLine.arguments[1]), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { throw NSError(domain: "mirror-ocr", code: 1) }
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["en-US"]
 request.usesLanguageCorrection = false
 request.minimumTextHeight = 0.007
 try VNImageRequestHandler(cgImage: cg).perform([request])
 let lines = (request.results ?? []).compactMap { observation -> Line? in
  guard let text = observation.topCandidates(1).first else { return nil }
  let b = observation.boundingBox
  return Line(text: text.string, confidence: text.confidence, x: b.minX, y: b.minY, width: b.width, height: b.height)
 }.sorted { $0.y > $1.y }
 let data = try JSONEncoder().encode(lines)
 FileHandle.standardOutput.write(data)
} catch { fputs("Screenshot OCR failed\n", stderr); exit(1) }
