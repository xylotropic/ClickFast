// Local OCR for control. Word ranges keep adjoining text/icons out of a target.
import Foundation
import CoreGraphics
import ImageIO
import Vision

struct Word: Codable {
 let text: String; let confidence: Float
 let x: Double; let y: Double; let width: Double; let height: Double
}
struct Line: Codable {
 let text: String; let confidence: Float
 let x: Double; let y: Double; let width: Double; let height: Double
 let words: [Word]
}
func recognize(_ path: String) throws -> [Line] {
 guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
       let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  throw NSError(domain: "local-vision", code: 1)
 }
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["en-US"]
 request.usesLanguageCorrection = false
 request.minimumTextHeight = 0.007
 try VNImageRequestHandler(cgImage: image).perform([request])
 let tokens = try NSRegularExpression(pattern: "\\S+")
 return (request.results ?? []).compactMap { observation -> Line? in
  guard let candidate = observation.topCandidates(1).first else { return nil }
  let value = candidate.string, b = observation.boundingBox
  let words: [Word] = tokens.matches(in: value, range: NSRange(value.startIndex..., in: value)).compactMap { match in
   guard let range = Range(match.range, in: value),
         let rectangle = try? candidate.boundingBox(for: range) else { return nil }
   let w = rectangle.boundingBox
   return Word(text: String(value[range]), confidence: candidate.confidence,
               x: w.minX, y: w.minY, width: w.width, height: w.height)
  }
  return Line(text: value, confidence: candidate.confidence,
              x: b.minX, y: b.minY, width: b.width, height: b.height, words: words)
 }.sorted { $0.y > $1.y }
}
struct Request: Decodable { let id: Int; let path: String }
struct Response: Encodable { let id: Int; let lines: [Line]?; let error: String? }
if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--worker" {
 while let line = readLine() {
  autoreleasepool {
   do {
    guard line.utf8.count < 16384 else { throw NSError(domain: "local-vision", code: 3) }
    let request = try JSONDecoder().decode(Request.self, from: Data(line.utf8))
    let response: Response
    do { response = Response(id: request.id, lines: try recognize(request.path), error: nil) }
    catch { response = Response(id: request.id, lines: nil, error: "Local screenshot OCR failed") }
    FileHandle.standardOutput.write(try JSONEncoder().encode(response))
    FileHandle.standardOutput.write(Data([10]))
   } catch {
    fputs("Invalid local OCR request\n", stderr)
   }
  }
 }
} else {
 do {
  guard CommandLine.arguments.count == 2 else { throw NSError(domain: "local-vision", code: 2) }
  FileHandle.standardOutput.write(try JSONEncoder().encode(recognize(CommandLine.arguments[1])))
 } catch { fputs("Local screenshot OCR failed\n", stderr); exit(1) }
}
