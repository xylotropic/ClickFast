#!/usr/bin/env python3
"""Encode captured screenshots after timing. Requires Pillow and ffmpeg, no runtime dependency."""
import argparse,json,pathlib,subprocess,csv,statistics,hashlib
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('session');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];pub=root/'benchmarks/runs'/args.session;private=root/'benchmarks/private'/args.session
report=json.loads((pub/'results.json').read_text());out=private/'videos';out.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/SFNS.ttf',22)
small=ImageFont.truetype('/System/Library/Fonts/SFNS.ttf',16)
rendered=[]
for run in report['runs']:
 frames=[f for f in run.get('recording',{}).get('frames',[]) if 'file' in f]
 if len(frames)<2 or not run.get('elapsed_ms'):continue
 path=private/run['name'];dest=path/'rendered';dest.mkdir(exist_ok=True)
 samples=[];blank=0
 for i,f in enumerate(frames):
  # Native JPEG decoding through Pillow also accepts the Apple encoder's uncommon metadata.
  im=Image.open(path/f['file']).convert('RGB');im.thumbnail((460,1000))
  if max(im.getextrema()[j][1]-im.getextrema()[j][0] for j in range(3))<8:blank+=1
  frame=Image.new('RGB',(500,1120),'#121212');d=ImageDraw.Draw(frame)
  d.text((20,12),run['task'],font=font,fill='#f2f2f0');d.text((20,43),run['mode'].upper(),font=small,fill='#aaa')
  midpoint=(f['requested_ms']+f['completed_ms'])/2
  d.text((20,70),f'{max(0,midpoint)/1000:.2f}s | measured {run["elapsed_ms"]/1000:.3f}s',font=small,fill='#aaa')
  frame.paste(im,((500-im.width)//2,100))
  label='VERIFIED' if run.get('ok') else 'FAILED / STOPPED';d.text((20,1100),label,font=small,fill='#aaa')
  file=dest/f'{i:04}.png';frame.save(file);samples.append((file,max(0,midpoint)/1000))
 concat=dest/'frames.ffconcat';lines=['ffconcat version 1.0']
 for i,(file,t) in enumerate(samples):
  duration=max(.001,samples[i+1][1]-t) if i+1<len(samples) else .75
  lines.extend([f"file '{file.name}'",f'duration {duration:.6f}'])
 lines.append(f"file '{samples[-1][0].name}'");concat.write_text('\n'.join(lines)+'\n')
 video=out/(run['name']+'.mp4')
 subprocess.run(['ffmpeg','-v','error','-y','-safe','0','-i',str(concat),'-vf','fps=25','-fps_mode','cfr','-t',str(samples[-1][1]+.75),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(video)],check=True)
 duration=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(video)]))['format']['duration']
 if abs(float(duration)-(samples[-1][1]+.75))>.06:raise RuntimeError('Encoded video duration does not preserve frame timestamps')
 rendered.append({'run':run['name'],'task':run['task'],'mode':run['mode'],'path':str(video.relative_to(root)),'frames':len(samples),'blank_frames':blank,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'duration_seconds':float(duration)})
for task in report['tasks']:
 pair={x['mode']:x for x in rendered if x['task']==task['name']}
 if len(pair)!=2:continue
 maximum=max(pair[x]['duration_seconds'] for x in pair);video=out/(task['name']+'-comparison.mp4')
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(root/pair['batch']['path']),'-i',str(root/pair['jev']['path']),'-filter_complex',f'[0:v]fps=10,tpad=stop_mode=clone:stop_duration={maximum},trim=duration={maximum},setpts=PTS-STARTPTS[a];[1:v]fps=10,tpad=stop_mode=clone:stop_duration={maximum},trim=duration={maximum},setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(video)],check=True)
 actual=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(video)]))['format']['duration'])
 if abs(actual-maximum)>.11:raise RuntimeError('Paired video duration is incorrect')
 video_info={'task':task['name'],'path':str(video.relative_to(root)),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'duration_seconds':actual}
 rendered.append(video_info)
(private/'recordings.json').write_text(json.dumps(rendered,indent=2)+'\n')
fields=['task','mode','ordinal','ok','elapsed_ms','setup_ms','actions','chooser_calls','verification_ms','reason','error']
with (pub/'comparison.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(report['runs'])
rows=[]
for t in report['tasks']:
 pair={r['mode']:r for r in report['runs'] if r['task']==t['name']};a=pair.get('batch',{});b=pair.get('jev',{})
 fmt=lambda r: f'{r["elapsed_ms"]/1000:.3f}s '+('✓' if r.get('ok') else 'FAILED') if r.get('elapsed_ms') else 'setup failed'
 rows.append(f'| {t["name"]} | {fmt(a)} | {fmt(b)} |')
(pub/'comparison.md').write_text('# Recorded comparison\n\nOne pair per task. Alternate mode order; recording on both sides. Setup excluded, fresh result verification included. Batch knows the correct steps; JEV selects from current permitted UI controls.\n\n| Task | Batch | JEV |\n|---|---:|---:|\n'+'\n'.join(rows)+'\n\nRaw videos, originals and frame timestamps are in the local ignored private session directory. Video resamples the ~3 fps capture; the final 0.75 second hold is outside the timer. Failed decisions and inputs are retained in results.json.\n')
print(json.dumps({'encoded_runs':sum('mode' in x for x in rendered),'paired_videos':sum('mode' not in x for x in rendered),'blank_frames':sum(x.get('blank_frames',0) for x in rendered)}))
