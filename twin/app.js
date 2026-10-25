// 평택 CCU 디지털 트윈 — Blender 절차 생성 glTF(Draco) 실시간 PBR 뷰어 (three 0.180). R07
// 평면 위치·치수 = 플롯플랜 DXF, 외관 세부 = 현장 영상 + 플랜트 상식으로 상상 복원(설계 근거 아님).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {addLogos} from './logo-decals.js';

const $=s=>document.querySelector(s);
const loadEl=$('#loading'); const setLoad=t=>{ if(loadEl) loadEl.textContent=t; };
const EMBED=window.self!==window.top||/[?&]embed/.test(location.search);
if(EMBED) document.body.classList.add('embed');
if(/[?&]mini=1/.test(location.search)) document.body.classList.add('mini'); // 표지용: 패널 숨김
if(window.self!==window.top) addEventListener('keydown',e=>{ if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)&&!/INPUT|TEXTAREA/.test(e.target.tagName)){ e.preventDefault(); parent.postMessage({type:'enis-slide-key',key:e.key},'*'); } });

async function main(){
const data=await (await fetch('data/scene.json')).json();
const units=data.units; const U={}; for(const u of units) U[u.id]=u;
const toWorld=(x,y,z)=>new THREE.Vector3(x,z,-y);

// ── 렌더러 · 장면 ──
const canvas=$('#view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.9; renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const SKY_H='#dfe6ec'; scene.fog=new THREE.Fog(SKY_H,140,520);

// 야외 하늘(그라데이션 돔) + 태양 원반 → 배경 겸 PMREM 환경맵 (실외 HDR 느낌)
function skyScene(bigR){
  const s=new THREE.Scene();
  const geo=new THREE.SphereGeometry(bigR,48,24); const pos=geo.attributes.position; const cols=[];
  const zen=new THREE.Color('#5f93c9'), mid=new THREE.Color('#a9c6e2'), hor=new THREE.Color(SKY_H), gnd=new THREE.Color('#8e8a82'), gnd2=new THREE.Color('#5c5a55');
  for(let i=0;i<pos.count;i++){ const t=pos.getY(i)/bigR; let c; if(t>=0){ c=t<.18?hor.clone().lerp(mid,t/.18):mid.clone().lerp(zen,Math.pow((t-.18)/.82,.7)); } else { c=t>-.08?hor.clone().lerp(gnd,-t/.08):gnd.clone().lerp(gnd2,Math.min(1,(-t-.08)/.5)); } cols.push(c.r,c.g,c.b); }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  s.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})));
  return s;
}
const SUN_DIR=new THREE.Vector3(-0.55,0.72,0.42).normalize();   // 남서쪽 높은 태양 (영상 오후 컷)
{ const env=skyScene(60); const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(2.2,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(14,13,11),fog:false})); sunDisc.position.copy(SUN_DIR).multiplyScalar(55); env.add(sunDisc);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(8,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.7,1.5),transparent:true,opacity:.35,fog:false})); glow.position.copy(SUN_DIR).multiplyScalar(52); env.add(glow);
  const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(env,.02).texture; pm.dispose(); scene.environmentIntensity=.9; }
const bg=skyScene(1500); const bgMesh=bg.children[0]; scene.add(bgMesh);

const camera=new THREE.PerspectiveCamera(30,1,.5,2000);
const controls=new OrbitControls(camera,canvas); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=Math.PI/2-.02; controls.minDistance=3; controls.maxDistance=380;
scene.add(new THREE.HemisphereLight('#cfe0f2','#7a746a',.45));
const sun=new THREE.DirectionalLight('#fff1dc',3.3); sun.position.copy(SUN_DIR).multiplyScalar(230).add(new THREE.Vector3(140,0,-75)); sun.castShadow=true; sun.shadow.mapSize.set(4096,4096); sun.shadow.bias=-.00025; sun.shadow.normalBias=.04; sun.shadow.radius=2.5;
const sc=sun.shadow.camera; sc.left=-75;sc.right=75;sc.top=62;sc.bottom=-62;sc.near=40;sc.far=460; sun.target.position.set(140,0,-75); scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#dbe8f5',.25); fill.position.set(230,70,-250); scene.add(fill);

// ── 바닥 보조: 플롯플랜 선화(곱하기 25%) · 격자 ──
const [bx0,by0,bx1,by1]=data.site.bbox; const gw=bx1-bx0, gd=by1-by0;
const planTex=new THREE.TextureLoader().load(data.site.texture,t=>{t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=renderer.capabilities.getMaxAnisotropy();});
const plan=new THREE.Mesh(new THREE.PlaneGeometry(gw,gd),new THREE.MeshBasicMaterial({map:planTex,transparent:true,opacity:.28,blending:THREE.MultiplyBlending,premultipliedAlpha:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
plan.rotation.x=-Math.PI/2; plan.position.set((bx0+bx1)/2,.07,-(by0+by1)/2); plan.renderOrder=2; plan.visible=false; scene.add(plan);
const grid=new THREE.GridHelper(400,40,'#6f8390','#9fb0ba'); grid.position.set(140,.09,-75); grid.visible=false; grid.material.transparent=true; grid.material.opacity=.5; scene.add(grid);

// ── glTF 로드 ──
const groups={}, extents={}, pick=[], shellMeshes=[];
const draco=new DRACOLoader(); draco.setDecoderPath('./vendor180/draco/');
const loader=new GLTFLoader(); loader.setDRACOLoader(draco);
setLoad('3D 모델 불러오는 중 …');
const modelSrc=(data.meta.model&&data.meta.model.src)||'data/ccu_plant.glb';
const gltf=await new Promise((res,rej)=>loader.load(modelSrc,res,e=>{ if(e.total) setLoad(`3D 모델 불러오는 중 … ${Math.round(e.loaded/e.total*100)} %`); },rej));
const plant=gltf.scene; plant.name='plant'; scene.add(plant); plant.updateMatrixWorld(true);
const SHELL=/^(clad|cladwall|roof|roofwhite|roofglass|wall|glass|frp|ghost|ptank|louver)$/; const GROUND_IDS=new Set(['site','road','future','wet','liq_pad']);
const bb=new THREE.Box3(); let meshCount=0, triCount=0;
plant.traverse(o=>{
  if(!o.isMesh) return; meshCount++;
  let p=o, id=null, nm=null, mk=null; while(p&&!id){ id=p.userData.twin_id||null; nm=p.userData.twin_name||null; mk=p.userData.twin_mat||null; p=p.parent; }
  id=id||'ETC'; o.userData.owner=id; o.userData.twin_name=nm||o.name; o.userData.mat=mk||'';
  const m=o.material; if(m){ m.envMapIntensity=1.0; if(m.transparent||m.opacity<1){ m.transparent=true; m.depthWrite=false; o.castShadow=false; } if(m.alphaTest>0||(m.map&&/grating|chain|guard/.test(mk||''))){ m.alphaTest=.45; m.transparent=false; m.side=THREE.DoubleSide; } if(mk==='lamp'||mk==='screen'){ m.emissiveIntensity=.8; } if(mk==='gravel'||mk==='dirt'||mk==='asphalt'||mk==='concrete_pad'){ m.envMapIntensity=.35; } }
  o.castShadow=!GROUND_IDS.has(id)||mk==='curb'; o.receiveShadow=true;
  if(id==='site'&&(mk==='gravel'||mk==='dirt')) o.castShadow=false;
  if(SHELL.test(mk||'')&&!GROUND_IDS.has(id)&&id!=='admin') shellMeshes.push(o);
  if(mk==='wall'||mk==='cladwall'||mk==='roof') { if(id==='admin') shellMeshes.push(o); }
  (groups[id]=groups[id]||[]).push(o); if(!(id==='site'&&(mk==='gravel'||mk==='dirt'))) pick.push(o);
  if(o.geometry.index) triCount+=o.geometry.index.count/3;
  if(id!=='site'){ o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); (extents[id]=extents[id]||new THREE.Box3()).union(bb); }
});
await addLogos(THREE,scene,extents); // data/logos.json: 건물·설비 로고 명판
loadEl.remove();
window.__twinStats={meshes:meshCount,tris:Math.round(triCount),ids:Object.keys(groups).length};

// ── 라벨 (HTML overlay) ──
const labelLayer=$('#labels'); const labels=[];
const SKIP=new Set(['liq_drum1','liq_drum2','stack','aircomp','wet_str','v1121','v1131','v1901','lorry2','ct_b','liq_pad','road','future','wet']);
function anchorOf(u){ const e=extents[u.id]; if(e&&!e.isEmpty()){ const c=new THREE.Vector3(); e.getCenter(c); return new THREE.Vector3(c.x,e.max.y+(u.type==='cyl'&&!u.id.startsWith('ro_')?1.2:.5),c.z); } return toWorld(u.x||(u.x0+u.x1)/2,u.y||(u.y0+u.y1)/2,(u.h||6)+1); }
for(const u of units){ if(SKIP.has(u.id)||u.id.startsWith('ro_')) continue; const el=document.createElement('button'); el.className='label cat-'+u.cat; el.textContent=u.name.replace(/\s*\(.*$/,''); el.onclick=()=>select(u,true); labelLayer.appendChild(el); labels.push({el,pos:anchorOf(u),u}); }
for(const u of units){ if(!u.id.startsWith('ro_')) continue; const el=document.createElement('button'); el.className='label small cat-wwt'; el.textContent=u.name.replace(/\s*\(.*$/,''); el.onclick=()=>select(u,true); labelLayer.appendChild(el); labels.push({el,pos:anchorOf(u),u,near:true}); }

// ── UI ──
let labelsOn=false, aoOn=true, xrayOn=false;
const catBox=$('#cats');
for(const [k,c] of Object.entries(data.cats)){ const row=document.createElement('label'); row.innerHTML=`<input type="checkbox" data-cat="${k}" checked><i style="background:${c.color}"></i>${c.name}`; catBox.appendChild(row); row.querySelector('input').onchange=e=>{ for(const u of units) if(u.cat===k) (groups[u.id]||[]).forEach(m=>m.visible=e.target.checked); }; }
$('#toggle-plan').onchange=e=>{ plan.visible=e.target.checked; };
$('#toggle-grid').onchange=e=>{ grid.visible=e.target.checked; };
$('#toggle-labels').onchange=e=>{ labelsOn=e.target.checked; };
$('#toggle-ao').onchange=e=>{ aoOn=e.target.checked; };
$('#toggle-xray').onchange=e=>setXray(e.target.checked);
function setXray(on){ xrayOn=on; for(const m of shellMeshes){ if(on){ if(!m.userData._solid){ m.userData._solid=m.material; const t=m.material.clone(); t.transparent=true; t.opacity=.14; t.depthWrite=false; t.side=THREE.DoubleSide; m.userData._xr=t; } m.material=m.userData._xr; m.castShadow=false; } else if(m.userData._solid){ m.material=m.userData._solid; m.castShadow=true; } } if(selected) highlight(selected.id); }
const viewBox=$('#views');
for(const [k,v] of Object.entries(data.views)){ const b=document.createElement('button'); b.textContent=v.name; b.onclick=()=>flyTo(v.pos,v.target,v.fov); viewBox.appendChild(b); }
const vid=$('#vid'), vidEl=$('#vid video'); if(data.meta.video){ vidEl.src=data.meta.video.src; $('#vid .cap').textContent=data.meta.video.label; $('#show-video').onclick=()=>{ vid.style.display=''; vidEl.currentTime=0; vidEl.play().catch(()=>{}); }; $('#vid .close').onclick=()=>{ vidEl.pause(); vid.style.display='none'; }; } else { $('#show-video').style.display='none'; }
function showVideoAt(t){ if(!data.meta.video) return; vid.style.display=''; const seek=()=>{ vidEl.currentTime=t; vidEl.play().catch(()=>{}); }; if(vidEl.readyState>=1) seek(); else vidEl.addEventListener('loadedmetadata',seek,{once:true}); }
$('#fullscreen').onclick=()=>{ const el=document.documentElement; const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 if(isFs()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); return; }
 if(document.body.classList.contains('pseudo-full')){ setPseudo(false); return; }
 let p=null; try{ const req=el.requestFullscreen||el.webkitRequestFullscreen; p=req&&req.call(el); }catch(e){}
 if(p&&p.catch) p.catch(()=>{}); setTimeout(()=>{ if(!isFs()) setPseudo(true); },1200); };
function setPseudo(on){ document.body.classList.toggle('pseudo-full',on); const b=$('#fullscreen'); if(b) b.textContent=on?'전체화면 해제':'전체화면'; parent.postMessage({type:'enis-twin-full',on},'*'); setTimeout(()=>dispatchEvent(new Event('resize')),50); }
addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('pseudo-full')) setPseudo(false); });
for(const ev of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(ev,()=>{ const fs=!!(document.fullscreenElement||document.webkitFullscreenElement); if(fs&&document.body.classList.contains('pseudo-full')) setPseudo(false); const b=$('#fullscreen'); if(b) b.textContent=fs?'전체화면 해제':'전체화면'; });
window.addEventListener('keydown',e=>{ if(/INPUT|TEXTAREA/.test(e.target.tagName)) return; if(e.key==='x'||e.key==='X'){ $('#toggle-xray').click(); } });

// ── 카메라 ──
let fly=null;
function flyTo(pos,target,fov){ fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:toWorld(...pos),t1:toWorld(...target),f1:fov||32,t:0}; }
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;

// ── 선택 · 정보 ──
const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(); let selected=null, hover=null;
const info=$('#info');
$('#panel-btn').onclick=()=>document.body.classList.toggle('panel-open'); $('#side-close').onclick=()=>document.body.classList.remove('panel-open');
function infoShow(on){ info.classList.toggle('show',!!on); if(on&&!info.querySelector('.close-x')){ const b=document.createElement('button'); b.className='close-x'; b.textContent='✕'; b.title='닫기'; b.onclick=()=>infoShow(false); info.prepend(b); } }
const selBox=new THREE.Box3Helper(new THREE.Box3(),0xffb300); selBox.material.depthTest=false; selBox.material.transparent=true; selBox.material.opacity=.55; selBox.visible=false; scene.add(selBox);
function highlight(id){ for(const [gid,ms] of Object.entries(groups)){ if(gid==='site') continue; const on=gid===id; for(const m of ms){ if(on){ const cur=m.material; if(!m.userData._hl||m.userData._hlFrom!==cur){ const c=cur.clone(); c.emissive=new THREE.Color('#ffb300'); c.emissiveIntensity=.09; m.userData._hl=c; m.userData._hlFrom=cur; m.userData._base=cur; } m.material=m.userData._hl; } else if(m.userData._hl&&m.material===m.userData._hl){ m.material=m.userData._base; } } } }
function facts(u){ const f=[]; if(u.type==='box') f.push(`평면 ${u.w} × ${u.d} m`,`높이 ${u.h} m`); if(u.type==='cyl') f.push(`Ø${u.dia} m`,`높이 ${u.h} m`); if(u.type==='hcyl') f.push(`Ø${u.dia} × ${u.len} m`,`중심 EL.${u.z} m`); if(u.type==='rack') f.push(`${(u.x1-u.x0).toFixed(1)} × ${(u.y1-u.y0).toFixed(1)} m`,`TOS ${u.levels.map(l=>'EL.'+(l*1000)).join(' / ')}`); const e=extents[u.id]; if(e&&!e.isEmpty()) f.push(`모델 상단 EL.${e.max.y.toFixed(1)} m · 부품 ${groups[u.id].length}`); return f; }
let picked=false;
function select(u,focus){ selected=u; if(select.user) picked=true; highlight(u.id); { const e=extents[u.id]; if(e&&!e.isEmpty()){ selBox.box.copy(e).expandByScalar(.2); selBox.visible=true; } else selBox.visible=false; } const c=data.cats[u.cat]; const est=/추정|근사|상상|HOLD|범례/.test((u.note||'')+(u.name||''));
  info.innerHTML=`<span class="chip" style="background:${c.color}">${c.name}</span>${u.tag?`<span class="chip tag">${u.tag}</span>`:''}${est?'<span class="chip est">형상·높이 추정</span>':''}<h2>${u.name}</h2><p class="facts">${facts(u).join(' · ')}</p>${u.note?`<p class="note">${u.note}</p>`:''}<p class="src">출처: ${u.source||data.meta.source} · 외관 세부는 영상 기반 상상 복원</p>${u.video_t!=null?`<button class="vbtn" id="vbtn">현장 영상 ${Math.floor((data.meta.video.offset+u.video_t)/60)}:${String((data.meta.video.offset+u.video_t)%60).padStart(2,'0')} 보기</button>`:''}`; infoShow(select.user); if(u.video_t!=null) $('#vbtn').onclick=()=>showVideoAt(u.video_t);
  if(focus){ const e=extents[u.id]; if(e&&!e.isEmpty()){ const cc=new THREE.Vector3(); e.getCenter(cc); const size=e.getSize(new THREE.Vector3()); const d=Math.max(8,Math.max(size.x,size.z)*1.25+size.y*.9); const p=cc.clone().add(new THREE.Vector3(d*.55,d*.42,d*.6)); fly={p0:camera.position.clone(),t0:controls.target.clone(),f0:camera.fov,p1:p,t1:cc,f1:32,t:0}; } } }
function pickAt(cx,cy){ const r=canvas.getBoundingClientRect(); mouse.set(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1); ray.setFromCamera(mouse,camera); const hits=ray.intersectObjects(pick,false); for(const h of hits){ if(!h.object.visible) continue; const id=h.object.userData.owner; if(id==='site') continue; if(xrayOn&&h.object.material&&h.object.material===h.object.userData._xr) continue; const u=U[id]; if(u) return u; } return null; }
let downAt=null; canvas.addEventListener('pointerdown',e=>downAt=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{ if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5) return; const u=pickAt(e.clientX,e.clientY); if(u) select(u,false); else infoShow(false); });
let lastHover=0; canvas.addEventListener('pointermove',e=>{ const now=performance.now(); if(now-lastHover<80) return; lastHover=now; const u=pickAt(e.clientX,e.clientY); canvas.style.cursor=u?'pointer':''; if(u!==hover){ hover=u; $('#hover').textContent=u?u.name:''; } });

// ── 가상 운전지표 (시연) ──
const tele=[{k:'LCO₂ 생산',unit:'t/d',base:53.7,amp:2.1},{k:'포집 CO₂ 농도',unit:'%',base:99.5,amp:.3},{k:'액화 압력',unit:'bar',base:18,amp:.8},{k:'저장탱크 레벨',unit:'%',base:62,amp:6},{k:'RO 재이용수',unit:'㎥/h',base:1.2,amp:.15},{k:'냉각수 공급온도',unit:'℃',base:28,amp:1.5}];
const teleBox=$('#tele'); teleBox.innerHTML=tele.map((t,i)=>`<div class="t"><span>${t.k}</span><b id="t${i}">–</b><small>${t.unit}</small></div>`).join('');
let lastTele=0; function tick(ts){ if(ts-lastTele<400) return; lastTele=ts; tele.forEach((t,i)=>{ const v=t.base+t.amp*Math.sin(ts/4000+i*1.3)+t.amp*.3*Math.sin(ts/700+i); $('#t'+i).textContent=v.toFixed(1); }); }

// ── 후처리 (GTAO) ──
let composer=null, gtao=null;
try{ composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera)); gtao=new GTAOPass(scene,camera,2,2); gtao.output=GTAOPass.OUTPUT.Default; gtao.blendIntensity=.7; gtao.updateGtaoMaterial({radius:1.2,distanceExponent:1,thickness:1,scale:1,samples:12,distanceFallOff:1,screenSpaceRadius:false}); gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,radiusExponent:1,rings:2,samples:12}); composer.addPass(gtao); composer.addPass(new OutputPass()); }catch(err){ console.warn('GTAO 사용 불가',err); composer=null; $('#toggle-ao').disabled=true; aoOn=false; }

// ── 루프 ──
function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight; const pr=renderer.getPixelRatio(); if(canvas.width!==Math.round(w*pr)||canvas.height!==Math.round(h*pr)){ renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); if(composer){ composer.setPixelRatio(pr); composer.setSize(w,h); } } }
const v0=data.views.drone||data.views.all; camera.position.copy(toWorld(...v0.pos)); controls.target.copy(toWorld(...v0.target)); camera.fov=v0.fov||32; camera.updateProjectionMatrix();
const tmp=new THREE.Vector3(); let last=performance.now();
function frame(ts){ resize(); const rdt=(ts-last)/1000, dt=Math.min(.05,rdt); last=ts; if(fly){ fly.t=Math.min(1,fly.t+Math.min(.34,rdt)*1.1); const k=ease(fly.t); camera.position.lerpVectors(fly.p0,fly.p1,k); controls.target.lerpVectors(fly.t0,fly.t1,k); camera.fov=fly.f0+(fly.f1-fly.f0)*k; camera.updateProjectionMatrix(); if(fly.t>=1) fly=null; } controls.update(); tick(ts||0); bgMesh.position.copy(camera.position);
  const r=canvas.getBoundingClientRect(); const camDist=camera.position.distanceTo(controls.target);
  for(const l of labels){ tmp.copy(l.pos).project(camera); const behind=tmp.z>1; const g=groups[l.u.id]; const show=(labelsOn||(picked&&selected&&selected.id===l.u.id))&&!behind&&g&&g[0].visible&&!(l.near&&camDist>60)&&!(l.u.cat==='wwt'&&!l.near&&camDist<40)&&camDist<260; l.el.style.display=show?'':'none'; if(show){ l.el.style.transform=`translate(-50%,-100%) translate(${(tmp.x*.5+.5)*r.width}px,${(-tmp.y*.5+.5)*r.height}px)`; l.el.style.opacity=camDist>180?.75:1; } }
  if(composer&&aoOn) composer.render(); else renderer.render(scene,camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
$('#title').textContent=data.meta.title; $('#meta').textContent=`${data.meta.source} · ${data.meta.heights}`;
select(U.liq||units[0],false); select.user=true;
window.__twinReady=true;
}
main().catch(e=>{ console.error(e); if(loadEl){ loadEl.textContent='3D 모델 오류: '+(e&&e.message||e); loadEl.style.background='#b3261e'; } window.__twinError=String(e&&e.stack||e); });
