// Offline verification of screenshots obtained through the authorized CUA capture API.
import Foundation
import AppKit
import Vision
struct Line: Codable { let text: String; let confidence: Float; let x: Double; let y: Double; let width: Double; let height: Double }
do {
 guard (2...3).contains(CommandLine.arguments.count), let image = NSImage(contentsOfFile: CommandLine.arguments[1]), let original = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { throw NSError(domain: "mirror-ocr", code: 1) }
 var roi = CGRect(x: 0, y: 0, width: 1, height: 1)
 if CommandLine.arguments.count == 3 {
   let values = CommandLine.arguments[2].split(separator: ",").compactMap { Double($0) }
   guard values.count == 4, values.allSatisfy({ $0.isFinite }), values[0] >= 0, values[1] >= 0, values[2] > 0, values[3] > 0, values[0] + values[2] <= 1, values[1] + values[3] <= 1 else { throw NSError(domain: "mirror-ocr", code: 2) }
   roi = CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
 }
 guard let cg = original.cropping(to: CGRect(x: roi.minX * Double(original.width), y: roi.minY * Double(original.height), width: roi.width * Double(original.width), height: roi.height * Double(original.height))) else { throw NSError(domain: "mirror-ocr", code: 3) }
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["en-US"]
 request.usesLanguageCorrection = false
 request.minimumTextHeight = 0.007
 try VNImageRequestHandler(cgImage: cg).perform([request])
 let lines = (request.results ?? []).compactMap { observation -> Line? in
  guard let text = observation.topCandidates(1).first else { return nil }
  let b = observation.boundingBox
  return Line(text: text.string, confidence: text.confidence, x: roi.minX + b.minX * roi.width, y: 1 - roi.maxY + b.minY * roi.height, width: b.width * roi.width, height: b.height * roi.height)
 }.sorted { $0.y > $1.y }
 let data = try JSONEncoder().encode(lines)
 FileHandle.standardOutput.write(data)
} catch { fputs("Screenshot OCR failed\n", stderr); exit(1) }
