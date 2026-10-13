from pathlib import Path
import json, shutil, zipfile, hashlib, subprocess, io, struct, sys, os
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT=Path(os.environ.get('COMPANION_REVIEW_WORKSPACE',Path.cwd())).resolve()
HEAD='4b98c5f657c3c3f919f111f5269b5e77cbedae3d';TREE='12c8c997cf0765b50df072cab6be00a2eb817e47';BASE='bb2727b85ca21d5205620fc571d2f63b9bbe67ce'
DELIVERY=ROOT/'deliverables/certified-4b98c5f';OUT=DELIVERY/'AI-Desktop-Companion-V4-4b98c5f-Complete-Review'
RAW=ROOT/'complete-evidence-4b98c5f'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if '--zip' in sys.argv:
 assert json.loads((OUT/'data/gallery-check.json').read_text())['passed']
 files=sorted(p for p in OUT.rglob('*') if p.is_file() and p.name!='FILE_SHA256SUMS.txt')
 (OUT/'FILE_SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(OUT).as_posix()}\n' for p in files))
 target=DELIVERY/(OUT.name+'.zip')
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(OUT.rglob('*')):
   if p.is_file():assert p.suffix.lower() not in ['.jar','.exe','.zip'];z.write(p,p.relative_to(OUT))
 with zipfile.ZipFile(target) as z:assert z.testzip() is None
 outputs=[DELIVERY/'AI-Desktop-Companion-V4-4b98c5f-Windows-x64-setup.exe',target,DELIVERY/'AI-Desktop-Companion-V4-4b98c5f-Verification.md']
 (DELIVERY/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in outputs))
 print('PASS complete ZIP CRC and file checksums');print((DELIVERY/'SHA256SUMS.txt').read_text());sys.exit(0)

source=next(p.parent.parent for p in RAW.rglob('manifest.json') if p.parent.name=='after')
before=json.loads((source/'before/manifest.json').read_text());after=json.loads((source/'after/manifest.json').read_text())
assert before['commit']==BASE and after['commit']==HEAD and after['sourceTree']==TREE
assert len(before['shots'])==174 and len(after['shots'])==174
assert len(before['clips'])==21 and len(after['clips'])==63
soak=json.loads((source/'data/soak.json').read_text());assert soak['commit']==HEAD and soak['resourcesStable'] and soak['wallClockMs']>=600000
food=json.loads((source/'data/food-renderer.json').read_text());assert [s['commit'] for s in food['sources']]==[BASE,HEAD] and not any(s['dirty'] for s in food['sources'])
assert '121' in (source/'logs/check.log').read_text()
assert '12 views with no enclosed pixel cracks' in (source/'logs/activities.log').read_text()
OUT.mkdir(parents=True,exist_ok=True)
for folder in ['before','after','data','logs']:shutil.copytree(source/folder,OUT/folder,dirs_exist_ok=True)
for version,manifest in [('before',before),('after',after)]:
 for clip in manifest['clips']:
  file=OUT/version/clip['file'];probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=nb_read_frames,width,height','-of','json',str(file)]))['streams'][0]
  assert int(probe['nb_read_frames'])==clip['frames'] and probe['width']==320 and probe['height']==400
  if clip['action'] not in ['idle','walk','run','sit']:assert clip['final']['sitPhase']=='standing' and clip['final']['propVisibility']==0
print('PASS all 84 complete actual-renderer movies and their recovery states')

font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,14) if Path(font_path).exists() else ImageFont.load_default()
for directory in ['comparisons','filmstrips','regressions','architecture']: (OUT/directory).mkdir(exist_ok=True)
background=(22,35,51,255)
def composite(path):
 im=Image.open(path).convert('RGBA');return Image.alpha_composite(Image.new('RGBA',im.size,background),im).convert('RGB')
actions=['idle','walk','run','wave','sit','jump','think','celebrate','look','read','eat','drink','inspect','nod','shrug','stretch','bow']
pixel_rows=[]
for shot in before['shots']:
 name=shot['file'];a=composite(OUT/'before'/name);b=composite(OUT/'after'/name);diff=ImageChops.difference(a,b);pixels=list(diff.getdata());pixel_rows.append({'file':name,'changedPixels':sum(any(v) for v in pixels),'maxChannelDelta':max(max(v) for v in pixels)})
preserved=[r for r in pixel_rows if r['file'].endswith('-drink.png') or r['file'].endswith('-read.png')]
assert len(preserved)==16 and all(r['changedPixels']==0 for r in preserved)
(OUT/'data/pixel-comparison.json').write_text(json.dumps({'method':'Screenshots composited on #162333','cases':pixel_rows,'bookAndDrinkingPixelIdentical':True},indent=2)+'\n')
for action in actions:
 sheet=Image.new('RGB',(640,440),(22,35,51));draw=ImageDraw.Draw(sheet);draw.text((10,8),f'{action}: previous / final — Classic front, actual renderer',font=font,fill='white')
 for col,version in enumerate(['before','after']):sheet.paste(composite(OUT/version/f'classic-front-{action}.png'),(col*320,32))
 sheet.save(OUT/'comparisons'/f'{action}.png')
def frames(path,indices):
 selector='+'.join(f'eq(n\\,{i})' for i in indices)
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vf',f'select={selector}','-vsync','0','-f','image2pipe','-vcodec','png','pipe:1'])
 chunks=[];at=0;signature=b'\x89PNG\r\n\x1a\n'
 while at<len(data):
  assert data[at:at+8]==signature;end=at+8
  while True:
   length=struct.unpack('>I',data[end:end+4])[0];kind=data[end+4:end+8];end+=length+12
   if kind==b'IEND':break
  chunks.append(Image.open(io.BytesIO(data[at:end])).convert('RGB'));at=end
 assert len(chunks)==len(indices);return chunks
for old in before['clips']:
 current=next(c for c in after['clips'] if c['action']==old['action'] and c['simulationHz']==60)
 sheet=Image.new('RGB',(1600,468),(22,35,51));draw=ImageDraw.Draw(sheet);draw.text((8,5),old['action']+' — before above / final below; decoded frames',font=font,fill='white')
 for row,(version,clip) in enumerate([('before',old),('after',current)]):
  indices=[round(i*(clip['frames']-1)/9) for i in range(10)]
  for col,(index,frame) in enumerate(zip(indices,frames(OUT/version/clip['file'],indices))):
   sheet.paste(frame.resize((160,200)),(col*160,28+row*220));draw.text((col*160+4,228+row*220),f'{index/30:.2f}s',font=font,fill='white')
 sheet.save(OUT/'filmstrips'/(old['action']+'.png'))
# Dense phase review complements whole-action strips, without synthesizing frames.
for name,action,start,end in [('book-equip','read',0,3.2),('book-page','read',10.1,12.2),('food-bites','eat',.6,3.3)]:
 clip=next(c for c in after['clips'] if c['action']==action and c['simulationHz']==60);indices=list(range(round(start*30),round(end*30)+1,3));images=frames(OUT/'after'/clip['file'],indices);rows=(len(images)+7)//8
 sheet=Image.new('RGB',(1280,rows*220+30),(22,35,51));draw=ImageDraw.Draw(sheet);draw.text((8,5),name+' — every 0.1s, actual decoded movie',font=font,fill='white')
 for n,(index,frame) in enumerate(zip(indices,images)):
  x=n%8*160;y=n//8*220+30;sheet.paste(frame.crop((80,60,240,260)),(x,y));draw.text((x+4,y+201),f'{index/30:.2f}s',font=font,fill='white')
 sheet.save(OUT/'filmstrips'/(name+'.png'))
legacy=ROOT/'deliverables/certified-bb2727b/review'
if legacy.exists():shutil.copytree(legacy,OUT/'previous-reference-review',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.exe','*.zip'))
expressive=ROOT/'motion-evidence/expressive-critical-4b98c5f'
eye_manifest=json.loads((expressive/'manifest.json').read_text());assert eye_manifest['commit']==HEAD and eye_manifest['expressiveEyes'] and len(eye_manifest['clips'])==7
shutil.copytree(expressive,OUT/'expressive-critical',dirs_exist_ok=True)
rejected=ROOT/'motion-evidence/mesh-final-after/prop-cake_slice-quarter.png'
if rejected.exists():shutil.copy(rejected,OUT/'regressions/corner-only-merge-rejected.png')
red=ROOT/'mesh-seams-red.log'
if red.exists():shutil.copy(red,OUT/'regressions/corner-only-gpu-failure.log')
repo=ROOT/'AI-Desktop-Companion'
for name in ['ANIMATION_FIDELITY_V4.md','ACTIVE_ANIMATIONS_AND_LOGIC_V4_DEV.md']:shutil.copy(repo/'docs'/name,OUT/'architecture'/name)
installer=DELIVERY/'AI-Desktop-Companion-V4-4b98c5f-Windows-x64-setup.exe';installer_hash=sha(installer);body=installer.read_bytes();pe=struct.unpack_from('<I',body,0x3c)[0];opt=pe+24;directory=opt+(112 if struct.unpack_from('<H',body,opt)[0]==0x20b else 96);assert struct.unpack_from('<II',body,directory+32)==(0,0)
assert HEAD in (DELIVERY/'BUILD_INFO.txt').read_text()
for name in ['BUILD_INFO.txt','windows-build84.log','source-browser-ci264.log']:shutil.copy(DELIVERY/name,OUT/'logs'/name)
table='| Food | Trial | Before completed p50 / p95 / p99 ms | Final completed p50 / p95 / p99 ms | Before → final triangles |\n|---|---|---:|---:|---:|\n'
for id in ['apple','cooked_porkchop','golden_carrot','cake_slice']:
 for trial in [1,2]:
  a,b=[next(c for c in food['cases'] if c['trial']==trial and c['food']==id and c['source']==version) for version in ['before','after']];stats=lambda c:' / '.join(f'{c["completedRenderMs"][p]:.2f}' for p in ['p50','p95','p99']);table+=f'| {id} | {trial} | {stats(a)} | {stats(b)} | {a["triangles"]} → {b["triangles"]} |\n'
counts=soak['samples'][-1];heaps=[s['usedHeap'] for s in soak['samples']]
cpu=json.loads((source/'data/cpu.json').read_text());cpu_table='| Action | Previous p50 / p95 / p99 µs | Final p50 / p95 / p99 µs |\n|---|---:|---:|\n'
for action in actions:
 a,b=[next(r for r in cpu['rows'] if r['action']==action and r['version']==version) for version in ['V3','V4']]
 stats=lambda r:' / '.join(f'{r[p]*1000:.2f}' for p in ['p50','p95','p99']);cpu_table+=f'| {action} | {stats(a)} | {stats(b)} |\n'
report=f'''# AI Desktop Companion V4 — complete final review

Exact implementation: {HEAD}. Tree: {TREE}. Optimization comparison: {BASE}.
Source and draft PR: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/10 . Main remains 004731af0bfb3c734b285cd236aebef34a06fdc0, unmerged.

## Implementation and appearance

All 17 authored actions remain in one BehaviorController and the canonical skinview3d/Three.js renderer. Original skin geometry/UVs, expressive eyes, blink, cursor gaze, Workspace and floating overlay remain. Original prototype audit and adopted/rejected concepts are recorded in architecture/ANIMATION_FIDELITY_V4.md.

The avatar sits before lifting a closed brown/gold book in its left palm. Its free right hand opens the book, lowers to rest and rises for turns at 10.6 and 20.6 seconds. Cream pages face the avatar eyes; the book closes, lowers and the avatar stands continuously. Default solid 3D apple, cooked chop, golden carrot and frosted cake require no import. Deliberate bites, chewing, crumbs and finishing fade remain. Drinking is preserved as accepted. Optional local art changes body/pale-frost colors while retaining geometry and semantic accents; no proprietary game files or owner skin are bundled.

Matching flat food surfaces merge while shared boundary vertices prevent T-junction cracks. The first corner-only merge was rejected after actual WebGL exposed pinholes. The corrected GPU gate passes twelve views with zero small enclosed missing pixels. Spatial fingerprints preserve every original colored unit face, its normal and exact Float32 color, with default and imported palettes. Whole-triangle tests check face/hat and jacket clearance throughout bites and interrupted recovery in Classic and Slim. Food triangles fall from 1380/936/824/1220 to 434/280/398/416 (apple/chop/carrot/cake), a 52–70% reduction. Each food still uses one cached mesh and material, with no per-frame construction.

## Tests and exact installer

121/121 tests, production build and Workspace/overlay, eyes and activity GPU suites pass. Original cadence/determinism/C1 continuity, interruption, sole-plane, original geometry/UV and resource checks remain. New coverage includes colored surface equivalence, outward nondegenerate triangles, no overlap/missing area, whole-triangle collision and actual raster cracks. Existing visibility thresholds are retained.

Source/browser CI: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38478915867 — passed.
Windows build 84: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38478915912 — passed.
Installer: {installer.name}. SHA-256: {installer_hash}. Size: {len(body):,} bytes.
BUILD_INFO identifies this exact source. The PE certificate table is empty: unsigned development NSIS installer. Its bootstrap is x86; the bundled app is Windows x64, as verified by bundle metadata and MSVC logs. Version remains 0.1.0-alpha.6.0; V4 names the animation milestone. The installer has not been run on the owner's PC.

## Actual-renderer evidence

Open index.html after extracting the entire ZIP. The complete review contains 174 PNGs/version, 21 previous and 63 final movies, 17 action comparisons, 21 whole-motion strips and 3 dense phase strips. All 17 activities and four interruption/stop/stand cases are present. Fixed poses show both model widths at front, ±45° and hand-side 90°. Final controllers sample 30/60/144 Hz and record each actual renderer frame at 30 fps authored time. All 84 movies decode every expected frame at 320×400 and satisfy recovery gates. The read includes 822 frames over 27.4 seconds. No generated or interpolated movie frames are used. This is reproducible motion evidence, not native presentation-FPS certification.

Sixteen paired reading/drinking actor images remain pixel-identical to the previous build. Other raster comparisons are in data/pixel-comparison.json; preserving geometric colored cells does not imply every antialiased edge pixel is identical. The previous-reference-review gallery preserves the 535993f→bb2727b book and solid-food redesign comparisons; those are historical source images, clearly labeled separately from this exact-source review.

The paired movies use the existing default base-face configuration. Seven extra exact-source clips enable the existing optional expressive-eye shader for reading, eating, drinking and four recovery cases. They show coordinated pupils and blinking without changing app defaults; the separate eye GPU suite verifies gaze/blink and neutral/disabled equality.

## Performance and resources

{food['method']}
Backend: Chromium {food['browser']} / ANGLE SwiftShader software WebGL. Conditions are identical and workloads run sequentially. The one-pixel readback forces completion and includes synchronization/readback overhead. Neither submission time nor this fenced total is native hardware GPU timing or display FPS. Timings vary between trials; no universal speedup is claimed. Raw CPU results cover all 17 controllers, with GC enabled, in data/cpu.json. Raw render submission and resource counts are in each capture manifest. The 60 active / 20 idle policy remains; changing it still requires device telemetry.

{table}

{cpu['backend']}. Raw V3 labels mean the previous bb2727b source; V4 means this final source. Controller values are microseconds, not milliseconds.

{cpu_table}

Exact-source resource test ran {soak['wallClockMs']/1000:.3f} seconds after 100 skin/model/import/reset/dispose/reinitialize lifecycles and {soak['actionRequests']} timed action requests. Final counts: {counts['geometries']} geometries and {counts['textures']} textures. Post-GC heap range: {max(heaps)-min(heaps):,} bytes ({min(heaps):,}–{max(heaps):,}). Bounded pools and cached geometry/material ownership remain. This supports reuse over the measured interval; it is not indefinite leak proof or native GPU-memory certification.

## Native acceptance remaining

Implemented and automated-tested: yes. Actual-renderer images and decoded motion sequences: reviewed. Native owner hardware certified: no. Owner acceptance and merge: pending.

On the owner's Windows x64/Ryzen 7 5700G/RTX 3050 PC, use the private local skin import, then review Classic/Slim, Workspace/transparent overlay, 100/150/200% DPI and available refresh rates. Review complete read/open/turn/close, all four foods, sip/empty/lower, idle breathing and every gesture; interrupt pages/sips and sit→stand→wave. Confirm eyes/blink/cursor pupils, hat layers, drag/click-through/tray, minimize/restore and context recovery. Measure actual active/idle presentation FPS and frame percentiles, CPU, GPU and memory with native tools. Fixed Minecraft arms still temporarily occlude items from the hand-side 90° camera. Real desktop-window awareness for Inspect remains a future milestone.

Reproduction: npm ci; npm run check; isolated Playwright 1.56.1 plus browser; ffmpeg/ffprobe on PATH; scripts/capture-motion.mjs --prop-details --clips --clip-rates=30,60,144; scripts/bench-food-renderer.mjs <previous repository> <output.json>; node --expose-gc scripts/bench-motion.mjs <previous repository> <output.json>; scripts/soak-motion.mjs <output.json>. The app never calls the evidence-only completion/readback fences.
'''
(OUT/'VERIFICATION.md').write_text(report);(DELIVERY/'AI-Desktop-Companion-V4-4b98c5f-Verification.md').write_text(report)
manifest={'source':HEAD,'sourceTree':TREE,'baseline':BASE,'actions':actions,'before':before,'after':after,'installerSha256':installer_hash,'nativeCertified':False};(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
script='''const M=__MANIFEST__,$=id=>document.getElementById(id);for(const a of [...M.actions,'interrupt-mid-book','interrupt-mid-drink','walk-stop','stand-up'])$('action').add(new Option(a,a));
function update(){const a=$('action').value,rate=+$('rate').value,mode=$('mode').value;for(const version of ['before','after']){const data=M[version];if(mode==='motion'){const clip=data.clips.find(c=>c.action===a&&c.simulationHz===(version==='before'?60:rate));$(version+'Video').src=version+'/'+clip.file;$(version+'Video').style.display='block';$(version+'Image').style.display='none';}else{const shot=data.shots.find(s=>s.action===a&&s.model===$('model').value&&s.view===$('view').value&&!s.file.startsWith('detail-'));$(version+'Video').pause();$(version+'Video').style.display='none';$(version+'Image').style.display='block';$(version+'Image').src=shot?version+'/'+shot.file:'';}$(version+'Video').playbackRate=+$('speed').value;} }
for(const id of ['action','mode','rate','model','view'])$(id).onchange=update;$('speed').onchange=()=>{for(const v of ['before','after'])$(v+'Video').playbackRate=+$('speed').value;};$('play').onclick=()=>Promise.all(['before','after'].map(v=>$(v+'Video').play()));update();'''.replace('__MANIFEST__',json.dumps(manifest))
html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AI Desktop Companion V4 complete review</title><style>body{background:#162333;color:#e8eef4;font:16px system-ui;margin:24px}h1{font-size:25px}select,button{padding:8px;margin:4px;color:inherit;background:#24384e;border:1px solid #557089;border-radius:5px}.pair{display:flex;gap:20px;flex-wrap:wrap}video,img.pose{width:320px;height:400px;background:#101b29}a{color:#83caff}.sheets{display:flex;flex-wrap:wrap;gap:12px}.sheets img{width:160px}p{max-width:1000px;line-height:1.5}</style><h1>AI Desktop Companion V4 — complete motion review</h1><p>Exact tested source 4b98c5f. Previous comparison bb2727b. All movies are actual renderer frames at 30 fps authored time. Native owner hardware acceptance remains pending.</p><p><a href="VERIFICATION.md">Verification and measured performance</a> · <a href="previous-reference-review/index.html">Earlier book/food redesign comparisons</a></p><label>Action<select id="action"></select></label><label>Review<select id="mode"><option value="motion">Motion</option><option value="pose">Fixed pose</option></select></label><label>Final simulation<select id="rate"><option>60</option><option>30</option><option>144</option></select></label><label>Speed<select id="speed"><option value="1">1×</option><option value=".5">½×</option><option value=".25">¼×</option></select></label><label>Model<select id="model"><option>classic</option><option>slim</option></select></label><label>View<select id="view"><option>front</option><option>left</option><option>right</option><option>side</option></select></label><button id="play">Play both</button><div class="pair"><div><h2>Previous</h2><video id="beforeVideo" controls muted preload="metadata"></video><img class="pose" id="beforeImage"></div><div><h2>Final</h2><video id="afterVideo" controls muted preload="metadata"></video><img class="pose" id="afterImage"></div></div><h2>Action comparisons</h2><div class="sheets">__SHEETS__</div><h2>Dense phase review</h2><p>__DENSE__</p><script>__SCRIPT__</script>'''
html=html.replace('__SCRIPT__',script).replace('__SHEETS__',''.join(f'<a href="comparisons/{a}.png"><img src="comparisons/{a}.png" alt="{a}"></a>' for a in actions)).replace('__DENSE__',' · '.join(f'<a href="filmstrips/{n}.png">{n}</a>' for n in ['book-equip','book-page','food-bites']))
eye_links='<h2>Optional expressive-eye motion</h2><p>'+ ' · '.join(f'<a href="expressive-critical/clips/{a}.webm">{a} with expressive eyes</a>' for a in ['read','eat','drink','interrupt-mid-book','interrupt-mid-drink','walk-stop','stand-up'])+'</p>'
html=html.replace('<h2>Dense phase review</h2>',eye_links+'<h2>Dense phase review</h2>')
(OUT/'index.html').write_text(html);(OUT/'README.txt').write_text('Extract the whole ZIP, open index.html. Read VERIFICATION.md for measured performance, exact installer provenance and native acceptance pending. Default 3D foods are included. No import is required.\n')
print('PASS complete gallery/report assembled; run browser gallery check, then this script --zip')
