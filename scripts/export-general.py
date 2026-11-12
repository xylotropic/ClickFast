#!/usr/bin/env python3
"""Export timestamped phone frames without bars, crops, fabricated UI, or speed changes."""
import argparse, hashlib, html, json, pathlib, subprocess
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('session');p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];report=json.loads((root/'benchmarks/runs'/a.session/'results.json').read_text());raw=root/'benchmarks/private'/a.session
out=pathlib.Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);videos=out/'videos';videos.mkdir(exist_ok=True);work=root/'benchmarks/private'/('export-'+a.session);work.mkdir(exist_ok=True)
rows=[]
for run in report['runs']:
 frames=run.get('recording',{}).get('frames',[]);start=run.get('recording_warm_start_ms');elapsed=run.get('elapsed_ms')
 row={k:run.get(k) for k in ['task','name','mode','ok','verified','elapsed_ms','setup_ms','cleanup_ms','error','cleanup_error','phases','content_change','audio']}
 if start is None or elapsed is None:row['video_error']='No complete timed capture';rows.append(row);continue
 timed=[(f,(f['requested_ms']+f['completed_ms'])/2-start) for f in frames if f.get('file')]
 selected=[x for x in timed if 0<=x[1]<=elapsed];prior=[x for x in timed if x[1]<0]
 if prior:selected.insert(0,(prior[-1][0],0))
 if not selected:row['video_error']='No captured frames in the timed interval';rows.append(row);continue
 dest=work/run['name'];dest.mkdir(exist_ok=True);timeline=[];dimensions=None
 for i,(f,ms) in enumerate(selected):
  im=Image.open(raw/run['name']/f['file']).convert('RGB');w,h=im.size;dimensions=(w-w%2,h-h%2)
  target=dest/f'{i:04}.png';im.save(target);timeline.append((target,max(0,ms)/1000))
 lines=['ffconcat version 1.0']
 for i,(f,t) in enumerate(timeline):
  following=timeline[i+1][1] if i+1<len(timeline) else elapsed/1000
  lines.extend([f"file '{f.name}'",f'duration {max(.001,following-t):.6f}'])
 lines.append(f"file '{timeline[-1][0].name}'");concat=dest/'frames.ffconcat';concat.write_text('\n'.join(lines)+'\n')
 video=videos/(run['name']+'.mp4');w,h=dimensions
 subprocess.run(['ffmpeg','-v','error','-y','-safe','0','-i',str(concat),'-vf',f'scale={w}:{h},fps=20','-t',f'{elapsed/1000:.6f}','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(video)],check=True)
 subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
 row.update(video='videos/'+video.name,video_sha256=hashlib.sha256(video.read_bytes()).hexdigest(),source_frames=len(timeline),width=w,height=h,decode_verified=True)
 rows.append(row)
public={'source_session':a.session,'source_commit':report.get('source_commit'),'source_dirty':report.get('source_dirty'),'source_sha256':report.get('source_sha256'),'method':'Real physical-phone screenshots with original request/completion timestamps. Videos preserve measured wall time; sampled frames are repeated for playback, not interpolated. Setup and cleanup are excluded from these clips and retained in the private source. No artificial bars or overlays. These local exports retain the actual phone image. A failed or missing recording remains a failure. No Mirroring speed claim without a matched, verified baseline.','runs':rows}
(out/'results.json').write_text(json.dumps(public,indent=2)+'\n')
cards=''.join('<article><h2>'+html.escape(r['task'])+'</h2><p>'+('Verified' if r.get('ok') else 'Failed')+' · '+(f"{r['elapsed_ms']/1000:.3f}s" if r.get('elapsed_ms') else 'Incomplete')+'</p>'+('<video controls preload="none" playsinline src="'+r['video']+'"></video>' if r.get('video') else '<p>'+html.escape(r.get('video_error','No video'))+'</p>')+'</article>' for r in rows)
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ClickFast — recorded phone tests</title><style>body{margin:40px auto;padding:0 24px;max-width:1200px;background:#121212;color:#eee;font:16px system-ui}h1{letter-spacing:-1.5px}p{color:#aaa;line-height:1.5}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:32px}video{width:100%;height:auto;display:block}h2{font-size:18px;font-weight:500}article{border-top:1px solid #333}</style><h1>ClickFast</h1><p>Every recorded attempt, including failures. <a href="results.json">Measurements and method</a></p><section>'+cards+'</section>')
print(json.dumps({'attempts':len(rows),'verified':sum(bool(r.get('ok')) for r in rows),'videos':sum('video' in r for r in rows),'output':str(out)}))
