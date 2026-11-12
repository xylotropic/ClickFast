#!/usr/bin/env python3
"""Fault-inject the real native dispatch wrappers without sending phone input.

XCTest requires iOS. Compile the production wrapper bodies on the Mac with
simulated bridge/coordinate callbacks, then assert which backend was invoked.
This checks dispatch and replay behavior; it does not test hardware delivery.
"""
from pathlib import Path
import argparse
import subprocess
import sys
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('sources', nargs='?', type=Path,
                    default=Path(__file__).resolve().parent.parent / 'IPhoneUseRunner/IPhoneUseRunnerUITests')
parser.add_argument('--revision', help='Read production Swift from this Git revision to reproduce a failure')
args = parser.parse_args()
native = args.sources.resolve()
repo = (Path(subprocess.check_output(['git', '-C', str(native), 'rev-parse', '--show-toplevel'],
                                    text=True).strip()) if args.revision else None)
def source(name):
    if args.revision:
        return subprocess.check_output(['git', '-C', str(repo), 'show',
                                        f'{args.revision}:{(native / name).relative_to(repo)}'], text=True)
    return (native / name).read_text()

s=source('RunnerTests.swift');w=source('RunnerWDA.swift')
g=s[s.index('  func gesture('):s.index('\n  func coordinate(')]
t=s[s.index('  func typeText('):s.index('\n  func home()')]
k=w[w.index('  func typeIntoFocus('):w.index('\n  /// WebDriver encodes')]
a=w[w.index('  private func performActions('):w.index('\n  // MARK: - Device and apps')]
prefix=r'''import Foundation
final class XCUIApplication { func typeText(_ text:String) { Probe.calls.append("fallback") } }
enum RunnerError:Error { case failed(String); case invalidArgument(String) }
struct HTTPResponse { static func value(_ value:Any,headers:[String:String]=[:])->HTTPResponse { HTTPResponse() } }
struct HTTPRequest { func jsonObject()throws->[String:Any] {["text":"abc","actions":[["type":"pointer","actions":[["type":"pointerMove","x":100,"y":100],["type":"pointerDown"],["type":"pointerUp"]]]]]} }
enum Probe { static var calls:[String]=[]; static var available=true; static var error:String?="lost receipt" }
enum IPURBridge {
 static func eventSynthesisAvailable()->Bool { Probe.available }
 static func textSynthesisAvailable()->Bool { Probe.available }
 static func synthesizeText(_ text:String,charactersPerSecond:UInt,pid:Int32)->String? {Probe.calls.append("synthesize");return Probe.error}
 static func synthesizeTouchPaths(_ paths:[[[String:Any]]],name:String)->String? {Probe.calls.append("synthesize");return Probe.error}
 static func performWithoutQuiescence(_ app:XCUIApplication,_ body:()->Void) {body()}
 static func catchException(_ body:()->Void)->String? {body();return nil}
 static func invalidateRequestCache() {}
}
struct Foreground {var application=XCUIApplication()}
struct FakeNode {var center=CGPoint(x:100,y:100)}
final class Harness {
 var recordedIssues:[String]=[]
 func foreground()->Foreground {Foreground()}
 func timed<T>(_ label:String,_ work:()->T)->T {work()}
 func number(_ body:[String:Any],_ key:String)->Double? {nil}
 static func mapWebDriverKeys(_ text:String)->String {text}
 func windowSizePoints()->CGSize {CGSize(width:400,height:800)}
 func freshNode(_ id:String)throws->FakeNode {FakeNode()}
 func tapPoint(_ point:CGPoint)throws {Probe.calls.append("fallback")}
 func testActions()throws { _=try performActions(HTTPRequest()) }
'''
suffix=r'''
}
var failures=0
for mode in ["uncertain","success","unavailable"] {
 for operation in ["tap","text","keys","actions"] {
  Probe.calls=[];Probe.available=mode != "unavailable";Probe.error=mode=="success" ? nil:"receipt lost after dispatch"
  var threw=false
  do {
   switch operation {
    case "tap": _=try Harness().gesture("tap",synthesized:{Probe.calls.append("synthesize");return Probe.error}){_ in Probe.calls.append("fallback")}
    case "text": _=try Harness().typeText(HTTPRequest())
    case "keys": _=try Harness().typeIntoFocus("abc")
    default: try Harness().testActions()
   }
  } catch {threw=true}
  let expected=mode=="unavailable" ? ["fallback"]:["synthesize"]
  let ok=Probe.calls==expected && threw==(mode=="uncertain")
  print("\(ok ? "PASS" : "FAIL") \(operation) \(mode): \(Probe.calls), threw=\(threw)")
  if !ok {failures+=1}
 }
}
exit(failures==0 ? 0:1)
'''
with tempfile.TemporaryDirectory(prefix='clickfast-input-repro-') as out:
 p=Path(out);(p/'main.swift').write_text(prefix+g+'\n'+t+'\n'+k+'\n'+a+suffix)
 (p/'RunnerActions.swift').write_text(source('RunnerActions.swift'))
 r=subprocess.run(['xcrun','swiftc','-O',str(p/'RunnerActions.swift'),str(p/'main.swift'),'-o',str(p/'repro')],capture_output=True,text=True)
 if r.returncode:print(r.stderr);sys.exit(r.returncode)
 sys.exit(subprocess.run([str(p/'repro')]).returncode)
