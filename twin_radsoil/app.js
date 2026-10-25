// 건식선별 설비 디지털 트윈 — 공정영상 R06 조립 형상(glTF) 실시간 PBR 뷰어
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {buildExtras} from './scene-build.js';
import {addLogos} from './logo-decals.js';

const $=s=>document.querySelector(s);
const loadEl=$('#loading'); const setLoad=t=>{ loadEl.textContent=t; };
async function main(){
const data=await (await fetch('data/scene.json')).json();
const matMap=await fetch('data/materials.json').then(r=>r.ok?r.json():{}).catch(()=>({})); // Codex 재질표(materials_R08) → glTF 재질명 기준
const units=data.units; const toWorld=(x,y,z)=>new THREE.Vector3(x,z,-y);

// ── 렌더러 · 장면 · 조명 (스튜디오 회색 배경 = 영상 톤) ──
const canvas=$('#view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.9; renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); const BG='#878f95'; scene.fog=new THREE.Fog(BG,46,125);
// 배경: 영상 R06 스튜디오 톤(위 어두운 회색 → 아래 밝은 회색) 그라데이션
{ const c=document.createElement('canvas'); c.width=4; c.height=256; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#5a636a'); gr.addColorStop(.5,'#7c858b'); gr.addColorStop(1,'#99a1a7'); g.fillStyle=gr; g.fillRect(0,0,4,256); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; scene.background=t; }
// 환경광: 코드로 만든 소프트박스 스튜디오(임시) → data/env_studio_2k.hdr(Codex 렌더 월드) 가 있으면 교체
const pmrem=new THREE.PMREMGenerator(renderer);
function studioEnv(){ const sc=new THREE.Scene(); const box=new THREE.Mesh(new THREE.BoxGeometry(60,30,60),new THREE.MeshStandardMaterial({color:'#5e676e',emissive:'#5e676e',emissiveIntensity:.55,side:THREE.BackSide})); box.position.y=12; sc.add(box);
  const panel=(w,h,x,y,z,col,i,rx,ry,rz)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide})); m.material.color.multiplyScalar(i); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); sc.add(m); };
  panel(18,10,4,24,2,'#fff4e6',9,Math.PI/2,0,0);          // 상단 키 소프트박스(따뜻한 흰색)
  panel(14,7,-24,10,-6,'#dfe9f4',3.2,0,Math.PI/2,0);       // 좌측 차가운 필
  panel(12,6,26,8,-10,'#ffffff',2.4,0,-Math.PI/2,0);       // 우측 림
  panel(30,8,0,9,-28,'#e9eef2',1.6,0,0,0);                  // 뒤 배경판
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:'#8d969c',emissive:'#8d969c',emissiveIntensity:.35})); floor.rotation.x=-Math.PI/2; floor.position.y=-.2; sc.add(floor); return sc; }
scene.environment=pmrem.fromScene(studioEnv(),.04).texture; scene.environmentIntensity=.75;
function loadEnvHDR(file){ new HDRLoader().load('data/'+file,t=>{ t.mapping=THREE.EquirectangularReflectionMapping; scene.environment=pmrem.fromEquirectangular(t).texture; scene.environmentIntensity=1; t.dispose(); window.__envHDR=file; },undefined,e=>console.warn('HDR 환경맵 로드 실패',e)); }
const camera=new THREE.PerspectiveCamera(36,1,.1,400);
const controls=new OrbitControls(camera,canvas); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=Math.PI/2-.015; controls.minDistance=1.2; controls.maxDistance=90;
scene.add(new THREE.HemisphereLight('#e8eef2','#5f6c75',.35));
const sun=new THREE.DirectionalLight('#fff1dc',2.1); sun.position.set(14,24,11); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
const sc=sun.shadow.camera; sc.left=-14;sc.right=14;sc.top=14;sc.bottom=-14;sc.near=1;sc.far=90; sun.shadow.bias=-.0003; sun.shadow.normalBias=.025; sun.target.position.set(6.5,0,-5); scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#dfe9f2',.45); fill.position.set(-16,12,-18); scene.add(fill);

const extras=buildExtras(THREE,data); scene.add(extras.root);

// ── glTF 로드 ──
const groups={}, extents={}, pick=[]; const xray=[];
// 재질 보정(실사 톤): Codex 렌더 재질표(materials.json, glTF 재질명 기준)가 있으면 색·금속성·거칠기를 그대로, 없으면 이름으로 마감 추정.
// 일반 보기는 렌더와 같이 불투명(설명용 반투명 재질도 불투명) — 투시는 X 토글이 담당. 재질은 공유되므로 uuid 로 1회만 변환
const matCache=new Map();
function finishOf(n){ n=n||''; if(/soil/i.test(n)) return 'soil'; if(/rubber|chain|_pu_|cleaner|caster/i.test(n)) return 'rubber'; if(/steel|duct|galvanized|machined|satin|_h100_|drum_matte/i.test(n)) return 'metal'; return 'paint'; }
function cine(m,id){ if(!m.isMeshStandardMaterial||id==='BUILDING') return m; if(matCache.has(m.uuid)) return matCache.get(m.uuid);
  const ref=matMap[m.name]||null; const fin=ref?ref.f:finishOf(m.name);
  const pm=new THREE.MeshPhysicalMaterial({color:m.color,map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,emissive:'#000000',side:m.side,alphaTest:0,name:m.name});
  if(ref&&ref.c) pm.color.set(ref.c);
  if(fin==='metal'){ pm.metalness=.86; pm.roughness=ref?THREE.MathUtils.clamp(ref.r,.22,.4):.3; pm.envMapIntensity=1.25; }
  else if(fin==='rubber'){ pm.metalness=0; pm.roughness=.72; pm.envMapIntensity=.6; }
  else if(fin==='soil'){ pm.metalness=0; pm.roughness=.9; pm.envMapIntensity=.5; }
  else { pm.metalness=.06; pm.roughness=ref?THREE.MathUtils.clamp(ref.r,.34,.5):.42; pm.clearcoat=.3; pm.clearcoatRoughness=.3; pm.envMapIntensity=.95; pm.specularIntensity=.9; }
  pm.transparent=false; pm.opacity=1; pm.depthWrite=true; pm.userData.finish=fin;
  matCache.set(m.uuid,pm); return pm; } const XR=[['M01_',.23],['M06_',.12],['M07_',.12],['M05_',.35],['M02_',.30],['HD0',.13],['TR04_',.18],['TR05_',.18],['TR07_',.18],['SC02_',.18],['SC03_',.18],['TR03_',.3],['R03_HOOD',.2]];
const draco=new DRACOLoader(); draco.setDecoderPath('./vendor180/draco/');
const loader=new GLTFLoader(); loader.setDRACOLoader(draco);
setLoad('3D 모델 불러오는 중 …');
const gltf=await new Promise((res,rej)=>loader.load('data/plant_video.glb',res,e=>{ if(e.total) setLoad(`3D 모델 불러오는 중 … ${Math.round(e.loaded/e.total*100)} %`); },rej));
const plant=gltf.scene; plant.name='plant'; scene.add(plant); plant.updateMatrixWorld(true);
const bb=new THREE.Box3();
plant.traverse(o=>{
  if(!o.isMesh) return;
  let p=o, id=null, nm=null; while(p&&!id){ id=p.userData.twin_id||null; nm=p.userData.twin_name||null; p=p.parent; }
  id=id||'ETC'; o.userData.owner=id; o.userData.twin_name=nm||o.name; o.castShadow=true; o.receiveShadow=true;
  let m=o.material; if(m){ m=o.material=cine(m,id); if(m.transparent||m.opacity<1){ m.transparent=true; m.depthWrite=false; } if(id==='BUILDING'&&/^TONE_PANEL|wall$|^concrete/i.test(o.userData.twin_name)){ m=o.material=m.clone(); m.transparent=true; m.opacity=/^TONE_PANEL/.test(o.userData.twin_name)?.09:.35; m.depthWrite=false; m.side=THREE.DoubleSide; m.roughness=.12; m.metalness=0; m.color.set('#dfe9f0'); o.castShadow=false; o.renderOrder=5; o.visible=false; o.userData.wall=true; } } // 외벽(유리 패널·벽)은 기본 삭제(사용자 지시 R08e) — 기둥·보만 남김
  (groups[id]=groups[id]||[]).push(o); pick.push(o);
  o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); (extents[id]=extents[id]||new THREE.Box3()).union(bb);
  const r=XR.find(([pre])=>o.userData.twin_name.startsWith(pre)); if(r) xray.push({mesh:o,opacity:r[1]});
});
const catOf=id=>units[id]?.cat||'building';
await addLogos(THREE,scene,extents); // data/logos.json 있을 때만(에니스 사본용)
loadEl.remove();

// ── 라벨 ──
const LABELLED=['D-101','M-101','M-102','M-103','M-104','HD-01','S01','M-107','M-108','M-109','M-110C','M-111','CV-02','RCV-R3','M-112','M-113','M-114','TR-01','M-115','TB-101','TB-102','TB-103','M-116','M-117','M-118','BL-01'];
const labelLayer=$('#labels'); const labels=[];
for(const id of LABELLED){ const ext=extents[id]; if(!ext||ext.isEmpty()) continue; const u=units[id]||{name:id,cat:'building'}; const el=document.createElement('button'); el.className='label'; el.style.setProperty('--c',data.cats[u.cat].color); el.innerHTML=`<b>${id}</b><span>${u.name.replace(/\s*\(.*$/,'')}</span>`; el.onclick=()=>select(id,true); labelLayer.appendChild(el); const c=new THREE.Vector3(); ext.getCenter(c); labels.push({el,pos:new THREE.Vector3(c.x,ext.max.y+.3,c.z),id}); }
const holdEls=[];
for(const {h,mesh} of extras.holds){ const el=document.createElement('button'); el.className='label hold'; el.textContent=h.id; el.onclick=()=>showHold(h); labelLayer.appendChild(el); holdEls.push({el,pos:mesh.position.clone().add(new THREE.Vector3(0,.3,0)),h}); }

// ── UI ──
let flowOn=true, labelsOn=false, holdsOn=true, aoOn=true, xrayOn=false, cineOn=true, stillsOn=true;
const catBox=$('#cats');
for(const [k,c] of Object.entries(data.cats)){ const row=document.createElement('label'); row.innerHTML=`<input type="checkbox" data-cat="${k}" checked><i style="background:${c.color}"></i>${c.name}`; catBox.appendChild(row); row.querySelector('input').onchange=e=>{ for(const [id,ms] of Object.entries(groups)) if(catOf(id)===k) ms.forEach(m=>{ if(!m.userData.wall) m.visible=e.target.checked; }); }; }
$('#toggle-shell').onchange=e=>{ (groups.BUILDING||[]).forEach(m=>{ if(!m.userData.wall) m.visible=e.target.checked; }); };
$('#toggle-flow').onchange=e=>{ flowOn=e.target.checked; extras.setFlowsVisible(flowOn); };
$('#toggle-labels').onchange=e=>{ labelsOn=e.target.checked; };
$('#toggle-holds').onchange=e=>{ holdsOn=e.target.checked; extras.holds.forEach(x=>x.mesh.visible=holdsOn); };
$('#toggle-ao').onchange=e=>{ aoOn=e.target.checked; if(gtao) gtao.enabled=aoOn; };
$('#toggle-cine').onchange=e=>{ cineOn=e.target.checked; setCine(cineOn); };
$('#toggle-still').onchange=e=>{ stillsOn=e.target.checked; if(!stillsOn) stillHide(); else stillTry(); };
$('#toggle-xray').onchange=e=>{ setXray(e.target.checked); if(stillName) stillTry(); };
function setXray(on){ xrayOn=on; for(const x of xray){ const m=x.mesh; if(on){ if(!m.userData._solid){ m.userData._solid=m.material; const t=m.material.clone(); t.transparent=true; t.opacity=x.opacity; t.depthWrite=false; m.userData._xr=t; } m.material=m.userData._xr; m.castShadow=false; } else if(m.userData._solid){ m.material=m.userData._solid; m.castShadow=true; } } if(selected) highlight(selected); }
const viewBox=$('#views');
for(const [k,v] of Object.entries(data.views)){ const b=document.createElement('button'); b.textContent=v.name; b.onclick=()=>flyTo(v.pos,v.target,v.fov,'view_'+k); viewBox.appendChild(b); }
$('#fullscreen').onclick=()=>{ const el=document.documentElement; const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 if(isFs()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); return; }
 if(document.body.classList.contains('pseudo-full')){ setPseudo(false); return; }
 let p=null; try{ const req=el.requestFullscreen||el.webkitRequestFullscreen; p=req&&req.call(el); }catch(e){}
 if(p&&p.catch) p.catch(()=>{}); setTimeout(()=>{ if(!isFs()) setPseudo(true); },1200); };
function setPseudo(on){ document.body.classList.toggle('pseudo-full',on); const b=$('#fullscreen'); if(b) b.textContent=on?'전체화면 해제':'전체화면'; parent.postMessage({type:'enis-twin-full',on},'*'); setTimeout(()=>dispatchEvent(new Event('resize')),50); }
addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('pseudo-full')) setPseudo(false); });
for(const ev of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(ev,()=>{ const fs=!!(document.fullscreenElement||document.webkitFullscreenElement); if(fs&&document.body.classList.contains('pseudo-full')) setPseudo(false); const b=$('#fullscreen'); if(b) b.textContent=fs?'전체화면 해제':'전체화면'; });
$('#flows').innerHTML=data.flows.map(f=>`<div class="fl"><i style="background:${f.color}"></i>${f.name}</div>`).join('');
const holdList=$('#holdlist'); holdList.innerHTML=data.holds.map(h=>`<button class="hl" data-id="${h.id}"><b>${h.id}</b>${h.desc.split(' — ')[0]}</button>`).join('');
holdList.querySelectorAll('button').forEach(b=>b.onclick=()=>showHold(data.holds.find(h=>h.id===b.dataset.id)));

// ── 카메라 ──
let fly=null;
function flyTo(pos,target,fov,still){ stillHide(); stillName=still||null; fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:toWorld(...pos),t1:toWorld(...target),f1:fov||36,t:0}; }
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;

// ── 선택 · 정보 ──
const ray=new THREE.Raycaster(); ray.params.Points.threshold=0; const mouse=new THREE.Vector2(); let selected=null, hover=null;
const info=$('#info');
$('#panel-btn').onclick=()=>document.body.classList.toggle('panel-open'); $('#side-close').onclick=()=>document.body.classList.remove('panel-open');
function infoShow(on){ info.classList.toggle('show',!!on); if(on&&!info.querySelector('.close-x')){ const b=document.createElement('button'); b.className='close-x'; b.textContent='✕'; b.title='닫기'; b.onclick=()=>infoShow(false); info.prepend(b); } }
function highlight(id){ for(const [gid,ms] of Object.entries(groups)){ const on=gid===id; for(const m of ms){ if(on){ if(!m.userData._base){ m.userData._base=m.material; const c=m.material.clone(); c.emissive=new THREE.Color('#ffb300'); c.emissiveIntensity=.38; m.userData._hl=c; } if(m.userData._hl.transparent!==m.material.transparent){ const c=m.material.clone(); c.emissive=new THREE.Color('#ffb300'); c.emissiveIntensity=.38; m.userData._hl=c; } m.material=m.userData._hl; } else if(m.userData._base&&m.material===m.userData._hl){ m.material=(xrayOn&&m.userData._xr)?m.userData._xr:(m.userData._solid&&!xrayOn?m.userData._solid:m.userData._base); } } } }
function fmt(v){ return Math.round(v*1000).toLocaleString(); }
let picked=false; // 사용자가 직접 고른 뒤에만 선택 설비 라벨 표시(초기 자동 선택은 라벨 없음)
function select(id,focus){ selected=id; if(focus!==undefined&&focus!==null&&select.user) picked=true; highlight(id); if(focus) stillHide(true); const u=units[id]||{name:id,cat:'building',make:'',note:'',source:''}; const ext=extents[id]; const c=data.cats[u.cat]||data.cats.building;
  const dims=ext&&!ext.isEmpty()?`외곽 ${fmt(ext.max.x-ext.min.x)} × ${fmt(ext.max.z-ext.min.z)} mm · 바닥 EL ${fmt(ext.min.y)} · 상단 EL ${fmt(ext.max.y)} · 부품 ${groups[id].length}`:'';
  info.innerHTML=`<span class="chip" style="background:${c.color}">${c.name}</span><span class="chip tag">${u.make||'—'}</span><h2>${id} · ${u.name}</h2><p class="facts">${dims}</p><p class="note">${u.note||''}</p><p class="src">출처: ${u.source||data.meta.source}</p>`; infoShow(select.user&&!tourOn);
  if(focus&&ext&&!ext.isEmpty()){ const cc=new THREE.Vector3(); ext.getCenter(cc); const size=ext.getSize(new THREE.Vector3()).length(); const d=Math.max(3.5,size*1.5); const p=cc.clone().add(new THREE.Vector3(d*.55,d*.5,d*.6)); fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:p,t1:cc,f1:36,t:0}; } }
function showHold(h){ stillHide(true); highlight(null); selected=null; info.innerHTML=`<span class="chip" style="background:#ff8a3d">제작 보류</span><h2>${h.id}</h2><p class="note">${h.desc}</p><p class="src">출처: 06 개정기록 R3-2 · B6-01 R3 보류표</p>`; const p=toWorld(...h.pos); fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:p.clone().add(new THREE.Vector3(3,2.6,3.2)),t1:p,f1:36,t:0}; }
function pickAt(cx,cy){ const r=canvas.getBoundingClientRect(); mouse.set(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1); ray.setFromCamera(mouse,camera); const hh=ray.intersectObjects(extras.holds.filter(x=>x.mesh.visible).map(x=>x.mesh),false)[0]; if(hh) return {hold:hh.object.userData.hold}; const hits=ray.intersectObjects(pick,false); for(const h of hits){ if(!h.object.visible) continue; const id=h.object.userData.owner; if(id==='BUILDING'&&h.object.material.transparent) continue; return {id}; } return null; }
let downAt=null; canvas.addEventListener('pointerdown',e=>downAt=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{ if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5) return; const r=pickAt(e.clientX,e.clientY); if(!r){ infoShow(false); return; } if(r.hold){ showHold(r.hold); infoShow(true); } else select(r.id,false); });
let lastHover=0; canvas.addEventListener('pointermove',e=>{ const now=performance.now(); if(now-lastHover<70) return; lastHover=now; const r=pickAt(e.clientX,e.clientY); const id=r?(r.hold?r.hold.id:r.id):null; canvas.style.cursor=id?'pointer':''; if(id!==hover){ hover=id; $('#hover').textContent=id?(r.hold?r.hold.id+' 보류':id+' '+(units[id]?.name||'')):''; } });

// ── 키: ← → 를 덱으로 전달 ──
window.addEventListener('keydown',e=>{ if(tourOn){ if(e.key==='Escape'){ e.preventDefault(); tourStop(); return; } if(e.key==='ArrowRight'||e.key==='PageDown'){ e.preventDefault(); tourGo(tourI+1); return; } if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); tourGo(tourI-1); return; } if(e.key===' '){ e.preventDefault(); tourSetAuto(!tourAuto); return; } }
  if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)){ e.preventDefault(); try{ window.parent.postMessage({type:'radsoil-slide-key',key:e.key},'*'); }catch(_){} } if(e.key==='f'||e.key==='F') $('#toggle-flow').click(); if(e.key==='x'||e.key==='X') $('#toggle-xray').click(); });

// ── 후처리 (GTAO 주변광 차폐) ──
// 체인: 렌더 → GTAO → 블룸 → (투어 중) 피사계심도 → 톤매핑 출력 → 색보정·비네트·그레인 → SMAA
let composer=null, gtao=null, bloom=null, bokeh=null, grade=null, smaa=null;
const GradeShader={uniforms:{tDiffuse:{value:null},vig:{value:.55},con:{value:1.06},sat:{value:1.04},lift:{value:.012},warm:{value:.5},grain:{value:.016},time:{value:0}},
 vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
 fragmentShader:`uniform sampler2D tDiffuse; uniform float vig,con,sat,lift,warm,grain,time; varying vec2 vUv;
 float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
 void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 col=c.rgb; float l=dot(col,vec3(.2126,.7152,.0722)); col=mix(vec3(l),col,sat); col=(col-.5)*con+.5; col=col*(1.-lift)+lift;
  float hl=smoothstep(.45,1.,l); col*=mix(vec3(1.),vec3(1.+warm*.035,1.+warm*.008,1.-warm*.04),hl); col=mix(col,col*vec3(.985,.995,1.02),1.-hl);
  vec2 d=(vUv-.5)*vec2(1.15,1.); float v=smoothstep(.98,.3,length(d)); col*=mix(1.,v,vig);
  col+=(hash(vUv*vec2(1920.,1080.)+fract(time))-.5)*grain; gl_FragColor=vec4(clamp(col,0.,1.),c.a); }`};
try{ composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
  gtao=new GTAOPass(scene,camera,2,2); gtao.output=GTAOPass.OUTPUT.Default; gtao.blendIntensity=.75; gtao.updateGtaoMaterial({radius:.45,distanceExponent:1,thickness:1,scale:1,samples:12,distanceFallOff:1,screenSpaceRadius:false}); gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,radiusExponent:1,rings:2,samples:12}); composer.addPass(gtao);
  bloom=new UnrealBloomPass(new THREE.Vector2(2,2),.16,.4,.92); composer.addPass(bloom);
  bokeh=new BokehPass(scene,camera,{focus:12,aperture:.00018,maxblur:.0065}); bokeh.enabled=false; composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  grade=new ShaderPass(GradeShader); composer.addPass(grade);
  smaa=new SMAAPass(); composer.addPass(smaa);
}catch(err){ console.warn('후처리 사용 불가',err); composer=null; $('#toggle-ao').disabled=true; $('#toggle-cine').disabled=true; aoOn=false; cineOn=false; }
function setCine(on){ if(bloom) bloom.enabled=on; if(grade) grade.enabled=on; document.body.classList.toggle('cine',on); }
setCine(cineOn);

// ── 실사 층: Codex Blender 렌더(renders/*.jpg) 를 같은 카메라에서 크로스페이드 ──
const stillEl=$('#still'), stillImg=$('#still img'); let stills={}, stillName=null, stillShown=null;
fetch('data/stills.json').then(r=>r.ok?r.json():{}).then(j=>{ stills=j||{}; if(stills._env){ loadEnvHDR(stills._env); delete stills._env; } $('#still-count').textContent=Object.keys(stills).length?`${Object.keys(stills).length} 컷`:'(렌더 대기)'; stillTry(); }).catch(()=>{});
function stillPick(){ if(!stillName||!stillsOn) return null; const x=stillName+'_xray'; if(xrayOn&&stills[x]) return x; return stills[stillName]?stillName:null; }
function stillTry(){ if(fly) return; const k=stillPick(); if(!k){ stillHide(); return; } if(stillShown===k) return; stillShown=k; stillImg.onload=()=>{ if(stillShown!==k) return; stillEl.classList.add('on'); stillEl.classList.toggle('kb',tourOn&&tourAuto); }; stillImg.src='renders/'+stills[k]; }
function stillHide(clearName){ if(clearName) stillName=null; stillShown=null; stillEl.classList.remove('on','kb'); }
canvas.addEventListener('pointerdown',()=>stillHide(true)); canvas.addEventListener('wheel',()=>stillHide(true),{passive:true});
window.__still=()=>({name:stillName,shown:stillShown,on:stillEl.classList.contains('on'),n:Object.keys(stills).length});

// ── 루프 ──
function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight; const pr=renderer.getPixelRatio(); if(canvas.width!==Math.round(w*pr)||canvas.height!==Math.round(h*pr)){ renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); if(composer){ composer.setPixelRatio(pr); composer.setSize(w,h); } } }

// ── 공정 투어 ──
const TOUR_STILL=['view_feed','tour_02_mill','tour_03_screen','tour_04_coarse','view_fines','tour_06_bag','view_dust','view_all'];
const TOUR=[
 {id:'D-101',view:'feed',title:'투입',text:'200 L 드럼을 드럼 반전기 D-101(마스트 2.70 m)이 들어 올려 투입 호퍼 M-101(Ø1.20→0.30, 3면 후드)에 반전 투입합니다. 벨트피더 1 M-102(벨트 EL 0.63) → 버킷 승강기 1 M-103(R3 헤드 +2160, 헤드 통기 EL 5058)으로 올립니다.'},
 {id:'M-104',focus:2.1,xray:true,title:'해쇄',text:'해쇄형 볼밀 DG1080 R10(M-104): D800×1200 드럼 안에서 저속 볼 운동으로 흙덩이를 해쇄합니다(7.5 kW 구동 후보). 둘레 배출창 → 비회전 배출 후드 HD-01 → 유연 접속 FX-01 → S01. 투시(X)로 드럼 내부가 보입니다.'},
 {id:'S01',focus:2.0,xray:true,title:'선별',text:'S01 선별이송기: 진동 트레이 + 2단 체(5 mm EL 2200 / 1 mm EL 1950 검토값, 진동모터 1.5 kW). 5 mm 초과·5~1 mm 산물은 버킷 승강기 2 M-107 → 서지빈 1 M-108 로, 1 mm 이하 미분은 M-112 로 갈라집니다.'},
 {id:'M-110C',focus:2.2,title:'굵은 입자 처리 · 회송',text:'서지빈 1 → 경사 컨베이어 M-109 → 밀폐 처리부 M-110C(LCO₂ 블라스팅, 3.8 m) → 버킷 승강기 3 M-111 → 회송 컨베이어 CV-02 → 흡입 연결함 PK-R3 → 흡입 회수기 RCV-R3(RV)로 R10 에 되돌립니다. 흡입원은 링블로워 M-106.'},
 {id:'M-115',view:'fines',title:'미분 분급',text:'1 mm 이하 미분: 버킷 승강기 4 M-112(R3 남쪽 500 이동) → 서지빈 2 M-113 → 벨트피더 3 M-114 → 공압 이송 TR-01(로터리 에어록 + 송출 블로워 BL-01, 이송관 EL 2.45) → 공기분급기 M-115 에서 1~0.37 mm / 0.37 mm 이하로 나눕니다.'},
 {id:'TB-101',focus:2.4,title:'포장',text:'분급 조분은 톤백 1 TB-101(1~0.37 mm), 분급 미분은 톤백 2 TB-102(0.37 mm 이하)에 담습니다. 백필터 포집 분진은 집진 인계 구역의 톤백 3 TB-103 에 포장합니다.'},
 {id:'M-116',view:'dust',title:'집진 · 공기',text:'백필터 M-116 은 M-103 헤드 집진 DT-R2a(주행 EL 5310)와 R10 후드·S01 집진 DN100×2 를 받습니다. 공기압축기·리시버 M-117 은 블라스터 M-110/M-118 의 공기원, 링블로워 M-106 은 흡입 회송·집진·에어나이프 공기원입니다.'},
 {view:'all',title:'전체 조감',text:'주 이송 → 해쇄·체가름 → 굵은 입자 순환·흡입 회송 → 미분 분급·톤백 → 집진, 네 경로가 한 건물 안에서 닫힙니다. 주황 핀은 제작 보류 7건(클릭 → 위치). 모든 치수는 R3 설계 검토값이며 제작 승인 전입니다.'}
];
const TOUR_DUR=11; let tourOn=false, tourI=0, tourAuto=true, tourT=0, tourXrayBefore=false;
const tourEl=$('#tour'), tourBar=$('#tour-bar'), tourPlay=$('#tour-play'), tourNext=$('#tour-next'), tourDots=$('#tour-dots');
tourDots.innerHTML=TOUR.map((_,i)=>`<i title="${i+1}. ${TOUR[i].title}"></i>`).join('');
tourDots.querySelectorAll('i').forEach((d,i)=>d.onclick=()=>tourGo(i));
function focusUnit(id,f){ const ext=extents[id]; if(!ext||ext.isEmpty()) return false; const cc=new THREE.Vector3(); ext.getCenter(cc); const size=ext.getSize(new THREE.Vector3()).length(); const d=Math.max(4,size*f); const p=cc.clone().add(new THREE.Vector3(d*.55,d*.5,d*.6)); fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:p,t1:cc,f1:36,t:0}; return true; }
function tourGo(i){ tourI=(i+TOUR.length)%TOUR.length; tourT=0; const st=TOUR[tourI];
  if($('#toggle-xray').checked!==!!st.xray) $('#toggle-xray').click();
  if(st.id&&units[st.id]) select(st.id,false); else { highlight(null); selected=null; info.innerHTML=`<span class="chip" style="background:#16a377">공정 투어</span><span class="chip tag">R3 검토값</span><h2>건식선별 설비 전체 — 물질 흐름 4경로</h2><p class="note">${data.flows.map(f=>`<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${f.color};margin-right:6px"></i>${f.name}`).join('<br>')}</p><p class="src">출처: ${data.meta.source}</p>`; }
  if(st.view&&data.views[st.view]){ const v=data.views[st.view]; flyTo(v.pos,v.target,v.fov,TOUR_STILL[tourI]); } else if(st.id){ stillHide(); stillName=TOUR_STILL[tourI]; focusUnit(st.id,st.focus||2); }
  $('#tour-step').textContent=`${tourI+1} / ${TOUR.length}`; $('#tour-title').textContent=st.title; $('#tour-text').textContent=st.text;
  tourNext.textContent=tourI===TOUR.length-1?'처음으로 ↻':'다음 ▶';
  tourDots.querySelectorAll('i').forEach((d,k)=>{ d.classList.toggle('on',k===tourI); d.classList.toggle('done',k<tourI); });
  tourBar.style.width='0%'; }
function tourSetAuto(on){ tourAuto=on; stillEl.classList.toggle('kb',on&&stillEl.classList.contains('on')); tourPlay.textContent=on?'⏸ 자동 진행':'▶ 자동 진행'; tourPlay.classList.toggle('pri',on); if(!on) tourBar.style.width='0%'; }
function tourStart(){ if(tourOn) return; tourOn=true; infoShow(false); tourXrayBefore=xrayOn; document.body.classList.add('touring'); tourEl.hidden=false; if(bokeh) bokeh.enabled=true; tourSetAuto(true); tourGo(0); }
function tourStop(){ if(!tourOn) return; tourOn=false; document.body.classList.remove('touring'); tourEl.hidden=true; if(bokeh) bokeh.enabled=false; controls.autoRotate=false; stillHide(true); if($('#toggle-xray').checked!==tourXrayBefore) $('#toggle-xray').click(); }
$('#tour-start').onclick=tourStart; $('#tour-side').onclick=tourStart; $('#tour-close').onclick=tourStop;
$('#tour-prev').onclick=()=>tourGo(tourI-1); tourNext.onclick=()=>{ tourGo(tourI+1); }; tourPlay.onclick=()=>tourSetAuto(!tourAuto);
canvas.addEventListener('pointerdown',()=>{ if(tourOn&&tourAuto) tourSetAuto(false); });
window.addEventListener('message',e=>{ if(e.data&&e.data.type==='radsoil-twin-tour') tourStart(); });
if(/[?&]tour/.test(location.search)) setTimeout(tourStart,400);
window.__tourState=()=>({i:tourI,t:+tourT.toFixed(2),auto:tourAuto,fly:!!fly,on:tourOn});
function tourLabelOK(id){ if(!tourOn) return true; const st=TOUR[tourI]; if(!st.id) return true; return id===st.id||catOf(id)===catOf(st.id); }
function tourTick(dt){ if(!tourOn||!tourAuto||fly) return; tourT+=dt; tourBar.style.width=Math.min(100,tourT/TOUR_DUR*100)+'%'; if(tourT>=TOUR_DUR){ if(tourI===TOUR.length-1) tourSetAuto(false); else tourGo(tourI+1); } }

const v0=data.views.video||data.views.all; stillName='view_video'; camera.position.copy(toWorld(...v0.pos)); controls.target.copy(toWorld(...v0.target)); camera.fov=v0.fov||36; camera.updateProjectionMatrix();
const tmp=new THREE.Vector3(); let last=performance.now();
function frame(ts){ resize(); const rdt=(ts-last)/1000, dt=Math.min(.05,rdt); last=ts; if(fly){ fly.t=Math.min(1,fly.t+dt*1.3); const k=ease(fly.t); camera.position.lerpVectors(fly.p0,fly.p1,k); controls.target.lerpVectors(fly.t0,fly.t1,k); camera.fov=fly.f0+(fly.f1-fly.f0)*k; camera.updateProjectionMatrix(); if(fly.t>=1){ fly=null; stillTry(); } } controls.autoRotate=tourOn&&tourAuto&&!fly&&!stillEl.classList.contains('on'); controls.autoRotateSpeed=.22; controls.update(); tourTick(Math.min(1,rdt)); if(flowOn) extras.tickFlows(dt);
  const r=canvas.getBoundingClientRect(); const camDist=camera.position.distanceTo(controls.target);
  for(const l of labels){ const ms=groups[l.id]; const show=(labelsOn||(picked&&l.id===selected))&&ms&&ms[0].visible&&camDist<70&&tourLabelOK(l.id); tmp.copy(l.pos).project(camera); const ok=show&&tmp.z<1; l.el.style.display=ok?'':'none'; if(ok){ l.el.style.transform=`translate(-50%,-100%) translate(${(tmp.x*.5+.5)*r.width}px,${(-tmp.y*.5+.5)*r.height}px)`; l.el.classList.toggle('far',camDist>28); } }
  for(const l of holdEls){ tmp.copy(l.pos).project(camera); const ok=holdsOn&&labelsOn&&tmp.z<1&&camDist<40; l.el.style.display=ok?'':'none'; if(ok) l.el.style.transform=`translate(-50%,-100%) translate(${(tmp.x*.5+.5)*r.width}px,${(-tmp.y*.5+.5)*r.height}px)`; }
  if(composer){ if(bokeh&&bokeh.enabled){ bokeh.uniforms.focus.value=camDist; bokeh.uniforms.aperture.value=THREE.MathUtils.clamp(.0022/camDist,.00008,.00032); } if(grade) grade.uniforms.time.value=ts/1000; composer.render(); } else renderer.render(scene,camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
$('#title').textContent=data.meta.title; $('#meta').textContent=`${data.meta.date} · ${data.meta.status}`;
$('#src').textContent=data.meta.source;
select.user=true; select('M-104',false); picked=false; infoShow(false);
window.__twinReady=true;
}
main().catch(e=>{ console.error(e); loadEl.textContent='3D 모델 오류: '+(e&&e.message||e); loadEl.style.background='#b3261e'; window.__twinError=String(e&&e.stack||e); });
