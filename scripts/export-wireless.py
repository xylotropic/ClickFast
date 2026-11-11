#!/usr/bin/env python3
"""Export actual CUA captures. No reconstruction of phone UI; private originals stay local."""
import pathlib,json,subprocess,statistics,hashlib,csv,html
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[1]
private=root/'benchmarks/private/wireless-mirroring-2026-11-11'
public=root/'benchmarks/runs/2026-11-11-wireless-phone'
public.mkdir(exist_ok=True);(public/'recordings').mkdir(exist_ok=True)
(private/'videos').mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/SFNS.ttf',22)
small=ImageFont.truetype('/System/Library/Fonts/SFNS.ttf',17)
final=json.loads((private/'trials-final/results.json').read_text())
round1=[]
for folder in ['trials-v6','trials-v7']:
 d=json.loads((private/folder/'results.json').read_text())
 for run in d['runs']:
  if run.get('ok'):round1.append((folder,run))
round1={r['id']:(f,r) for f,r in round1}
assets=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def encode(folder,run,label,full=False):
 source=private/folder/run['id'];dest=private/'encoded-frames'/(label+('-full' if full else ''))/run['id'];dest.mkdir(parents=True,exist_ok=True)
 for old in dest.glob('*.png'):old.unlink()
 if full:
  items=[dict(f) for f in run['setup_frames']]+[{**f,'requested_ms':f['requested_ms']+run['setup_ms'],'completed_ms':f['completed_ms']+run['setup_ms']} for f in run['frames']]
 else:items=run['frames']
 samples=[]
 for i,f in enumerate(items):
  original=source/f['file'];im=Image.open(original).convert('RGB');w,h=im.size
  if full:
   im.thumbnail((460,1016));canvas=Image.new('RGB',(500,1140),'#121212');canvas.paste(im,((500-im.width)//2,108))
  else:
   # Keep only the real result card and input bar. Everything else may contain personal results.
   canvas=Image.new('RGB',(748,520),'#121212')
   card=im.crop((int(w*.035),int(h*.115),int(w*.965),int(h*.245)))
   bar=im.crop((int(w*.035),int(h*.902),int(w*.965),int(h*.970)))
   canvas.paste(card,((748-card.width)//2,140));canvas.paste(bar,((748-bar.width)//2,370))
  d=ImageDraw.Draw(canvas);d.text((20,14),run['id']+'  '+label,font=font,fill='#eee')
  d.text((20,45),f'Warm {run["elapsed_ms"]/1000:.3f}s  |  reset + warm {(run["setup_ms"]+run["elapsed_ms"])/1000:.3f}s',font=small,fill='#aaa')
  middle=(f['requested_ms']+f['completed_ms'])/2000
  d.text((20,74),f'Real iPhone capture {middle:.2f}s | '+('full private recording' if full else 'personal search results masked'),font=small,fill='#aaa')
  path=dest/f'{i:04}.png';canvas.save(path);samples.append((path,max(0,middle)))
 lines=['ffconcat version 1.0']
 for i,(p,t) in enumerate(samples):
  next_time=samples[i+1][1] if i+1<len(samples) else t+.04
  duration=max(.001,next_time-(0 if i==0 else t))
  lines.extend([f"file '{p.name}'",f'duration {duration:.6f}'])
 lines.append(f"file '{samples[-1][0].name}'");(dest/'frames.ffconcat').write_text('\n'.join(lines)+'\n')
 target_duration=samples[-1][1]+.04
 video=(private/'videos' if full else public/'recordings')/(run['id']+'-'+label+('.full.mp4' if full else '.mp4'))
 subprocess.run(['ffmpeg','-v','error','-y','-safe','0','-i',str(dest/'frames.ffconcat'),'-vf','fps=25','-fps_mode','cfr','-t',str(target_duration),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(video)],check=True)
 duration=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(video)]))['format']['duration'])
 if abs(duration-target_duration)>.08:raise RuntimeError('Video timestamps were not preserved')
 # Decode all frames; successful file creation alone is insufficient verification.
 subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 asset={'trial':run['id'],'round':label,'path':str(video.relative_to(root)),'sha256':digest(video),'duration_seconds':duration,'source_frames':len(items),'full_private':full}
 assets.append(asset)
 return video,duration
for run in final['runs']:
 f,first=round1[run['id']]
 left,ld=encode(f,first,'round-1');right,rd=encode('trials-final',run,'confirmation')
 encode('trials-final',run,'confirmation',full=True)
 duration=max(ld,rd);pair=public/'recordings'/(run['id']+'-comparison.mp4')
 filter=f'[0:v]tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration},setpts=PTS-STARTPTS[a];[1:v]tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration},setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2[v]'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(left),'-i',str(right),'-filter_complex',filter,'-map','[v]','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(pair)],check=True)
 subprocess.run(['ffmpeg','-v','error','-i',str(pair),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 assets.append({'trial':run['id'],'round':'comparison','path':str(pair.relative_to(root)),'sha256':digest(pair),'duration_seconds':duration,'full_private':False})
 print('EXPORTED',run['id'],flush=True)
# Sanitized data contains only controlled queries, numeric results, timestamps and file hashes.
report={**final,'source_commit_before_work':'3a9875bf658a8c7adc39d48f58db05fc5c5db5ef','recording_method':'Native CUA screenshot captures with request/completion timestamps; variable cadence around 2–3 fps, resampled to 25 fps for playback. Frames are actual phone images, not regenerated UI. Per-frame original hashes stay in the local private archive. Three-second result holds excluded from timings. Public videos preserve only result-card and query-bar regions; full recordings include reset and are local/private.','confirmation_harness_identical_to_repo':digest(root/'scripts/mirroring-benchmark.mjs')==final['harness_sha256'],'ocr_binary_sha256':digest(root/'.state/mirror-ocr'),'round1':[{'folder':round1[r['id']][0],**round1[r['id']][1]} for r in final['runs']]}
report['exporter_sha256']=digest(pathlib.Path(__file__))
report['privacy_mask']={'result_card':[.035,.115,.965,.245],'query_bar':[.035,.902,.965,.970],'meaning':'Only these normalized source rectangles remain; captions are separate from native pixels.'}
report['summary']={'confirmation_tasks':len(final['runs']),'confirmation_successes':sum(r['ok'] for r in final['runs']),'round1_tasks':len(round1),'round1_successes':len(round1),'confirmation_median_warm_ms':statistics.median(r['elapsed_ms'] for r in final['runs']),'confirmation_median_reset_plus_warm_ms':statistics.median(r['setup_ms']+r['elapsed_ms'] for r in final['runs']),'confirmation_median_reset_ms':statistics.median(r['setup_ms'] for r in final['runs']),'warm_range_ms':[min(r['elapsed_ms'] for r in final['runs']),max(r['elapsed_ms'] for r in final['runs'])]}
# Keep failed attempts alongside successes. No failures are replaced by successful retries.
report['earlier_attempts']=[]
for folder in ['trials','trials-v2','trials-v3','trials-v4','trials-v5','trials-v6','trials-v7']:
 d=json.loads((private/folder/'results.json').read_text())
 for r in d['runs']:
  report['earlier_attempts'].append({'folder':folder,'id':r['id'],'ok':r['ok'],'elapsed_ms':r.get('elapsed_ms'),'setup_ms':r.get('setup_ms'),'error':r.get('error'),'verification':r.get('verification')})
(public/'results.json').write_text(json.dumps(report,indent=2)+'\n')
(public/'recordings.json').write_text(json.dumps([a for a in assets if not a['full_private']],indent=2)+'\n')
original_hashes={str(p.relative_to(private)):digest(p) for folder in ['trials-v6','trials-v7','trials-final'] for p in (private/folder).glob('*/*.png')}
(private/'original-frame-hashes.json').write_text(json.dumps(original_hashes,indent=2)+'\n')
(private/'recordings.json').write_text(json.dumps(assets,indent=2)+'\n')
with (public/'comparison.csv').open('w') as f:
 w=csv.writer(f,lineterminator='\n');w.writerow(['task','query','expected','round1_warm_ms','confirmation_warm_ms','confirmation_reset_ms','confirmation_reset_plus_warm_ms','ok'])
 for r in final['runs']:w.writerow([r['id'],r['query'],r['expected'],round1[r['id']][1]['elapsed_ms'],r['elapsed_ms'],r['setup_ms'],r['setup_ms']+r['elapsed_ms'],r['ok']])
rows=[];md=[]
for r in final['runs']:
 first=round1[r['id']][1];link='recordings/'+r['id']+'-comparison.mp4'
 rows.append(f'<section><h2>{html.escape(r["query"])} → {r["expected"]}</h2><p>Round 1: {first["elapsed_ms"]/1000:.3f}s · Confirmation: {r["elapsed_ms"]/1000:.3f}s · Reset + confirmation: {(r["setup_ms"]+r["elapsed_ms"])/1000:.3f}s</p><video controls muted playsinline preload="metadata" src="{link}"></video></section>')
 md.append(f'| {r["query"]} | {r["expected"]} | {first["elapsed_ms"]/1000:.3f}s | {r["elapsed_ms"]/1000:.3f}s | {(r["setup_ms"]+r["elapsed_ms"])/1000:.3f}s | [video]({link}) |')
intro='10 real iPhone tasks, each completed twice over Apple iPhone Mirroring. These are Spotlight calculations and conversions. This is not proof of working arbitrary-app taps or native XCTest over Wi-Fi. Median warm result verification: 0.921s; median reset plus warm: 3.596s. Earlier failed attempts remain in results.json.'
(public/'comparison.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Real wireless iPhone trials</title><style>body{font:16px system-ui;background:#121212;color:#eee;max-width:1050px;margin:50px auto;padding:0 22px}h1{font-size:30px}h2{font-size:19px;font-weight:550}p{color:#aaa;line-height:1.6}section{margin:42px 0;padding-top:14px;border-top:1px solid #333}video{width:100%;background:#171717}a{color:#ddd}</style><h1>Real wireless iPhone trials</h1><p>'+intro+'</p><p>Left: first completed run. Right: confirmation with the final controller. Personal search results are masked; footage runs at its recorded wall-clock pace. Playback holds the shorter side at its final frame. Full private recordings include the navigation reset. No audio tracks.</p><p><a href="comparison.csv">CSV</a> · <a href="results.json">Complete logs and failures</a></p>'+''.join(rows)+'</html>')
(public/'comparison.md').write_text('# Real wireless iPhone trials\n\n'+intro+'\n\n| Query | Expected | First run | Confirmation | Reset + confirmation | Recording |\n|---|---:|---:|---:|---:|---|\n'+'\n'.join(md)+'\n\n[Video comparison page](comparison.html), [CSV](comparison.csv), [logs and earlier failures](results.json). One confirmation sample per task; no statistical latency or wired/wireless ratio is claimed. The final confirmation used one pinned harness across all ten. The first round used two revisions with the same timed input/verification path; setup guards were corrected between them.\n')
# A compact, actual-pixel contact sheet for visual verification.
sheet=Image.new('RGB',(1500,1100),'#121212');draw=ImageDraw.Draw(sheet)
for i,r in enumerate(final['runs']):
 frame=r['frames'][r['first_matching_frame']];im=Image.open(private/'trials-final'/r['id']/frame['file']).convert('RGB');w,h=im.size
 card=im.crop((int(w*.035),int(h*.115),int(w*.965),int(h*.245)));card.thumbnail((460,145))
 x=(i%3)*500+20;y=(i//3)*270+20
 draw.text((x,y),r['id']+' · '+f'{r["elapsed_ms"]/1000:.3f}s',font=font,fill='#eee');sheet.paste(card,(x,y+45))
 draw.text((x,y+210),r['query'],font=small,fill='#aaa')
sheet.save(public/'verified-results.png')
print(json.dumps(report['summary']))
