from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
from io import BytesIO
import base64,hashlib,json,re,shutil,struct,subprocess,sys,zipfile
ROOT=Path(sys.argv[1]).resolve();CANDIDATE=Path(sys.argv[2]).resolve()
HEAD='bb2727b85ca21d5205620fc571d2f63b9bbe67ce';TREE='5bfd0e5308519c48ca636be4cff5e8828fab6403';BASE='535993fbc50f4a4c5a965d44f923fbfb23b688e0'
PREFIX='AI-Desktop-Companion-V4-bb2727b';OUT=ROOT/(PREFIX+'-Reference-Review');PUBLISH=ROOT/'publish'
OUT.mkdir(exist_ok=True);PUBLISH.mkdir(exist_ok=True)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if '--zip' in sys.argv:
    assert json.loads((OUT/'data/gallery-check.json').read_text())['passed']
    files=sorted(p for p in OUT.rglob('*') if p.is_file() and p.name!='FILE_SHA256SUMS.txt')
    (OUT/'FILE_SHA256SUMS.txt').write_text(''.join(digest(p)+'  '+p.relative_to(OUT).as_posix()+'\n' for p in files))
    destination=PUBLISH/(PREFIX+'-Reference-Review.zip')
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(OUT.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(OUT))
    with zipfile.ZipFile(destination) as z:
        assert z.testzip() is None
        for line in z.read('FILE_SHA256SUMS.txt').decode().splitlines():
            sha,name=line.split('  ',1);assert hashlib.sha256(z.read(name)).hexdigest()==sha
        assert not any(n.endswith(('.jar','.zip')) for n in z.namelist())
    (PUBLISH/'SHA256SUMS.txt').write_text(''.join(digest(p)+'  '+p.name+'\n' for p in sorted(PUBLISH.iterdir()) if p.is_file() and p.name!='SHA256SUMS.txt'))
    print('PASS packaged CRC, every checksum and no raw game archives');print('REVIEW_ZIP_SHA256='+digest(destination));sys.exit(0)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=CANDIDATE,text=True).strip()==HEAD
for folder in ['comparisons','filmstrips','data','logs','installer']:(OUT/folder).mkdir(exist_ok=True)
for v in ['before','after']:shutil.copytree(ROOT/v,OUT/v,dirs_exist_ok=True)
for folder in ['logs','data']:shutil.copytree(ROOT/folder,OUT/folder,dirs_exist_ok=True)
(OUT/'after/smokes').mkdir(exist_ok=True)
for p in (CANDIDATE/'smoke-artifacts').glob('*.png'):shutil.copy2(p,OUT/'after/smokes'/p.name)
manifests={}
for v,sha in [('before',BASE),('after',HEAD)]:
    d=json.loads((OUT/v/'manifest.json').read_text());assert d['commit']==sha;assert len(d['shots'])==60;manifests[v]=d
    for clip in d['clips']:
        p=OUT/v/clip['file'];decoded=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=nb_read_frames,width,height:format=duration','-of','json',str(p)]));s=decoded['streams'][0]
        assert int(s['nb_read_frames'])==clip['frames'] and s['width']==320 and s['height']==400
        assert clip['final']['action']=='idle' and clip['final']['sitPhase']=='standing' and clip['final']['propVisibility']==0
        clip['decodedDuration']=float(decoded['format']['duration'])
    (OUT/v/'manifest.json').write_text(json.dumps(d,indent=2))
assert len(manifests['before']['clips'])==7 and len(manifests['after']['clips'])==21
print('PASS all 28 videos: every expected frame, correct size and complete idle recovery')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12);BG='#162333';FG='#e7edf4'
for model in ['classic','slim']:
    for view in ['front','left','right','side']:
        im=Image.new('RGB',(640,1300),BG);draw=ImageDraw.Draw(im);draw.text((10,8),f'Before / after - {model} - {view} - actual renderer',font=font,fill=FG)
        for i,a in enumerate(['read','eat','drink']):
            y=35+i*420
            for j,v in enumerate(['before','after']):
                im.paste(Image.open(OUT/v/f'{model}-{view}-{a}.png').convert('RGB'),(j*320,y+20));t=5 if a=='read' else 1.45 if a=='eat' else 1.9;draw.text((j*320+8,y),f'{a} - {v} - t={t:.2f}s',font=small,fill=FG)
        im.save(OUT/'comparisons'/f'{model}-{view}.png')
for label,ids in [('food-volumes',['apple','cooked_porkchop','golden_carrot','cake_slice']),('book-style',['book-closed','book-open'])]:
    im=Image.new('RGB',(640,30+len(ids)*420),BG);draw=ImageDraw.Draw(im);draw.text((10,8),f'{label} - each version production geometry / canonical lighting',font=font,fill=FG)
    for i,id in enumerate(ids):
        y=30+i*420
        for j,v in enumerate(['before','after']):
            im.paste(Image.open(OUT/v/f'prop-{id}-quarter.png').convert('RGB'),(j*320,y+20));draw.text((j*320+8,y),f'{id} - {v}',font=small,fill=FG)
    im.save(OUT/'comparisons'/f'{label}.png')
shots=['read-enter','read-closed-lift','read-open','read-calm','read-preturn','read-page-50','read-regrip','read-close']
im=Image.new('RGB',(1280,570),BG);draw=ImageDraw.Draw(im);draw.text((10,8),'Reading choreography - authored phases - before / after',font=font,fill=FG)
for i,a in enumerate(shots):
    x=i%4*320;y=40+i//4*265;draw.text((x+8,y),a,font=small,fill=FG)
    for j,v in enumerate(['before','after']):
        im.paste(Image.open(OUT/v/f'detail-{a}.png').convert('RGB').resize((160,200),Image.Resampling.LANCZOS),(x+j*160,y+20));draw.text((x+j*160+5,y+224),v,font=small,fill=FG)
im.save(OUT/'comparisons/reading-choreography.png')
actions=['read','eat','drink','interrupt-mid-book','interrupt-mid-drink','walk-stop','stand-up']
for a in actions:
    im=Image.new('RGB',(1440,465),BG);draw=ImageDraw.Draw(im);draw.text((10,8),f'{a} - decoded motion frames - before above / after below',font=font,fill=FG)
    for row,v in enumerate(['before','after']):
        path=OUT/v/'clips'/f'{a}.webm';duration=next(x['decodedDuration'] for x in manifests[v]['clips'] if x['file']=='clips/'+a+'.webm')
        for j in range(10):
            t=min(duration-.08,j*(duration-.1)/9);data=subprocess.check_output(['ffmpeg','-v','error','-ss',str(t),'-i',str(path),'-frames:v','1','-f','image2pipe','-vcodec','png','-threads','1','-'])
            im.paste(Image.open(BytesIO(data)).convert('RGB').resize((144,180),Image.Resampling.LANCZOS),(j*144,40+row*210));draw.text((j*144+5,225+row*210),f'{t:.2f}s',font=small,fill=FG)
    im.save(OUT/'filmstrips'/f'{a}.png')
preserved=[]
for model in ['classic','slim']:
    for view in ['front','left','right','side']:
        name=f'{model}-{view}-drink.png';a=Image.open(OUT/'before'/name).convert('RGB');b=Image.open(OUT/'after'/name).convert('RGB');diff=ImageChops.difference(a,b);changed=sum(any(p) for p in diff.getdata());preserved.append({'file':name,'changedPixels':changed})
assert all(x['changedPixels']==0 for x in preserved)
(OUT/'data/drinking-preservation.json').write_text(json.dumps({'allPixelIdentical':True,'cases':preserved},indent=2));print('PASS eight drinking actor frames pixel-identical to accepted build')
with zipfile.ZipFile(ROOT/'installer-source.zip') as z:
    assert z.testzip() is None
    names=z.namelist();exe=next(n for n in names if n.endswith('.exe'));body=z.read(exe);info=z.read(next(n for n in names if n.endswith('BUILD_INFO.txt'))).decode('utf-8-sig');sums=z.read(next(n for n in names if n.endswith('SHA256SUMS.txt'))).decode('utf-8-sig')
sha=hashlib.sha256(body).hexdigest();assert sha=='91a806c948d8b7669ff85f9e1794b18c05224591e9ef05279b78409eb527389e';assert sha==re.search('[0-9a-f]{64}',sums)[0] and 'commit='+HEAD in info
pe=struct.unpack_from('<I',body,0x3c)[0];assert body[pe:pe+4]==b'PE\0\0';machine=struct.unpack_from('<H',body,pe+4)[0];opt=pe+24;magic=struct.unpack_from('<H',body,opt)[0];cert=struct.unpack_from('<II',body,opt+(96 if magic==0x10b else 112)+32);assert cert==(0,0)
installer=PREFIX+'-Windows-x64-setup.exe';(PUBLISH/installer).write_bytes(body);(OUT/'installer/BUILD_INFO.txt').write_text(info);(OUT/'installer/CI_SHA256SUMS.txt').write_text(sums);(OUT/'installer/SHA256SUMS.txt').write_text(sha+'  '+installer+'\n')
(OUT/'installer/verification.json').write_text(json.dumps({'commit':HEAD,'tree':TREE,'installerSHA256':sha,'bytes':len(body),'unsigned':True,'certificateTable':cert,'bootstrapMachine':hex(machine),'target':'x64 verified via MSVC log and x64 bundle filename','run':38448616801,'artifact':11838978201},indent=2))
cpu=json.loads((OUT/'data/cpu.json').read_text());rows={(x['version'],x['action']):x for x in cpu['rows']};cpu_table='| Action | Before p50 / p95 / p99 (µs) | After p50 / p95 / p99 (µs) |\n|---|---:|---:|\n'
for a in [x['action'] for x in cpu['rows'] if x['version']=='V4']:
    vals=lambda v:' / '.join(f'{rows[v,a][p]*1000:.2f}' for p in ['p50','p95','p99']);cpu_table+=f'| {a} | {vals("V3")} | {vals("V4")} |\n'
perf={}
for label in ['before','after','before-repeat','after-repeat']:perf[label]={x['action']:x for x in json.loads((OUT/'data'/('performance-'+label)/'manifest.json').read_text())['performance']}
table='| Action | Trial | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms) | Calls before → after | Triangles before → after |\n|---|---|---:|---:|---:|---:|\n'
for a in ['idle','walk','read','eat','drink','celebrate']:
    for trial,suffix in [('1',''),('2','-repeat')]:
        before,after=perf['before'+suffix][a],perf['after'+suffix][a];stats=lambda d:' / '.join(f'{d["renderSubmissionMs"][p]:.2f}' for p in ['p50','p95','p99'])
        table+=f'| {a} | {trial} | {stats(before)} | {stats(after)} | {before["drawCallsAllPasses"]} → {after["drawCallsAllPasses"]} | {before["trianglesAllPasses"]} → {after["trianglesAllPasses"]} |\n'
soak=json.loads((OUT/'data/soak.json').read_text());assert soak['commit']==HEAD and soak['resourcesStable'];counts=soak['samples'][-1];heapmin=min(x['usedHeap'] for x in soak['samples']);heapmax=max(x['usedHeap'] for x in soak['samples'])
assert '119' in (OUT/'logs/check.log').read_text()
report=f'''# AI Desktop Companion V4 — reference refinement verification

Implementation {HEAD}, tree {TREE}. Previous comparison {BASE}. Source: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/10 (draft). Main remains 004731af0bfb3c734b285cd236aebef34a06fdc0, unchanged.

The default installer includes solid 3D foods and the brown/gold book with cream parchment. Drinking is preserved as accepted.

## Exact Windows build

Source/browser CI: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38448616770
Windows build: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38448616801
Installer: {installer}
SHA-256: {sha}
Size: {len(body):,} bytes. Version 0.1.0-alpha.6.0; V4 names the motion milestone.

The PE certificate table is empty: unsigned development installer. NSIS uses an x86 bootstrap; the bundled application is Windows x64 as verified by the MSVC log and bundle filename. It was built from this exact tested implementation. It has not been installed on the owner's PC.

## Implemented behavior

Reading uses the existing BehaviorController seat authority. The avatar completes the 850 ms sit before equipping. The left palm lifts the closed book from 0.95–1.55 s; the right hand reaches from 1.45–1.9, opens the cover from 1.8–2.6 and rests by 3.25. Page assistance anticipates turns at 10.6 and 20.6 by 0.5 s, sweeps across the hinge and lowers afterward. The free hand closes the book; it lowers and the existing 650 ms stand returns to idle. Manual interruptions close once, stand and perform the latest queued request.

The book attaches to the actual left-arm/palm joint. An underside cover point determines its offset with full shoulder quaternion compensation. Brown pixel leather, gold corner clips, cream parchment, a hinged cover and cached curled sheet follow the supplied reference. Both page-face normals are tested against the avatar eye position. Head/pupils look down, with quiet scans and retained cursor response.

Eating replaces the active sprite extrusion with four original volumetric profiles: stepped apple with stem/leaf, curved cooked chop with bone ends, tapered golden carrot with stalks and frosted block cake with red topping. Exterior pixel faces merge into one mesh per item with flat normals and discrete colors. Food sRGB colors are explicitly decoded to linear vertices without altering the skinview3d global color configuration. Thickness-specific grips keep solids outside head/hat and jacket during bites/recovery.

Deliberate bites/chewing, bounded 16-instance crumbs and finishing opacity fade remain. Default 3D models need no import. Optional Avatar Studio JAR/ZIP/PNG imports customize body/pale-frost colors while preserving profiles and semantic accents. Archive size/path/decompression/CRC limits remain; no raw game texture, client JAR or private skin is bundled.

Drinking's vessel, fill, level surface, grip, tilt and lowering are unchanged. Eight actor PNG pairs—Classic/Slim × front, both 45° views and hand-side 90°—are pixel-identical to the accepted build. Bottle clearance and liquid-surface tests still pass.

## Verification

119 / 119 automated tests, production web build and all browser suites pass; exact-head CI agrees. Reference regressions cover solid volume, sit-before-equip, closed lift, opening assistance, free-hand rest, supporting-palm attachment, page assistance/return and eye-to-page facing. Every food surface vertex is checked through full bites and interrupted recovery for both models; every book cover/page vertex is checked through lift, open, read and close. Original geometry/UV, upper-body attachment, cadence agreement, action continuity, interruption and seat/sole-plane tests remain active.

Two-palm mounting and thin-depth assertions were migrated to the owner's one-hand/solid-volume requirements. Visibility thresholds remain; reading is sampled after its intentional sit/lift. Eyes fixed-head motion/blink gates pass with neutral/disabled difference zero. Workspace/overlay startup, dynamic wave, skin import/reload, daily activities and settings pass. Crumbs pass the unchanged GPU gate; browser JAR decoding selects only allowlisted synthetic fixtures.

Logs are included. Vite renderer-bundle size notices remain warnings; builds succeed. No perfect-results or native-hardware certification is claimed.

## Actual-renderer review

Extract the ZIP and open index.html. There are 60 PNGs per version, 7 before clips, 21 after clips, 11 comparison sheets and 7 temporal filmstrips, plus browser smoke screenshots. Classic/Slim are shown at front, both 45° and one hand-side 90° view. Details include closed equip, opening, quiet reading, both page turns, closing, each food/fade and bottle states. Isolated props use each version's actual production geometry/materials and canonical lighting.

All 28 clips are decoded and match expected frame counts, 320 × 400 dimensions and final idle/standing/zero-prop state. The full read has 822 frames over 27.4 s, including both turns and complete stand-up. Interruption/stop/stand cases run four seconds. Before samples the controller at 60 Hz; after at 30/60/144. Each actual renderer PNG frame is read back and encoded at 30 fps authored time. There are no generated or interpolated frames. Context loss fails capture. This is reproducible motion evidence, not native presentation-FPS certification.

Default paired times: reading 5.0 s, eating 1.45 s, drinking 1.9 s. Closed-book isolates use the respective closed phase. Both columns use shipped defaults. The fixed Minecraft arms still temporarily occlude props from the hand-side 90° view. Owner original skin, native WebView2, actual pacing and hardware/DPI checks remain pending.

## Performance

Measurements run sequentially without concurrent capture/soak. Controller samples use 1,000 warm-up and 10,000 measured frames/action, 20-frame batches and GC before/after. Raw V3 means previous reference; V4 means this implementation.

{cpu_table}

Renderer: Chromium {manifests['after']['browserVersion']} / ANGLE SwiftShader software WebGL, 320 × 400/DPR 1, sample skin, 60 warm-up plus 360 measured frames/action. Values time JS render submission and queue backpressure, not completed GPU frame time or display FPS. Two trials show variability; no universal speedup is claimed.

{table}

Solid foods add triangles and reduce draws. Mesh triangles: cooked chop 936, apple 1380, carrot 824, cake 1220. Texture-backed book covers remove trim meshes. Idle/walk and the original 60 active / 20 idle policy remain. Creation/disposal is owned by initialization and explicit import; no geometry/material/palette/matrix/particle object is created in per-frame updates.

### Final-source resource soak

Final {HEAD[:7]} ran {soak['wallClockMs']/1000:.3f} s after 100 skin/model/import/reset/dispose/reinitialize lifecycles, with {soak['actionRequests']} timed action requests. Counts remain stable: {counts['geometries']} geometries, {counts['textures']} textures; {counts['propGeometries']} prop geometries, {counts['propMaterials']} prop materials, {counts['items']} item models, {counts['bottleGeometries']} bottle geometries, {counts['bottleMaterials']} bottle materials. Pools: 48 fireworks, 16 crumbs. Post-GC heap {heapmin:,}–{heapmax:,} bytes; range {soak['retainedHeapRange']:,}. This bounded sample supports reuse; it is not indefinite leak proof or native GPU-memory certification.

## Architecture and reproduction

One BehaviorController and the canonical skinview3d/Three.js renderer remain, with original skin geometry/UVs, eyes/blink/cursor pupils, Workspace and overlay. Inspect desktop-window awareness remains a separate future milestone. The obsolete food extrusion builder is removed; existing prop/effect owners handle new assets. No second clock or renderer is introduced.

Source docs: docs/ANIMATION_FIDELITY_V4.md and docs/ACTIVE_ANIMATIONS_AND_LOGIC_V4_DEV.md. Main code: activity-timelines.js, animation-handlers.js, avatar-props.js, voxel-foods.js and reference-props-v4.test.mjs. water-bottle.js remains unchanged.

Evidence automation on a separate branch checks out this fixed implementation SHA and baseline, keeping PR #10 unchanged. Reproduce using npm ci / npm run check, isolated Playwright 1.56.1/browser, ffmpeg/ffprobe on PATH, and scripts/capture-motion.mjs --actions=read,eat,drink --prop-details --clips --clip-rates=30,60,144. Benchmark and soak helpers are checked in; raw game assets are unnecessary.

Owner acceptance still needs the original skin on Windows x64, Workspace/overlay interactions, tray/context behavior, 100/150/200% DPI and native GPU/display pacing. Main has not been merged.
'''
(OUT/'VERIFICATION.md').write_text(report);(PUBLISH/(PREFIX+'-Reference-Verification.md')).write_text(report)
(OUT/'README.txt').write_text('Extract the entire ZIP, then open index.html. See VERIFICATION.md for source/build, tests, performance and pending native checks. Default 3D foods are included; importing items is optional for colors. Source PR #10 remains draft; main unchanged.\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V4 reference refinement</title><style>
:root{color-scheme:dark;font:16px system-ui;background:#101b29;color:#e7eef8}*{box-sizing:border-box}body{max-width:1100px;margin:auto;padding:24px}h1{font-size:1.7rem}p{line-height:1.6;color:#b8cadf}a{color:#81d4f6}select,button{font:inherit;background:#243950;color:inherit;border:1px solid #526a85;border-radius:7px;padding:9px}button{cursor:pointer}.controls{display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin:22px 0}label{display:flex;flex-direction:column;gap:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:#162333;border:1px solid #34475e;border-radius:12px;padding:16px}.card img,.card video{display:block;width:320px;max-width:100%;height:auto;margin:15px auto}.hidden{display:none!important}.note{padding:12px;border-left:3px solid #95cbea;background:#192b3e}.thumbs{display:grid;grid-template-columns:repeat(2,1fr);gap:15px}.thumbs img{width:100%}details{padding:12px 0;border-bottom:1px solid #34475e}summary{cursor:pointer}li{line-height:1.9}@media(max-width:650px){.pair,.thumbs{grid-template-columns:1fr}}
</style><h1>AI Desktop Companion — V4 reference refinement</h1><p>119 tests passed · One-hand book · Included solid 3D foods · Drinking preserved</p><p>Before 535993f · After bb2727b · Canonical renderer · Synthetic skin · Software WebGL · 320 × 400</p><p class="note">Every actual rendered frame is encoded at 30 fps authored time. After controller cadence: 30/60/144 Hz. Native Windows/RTX/DPI/display certification remains pending.</p>
<div class="controls"><label>Action<select id="action"></select></label><label>Review<select id="mode"><option value="motion">Motion clips</option><option value="pose">Fixed pose</option></select></label><label class="poseCtl hidden">Model<select id="model"><option value="classic">Classic</option><option value="slim">Slim</option></select></label><label class="poseCtl hidden">View<select id="view"><option value="front">Front</option><option value="left">Left 45°</option><option value="right">Right 45°</option><option value="side">Side 90°</option></select></label><label class="motionCtl">After cadence<select id="cadence"><option value="60">60 Hz</option><option value="30">30 Hz</option><option value="144">144 Hz</option></select></label><label class="motionCtl">Speed<select id="speed"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></label><button id="prev">←</button><button id="next">→</button></div><div class="controls motionCtl"><button id="play">Play both from start</button><button id="pause">Pause both</button><span id="time"></span></div><p id="caption"></p><div class="pair"><section class="card"><h2>Before · 535993f</h2><video id="oldVideo" controls playsinline preload="metadata"></video><img id="oldImage" class="hidden" alt="Previous pose"></section><section class="card"><h2>After · bb2727b</h2><video id="newVideo" controls playsinline preload="metadata"></video><img id="newImage" class="hidden" alt="Refined pose"></section></div><p>Sit first, lift closed in the left hand, open with the right, rest that hand between turns. Solid foods are included with bites, crumbs and fade. Imports optionally customize colors.</p><details><summary>Multi-angle comparisons and reference details</summary><div id="sheets" class="thumbs"></div></details><details><summary>Ordered motion frames</summary><ul id="strips"></ul></details><details><summary>Verification, metrics and build</summary><ul><li><a href="VERIFICATION.md">Full report</a></li><li><a href="data/soak.json">Final-source soak</a> · <a href="data/cpu.json">Controller benchmark</a></li><li><a href="data/performance-before/manifest.json">Before renderer</a> · <a href="data/performance-after/manifest.json">After renderer</a></li><li><a href="data/drinking-preservation.json">Eight unchanged drinking frames</a></li><li><a href="logs/check.log">119 tests/build</a> · <a href="logs/browser.log">Workspace/overlay</a> · <a href="logs/eyes.log">Eyes</a> · <a href="logs/activities.log">Props/effects</a></li><li><a href="logs/source-browser-ci.log">Exact-head CI</a> · <a href="logs/windows-build-ci.log">Windows build</a></li><li><a href="installer/BUILD_INFO.txt">Provenance</a> · <a href="installer/SHA256SUMS.txt">Checksum</a></li></ul></details><footer><p><a href="https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/10">Draft PR #10</a> · Main unchanged; acceptance pending.</p></footer><script>
const actions=['read','eat','drink','interrupt-mid-book','interrupt-mid-drink','walk-stop','stand-up'],times={read:5,eat:1.45,drink:1.9},$=id=>document.getElementById(id),videos=[$('oldVideo'),$('newVideo')];for(const a of actions){const o=document.createElement('option');o.value=a;o.textContent=a.replaceAll('-',' ');$('action').append(o)}
function update(){videos.forEach(v=>v.pause());let a=$('action').value,mode=$('mode').value;if(!(a in times)&&mode==='pose'){mode='motion';$('mode').value=mode}const motion=mode==='motion';document.querySelectorAll('.motionCtl').forEach(x=>x.classList.toggle('hidden',!motion));document.querySelectorAll('.poseCtl').forEach(x=>x.classList.toggle('hidden',motion));videos.forEach(v=>v.classList.toggle('hidden',!motion));['oldImage','newImage'].forEach(id=>$(id).classList.toggle('hidden',motion));if(motion){$('oldVideo').src='before/clips/'+a+'.webm';const hz=$('cadence').value,dir=hz==='60'?'clips':'clips-'+hz;$('newVideo').src='after/'+dir+'/'+a+'.webm';videos.forEach(v=>v.playbackRate=Number($('speed').value));$('caption').textContent='Quarter view · full action/recovery · before 60 Hz / after '+hz+' Hz simulation · 30 fps actual-renderer authored-time video.'}else{const file=$('model').value+'-'+$('view').value+'-'+a+'.png';$('oldImage').src='before/'+file;$('newImage').src='after/'+file;$('caption').textContent='Same authored time: '+times[a]+' s. Original skin geometry preserved.'}$('time').textContent=''}
for(const id of ['action','mode','model','view','cadence'])$(id).addEventListener('change',update);$('speed').onchange=()=>videos.forEach(v=>v.playbackRate=Number($('speed').value));for(const [id,step] of [['prev',-1],['next',1]])$(id).onclick=()=>{$('action').selectedIndex=($('action').selectedIndex+step+actions.length)%actions.length;update()};$('play').onclick=async()=>{videos.forEach(v=>v.currentTime=0);await Promise.allSettled(videos.map(v=>v.play()))};$('pause').onclick=()=>videos.forEach(v=>v.pause());$('newVideo').ontimeupdate=()=>{$('time').textContent='Before '+videos[0].currentTime.toFixed(2)+' s · After '+videos[1].currentTime.toFixed(2)+' s'};
for(const name of ['classic-front','classic-left','classic-right','classic-side','slim-front','slim-left','slim-right','slim-side','food-volumes','book-style','reading-choreography']){const a=document.createElement('a');a.href='comparisons/'+name+'.png';const img=document.createElement('img');img.src=a.href;img.loading='lazy';img.alt=name+' actual-renderer comparison';a.append(img);$('sheets').append(a)}for(const a of actions){const li=document.createElement('li'),link=document.createElement('a');link.href='filmstrips/'+a+'.png';link.textContent=a.replaceAll('-',' ');li.append(link);$('strips').append(li)}update();
</script></html>'''
(OUT/'index.html').write_text(html)
check=r"""
import {chromium} from '__PLAYWRIGHT__';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({headless:true}),page=await b.newPage({viewport:{width:1100,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')errors.push(r.url()+' '+r.failure()?.errorText)});
await page.goto('__GALLERY__');
for(const action of ['read','eat','drink','interrupt-mid-book','interrupt-mid-drink','walk-stop','stand-up'])for(const cadence of ['30','60','144']){
 await page.selectOption('#action',action);await page.selectOption('#cadence',cadence);await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2&&v.videoWidth===320&&Number.isFinite(v.duration)));
 await page.click('#play');await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.currentTime>.12));await page.click('#pause');
}
await page.selectOption('#action','read');await page.selectOption('#speed','0.5');if(!await page.evaluate(()=>[...document.querySelectorAll('video')].every(v=>v.playbackRate===.5)))throw Error('Speed failed');await page.selectOption('#mode','pose');
for(const action of ['read','eat','drink'])for(const model of ['classic','slim'])for(const view of ['front','left','right','side']){
 await page.selectOption('#action',action);await page.selectOption('#model',model);await page.selectOption('#view',view);await page.waitForFunction(()=>['oldImage','newImage'].every(id=>{const i=document.getElementById(id);return i.complete&&i.naturalWidth===320}));
}
await page.locator('summary').filter({hasText:'Multi-angle'}).click();await page.waitForFunction(()=>[...document.querySelectorAll('#sheets img')].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:'__OUT__/gallery-preview.png',fullPage:true});
if(errors.length)throw Error(errors.join('\n'));await writeFile('__OUT__/data/gallery-check.json',JSON.stringify({passed:true,pairedClipCases:21,pairedPoseCases:24,sheets:11,browser:b.version(),errors},null,2));await b.close();console.log('PASS gallery: 21 paired motion cases, 24 paired poses, controls and 11 sheets');
""".replace('__PLAYWRIGHT__',(CANDIDATE/'node_modules/playwright/index.mjs').as_posix()).replace('__GALLERY__',(OUT/'index.html').as_uri()).replace('__OUT__',OUT.as_posix())
(ROOT/'gallery-check.mjs').write_text(check)
for p in sorted((OUT/'comparisons').glob('*.png'))+sorted((OUT/'filmstrips').glob('*.png')):print('PREVIEW|'+p.name+'|'+base64.b64encode(p.read_bytes()).decode())
print('PASS report, comparisons, motion frames and verified installer assembled')
