#!/usr/bin/env python3
"""Export inspected real-phone captures. No live input; raw frames remain private."""
import csv,hashlib,html,json,pathlib,subprocess,statistics
from PIL import Image,ImageDraw,ImageFont,ImageFilter
root=pathlib.Path(__file__).resolve().parents[1]
native_id='2026-11-11T23-48-27-389Z'
native=json.loads((root/'benchmarks/runs'/native_id/'results.json').read_text())
out=root/'benchmarks/runs/2026-11-11-operator-vs-mirroring';out.mkdir(exist_ok=True)
videos=out/'videos';videos.mkdir(exist_ok=True)
scratch=root/'benchmarks/private/operator-export';scratch.mkdir(exist_ok=True)
font=ImageFont.truetype(str(root/'.state/geist-medium.ttf'),22);small=ImageFont.truetype(str(root/'.state/geist-regular.ttf'),16)
mirrors=[]
for name in ['confirmed','confirmed-navigation-v2']:
 path=root/'benchmarks/private/operator-mirroring'/name
 data=json.loads((path/'results.json').read_text())
 mirrors.extend((path,r,data) for r in data['runs'] if r.get('ok'))
assert len(mirrors)==10 and len({r['id'] for _,r,_ in mirrors})==10
rows=[];movie_info=[]
def panel(task,mode,elapsed,frames,folder):
 work=scratch/(task+'-'+mode.replace(' / ','-').replace(' ','-'));work.mkdir(exist_ok=True)
 samples=[]
 for i,(path,t) in enumerate(frames):
  im=Image.open(path).convert('RGB');w,h=im.size;d=ImageDraw.Draw(im)
  if task.startswith('settings') and (path.name=='0000.png' or (mode=='Operator' and path.name in ['0000.jpg','0001.jpg'])):
   # Blur only the inspected AirPods owner-name and Wi-Fi-name regions.
   boxes=[(.16,.005,.70,.060),(.34,.165,.89,.205)] if mode=='Operator' else [(.10,.050,.73,.145),(.49,.235,.87,.280)]
   for left,top,right,bottom in boxes:
    box=(int(left*w),int(top*h),int(right*w),int(bottom*h))
    patch=im.crop(box).filter(ImageFilter.GaussianBlur(max(10,w*.035)))
    im.paste(patch,box)
  im.thumbnail((460,1000));canvas=Image.new('RGB',(500,1120),'#121212');d=ImageDraw.Draw(canvas)
  d.text((20,12),task,font=font,fill='#f2f2f0');d.text((20,43),mode,font=small,fill='#aaa')
  d.text((20,70),f'{max(0,t):.2f}s | verified {elapsed/1000:.3f}s',font=small,fill='#aaa')
  canvas.paste(im,((500-im.width)//2,100));d.text((20,1100),'VERIFIED',font=small,fill='#aaa')
  dest=work/f'{i:04}.png';canvas.save(dest);samples.append((dest,max(0,t)))
 lines=['ffconcat version 1.0']
 for i,(p,t) in enumerate(samples):
  duration=max(.001,samples[i+1][1]-t) if i+1<len(samples) else .75
  lines.extend([f"file '{p.name}'",f'duration {duration:.6f}'])
 lines.append(f"file '{samples[-1][0].name}'");concat=work/'frames.ffconcat';concat.write_text('\n'.join(lines)+'\n')
 video=work/'panel.mp4';length=max(samples[-1][1],elapsed/1000)+.75
 subprocess.run(['ffmpeg','-v','error','-y','-safe','0','-i',str(concat),'-vf','fps=10','-t',str(length),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an',str(video)],check=True)
 return video,length
for mirror_path,m,meta in mirrors:
 task=m['id'][3:];n=next(r for r in native['runs'] if r['task']==task and r['mode']=='burst');assert n['ok'] and n['verified'] and m['verified']
 nf=[(root/'benchmarks/private'/native_id/n['name']/f['file'],(f['requested_ms']+f['completed_ms'])/2000) for f in n['recording']['frames'] if f.get('file')]
 # Include the real ready screen at t=0; setup remains outside the task timer.
 mf=[(mirror_path/m['id']/m['setup_frames'][-1]['file'],0)]+[(mirror_path/m['id']/f['file'],(f['requested_ms']+f['completed_ms'])/2000) for f in m['frames']]
 a,al=panel(task,'Operator',n['elapsed_ms'],nf,None);b,bl=panel(task,'Apple Mirroring / CUA',m['elapsed_ms'],mf,None)
 length=max(al,bl);video=videos/(task+'.mp4')
 filt=f'[0:v]tpad=stop_mode=clone:stop_duration={length},trim=duration={length},setpts=PTS-STARTPTS[a];[1:v]tpad=stop_mode=clone:stop_duration={length},trim=duration={length},setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2[v]'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(a),'-i',str(b),'-filter_complex',filt,'-map','[v]','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(video)],check=True)
 subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]));assert not any(s['codec_type']=='audio' for s in probe['streams'])
 subprocess.run(['ffmpeg','-v','error','-y','-sseof','-0.2','-i',str(video),'-frames:v','1',str(videos/(task+'.jpg'))],check=True)
 rows.append({'task':task,'operator_ms':n['elapsed_ms'],'mirroring_ms':m['elapsed_ms'],'ratio':m['elapsed_ms']/n['elapsed_ms'],'operator_verified':True,'mirroring_verified':True,'operator_setup_ms':n['setup_ms'],'mirroring_setup_ms':m['setup_ms'],'native_run':n['name'],'mirroring_session':mirror_path.name,'mirroring_run':m['id'],'mirroring_harness_sha256':meta['harness_sha256'],'video':'videos/'+video.name})
 movie_info.append({'task':task,'file':'videos/'+video.name,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'duration_seconds':float(probe['format']['duration']),'full_decode_passed':True,'audio_streams':0,'native_frames':len(nf),'mirror_frames':len(mf)})
summary={'tasks':10,'operator_passed':10,'mirroring_passed':10,'operator_total_ms':sum(r['operator_ms'] for r in rows),'mirroring_total_ms':sum(r['mirroring_ms'] for r in rows)};summary['total_ratio']=summary['mirroring_total_ms']/summary['operator_total_ms']
report={'schema':1,'native_source_session':native_id,'native_source_commit':native['source_commit'],'native_source_dirty':native['source_dirty'],'native_source_files_sha256':native['source_files_sha256'],'summary':summary,'method':'Same physical iPhone 16 Pro Max/iOS26.5. Operator USB runner and ordinary Apple Mirroring through CUA measured separately, never concurrently. Known action plans on both paths. Warm task time includes actions and independent result verification; setup/app launch excluded. Native fresh AX verification; Mirroring Apple Vision plus Tesseract OCR. Calculator zero also checked against a visually verified real capture. Clock starting tab explicitly verified before timing. All ten confirmed pairs are shown; earlier failures retained separately. Native capture up to3fps; Mirroring capture after each action; video resamples these real frames at10fps with a final0.75s hold. No audio. Only the inspected Settings owner-name and Wi-Fi-name regions are blurred in public video. Clock screens are shown without masks. Original captures remain local.','limits':'One confirmed pair per task, ordered native suite then Mirroring suite. Different observation/capture costs are part of the control-path comparison; this is not raw touch latency, a human benchmark, a randomized controlled planner trial or evidence of all-app reliability. Warm timing omits development/recovery and app launch. Confirmed samples do not erase earlier failed attempts.','rows':rows,'recordings':movie_info}
(out/'results.json').write_text(json.dumps(report,indent=2)+'\n')
with (out/'comparison.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
md='# Operator versus Apple Mirroring\n\nTen real phone tasks, verified on both control paths. Total warm time: **%.3f s Operator / %.3f s Mirroring (%.2f×)**. One confirmed pair per task.\n\n| Task | Operator | Mirroring | Ratio | Recording |\n|---|---:|---:|---:|---|\n'%(summary['operator_total_ms']/1000,summary['mirroring_total_ms']/1000,summary['total_ratio'])
for r in rows:md+=f"| {r['task']} | {r['operator_ms']/1000:.3f}s | {r['mirroring_ms']/1000:.3f}s | {r['ratio']:.2f}× | [Video]({r['video']}) |\n"
md+='\n'+report['method']+'\n\n'+report['limits']+'\n\nThe controlled native burst on/off run passed20/20 and reduced total time for the seven calculations from16.307s to5.713s (2.85×). The stricter live JEV run passed4/10; it handed back on the other six. JEV is not the controller used for the Operator column here. See [development record](../../../docs/operator-performance.md).\n'
(out/'comparison.md').write_text(md)
cards=''.join(f'<article><h2>{html.escape(r["task"])}</h2><p>Operator {r["operator_ms"]/1000:.3f}s · Mirroring {r["mirroring_ms"]/1000:.3f}s · {r["ratio"]:.2f}×</p><video controls preload="none" playsinline poster="videos/{r["task"]}.jpg" src="{r["video"]}"></video></article>' for r in rows)
(out/'comparison.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Operator · real phone comparison</title><style>@font-face{font-family:Geist;src:url(../../../docs/brand/fonts/geist-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}@font-face{font-family:Geist;src:url(../../../docs/brand/fonts/geist-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}body{margin:0;background:#121212;color:#eee;font:16px Geist,system-ui;line-height:1.5}main{max-width:1100px;margin:70px auto;padding:0 24px}h1{font-size:48px;letter-spacing:-2px;margin:0}p{color:#aaa;max-width:850px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:30px}article{border-top:1px solid #333;padding-top:12px}h2{font-size:18px;font-weight:500}video{width:100%%;background:#121212}a{color:#ddd}</style><main><h1>Operator</h1><p>10 real phone tasks. Both paths verified. %.2f× lower total warm time in this recorded comparison.</p><p>Operator uses the native USB runner; the baseline uses ordinary Apple iPhone Mirroring through CUA. Both receive known short action plans. Setup is excluded and independent result verification is included. This is one sample per task, not a human speed claim. Small blurs conceal owner and network names in Settings. Sampled captures are replayed at10fps; this does not represent10fps capture.</p><p><a href="comparison.md">Method and results</a> · <a href="results.json">Raw metrics and video hashes</a></p><section>'%summary['total_ratio']+cards+'</section></main></html>')
print(json.dumps(summary))
