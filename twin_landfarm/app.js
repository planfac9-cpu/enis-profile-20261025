// 경작법(Landfarming) 정화시설 디지털 트윈 v3 — Blender 절차 모델 glb(R12 · Draco) + three 0.180 PBR + PMREM 환경광
// v2(app.R11.bak.js)의 three.js 절차 생성 기하를 코덱스가 만든 twin_landfarm/data/landfarm.glb 로 교체. UI·라벨·절개·애니메이션·전체화면 규약은 v2 와 동일.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
const $=s=>document.querySelector(s);
const EMBED=window.self!==window.top||/[?&]embed/.test(location.search);
if(EMBED) document.body.classList.add('embed'); if(/[?&]mini=1/.test(location.search)) document.body.classList.add('mini');

// ── 렌더러·씬·조명 ──
const canvas=$('#view');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();
{const c=document.createElement('canvas');c.width=4;c.height=256;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#6fa3d6');gr.addColorStop(.55,'#cfe0ee');gr.addColorStop(1,'#e9eef2');g.fillStyle=gr;g.fillRect(0,0,4,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;scene.background=t;}
scene.fog=new THREE.Fog(0xdde6ee,110,260);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.55;
const camera=new THREE.PerspectiveCamera(40,1,.1,600);const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=160;
scene.add(new THREE.HemisphereLight(0xcfe3f5,0x6b5a40,.5));
const sun=new THREE.DirectionalLight(0xfff1dc,2.6);sun.position.set(34,46,20);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-52,right:52,top:42,bottom:-42,near:1,far:150});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;scene.add(sun);
const rnd=(()=>{let s=1234567;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};})();

// ── 절개(앞쪽 z>0 제거) ──
const cutPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);let cutOn=true;const clipped=[];
function applyCut(){for(const m of clipped){m.clippingPlanes=cutOn?[cutPlane]:[];m.needsUpdate=true;}}

// ── 구성 요소 메타(표시명·설명·라벨 위치) — 기하는 glb ──
const L=36,W=14,HL=L/2,HW=W/2,SLOPE=.01;
const CATS={ground:{name:'원지반·기초',color:'#9a9a72'},layer:{name:'차수·배수층',color:'#2b2b2b'},soil:{name:'오염토양·영양염류',color:'#5a3d27'},cover:{name:'빗물유입차단(알루미늄·PC)',color:'#7fb3d5'},water:{name:'침출수 처리',color:'#277fb6'},equip:{name:'장비',color:'#e0a21b'}};
const UNITS={},groups={},labels=[],pickables=[];
function unit(id,cat,name,facts,note,labelPos){UNITS[id]={id,cat,name,facts,note,labelPos};}
unit('ground','ground','원지반 (자연 지반)',['굴착 바닥·측벽 · 바닥 경사 약 1 % (맨홀 방향)','셀 규모 36 × 14 m · 깊이 약 1.5 m — 가정값'],'셀 바닥은 침출수가 맨홀 쪽으로 모이도록 정지하고, 바닥·측벽에 차수막을 깔기 전 다짐합니다.',[-HL-1.5,.3,HW+1]);
unit('sandbed','layer','모래 다짐토 (차수막 하부)',['두께 약 0.25 m — 가정값','경사 1 % 로 정지·다짐'],'차수막이 찢기지 않도록 평탄하게 다진 모래층입니다. 경사를 주어 침출수가 수집관으로 흐르게 합니다.',[-HL+4,-.95,-HW]);
unit('liner','layer','침출수 차수막 (HDPE 시트)',['두께 1.5~2 mm 급 — 일반값','바닥 + 측벽 끝단까지 연장'],'침출수가 지하로 스며들지 않도록 바닥과 측벽을 감싸는 불투수막입니다. 도식의 "침출수 차수막".',[HL-4,-.8,-HW]);
unit('gravel','layer','배수 자갈층',['수집관 주변 쇄석 0.3 m — 가정값'],'유공관 주변을 자갈로 채워 침출수가 막힘 없이 관으로 모이게 합니다.',[6,-.6,.6]);
unit('pipe','water','침출수 수집 파이프 (유공관)',['Ø200 mm 급 유공관 · 지관 3열 — 가정값','경사 1 % 따라 맨홀로 집수'],'바닥 중앙을 따라 깔린 구멍 뚫린 관입니다. 모인 침출수가 경사를 따라 맨홀로 흘러갑니다. 도식의 "침출수 수집 파이프".',[-HL+2,-.55,0]);
unit('sandp','layer','보호 모래층 (차수막 상부)',['두께 약 0.2 m — 가정값'],'오염토양이나 장비가 차수막을 손상하지 않도록 차수막 위를 덮는 모래층입니다.',[HL-2,-.68,HW-1]);
unit('soil','soil','오염토양 (반입 오염토)',['적치 높이 1.5~2 m — 일반값','경작(뒤집기·파쇄)으로 통기 · 미생물 분해'],'유류 등으로 오염된 토양을 셀에 펼쳐 넣고 주기적으로 갈아엎어 산소를 공급합니다. 토양 속 미생물이 오염물질을 분해하는 생물학적 정화(경작법)입니다.',[0,1.5,-2]);
unit('nutrient','soil','영양염류 공급 (살수 배관)',['질소·인 영양염류 + 수분 살포','헤더관 + 살수 노즐 — 가정값'],'미생물이 활발히 오염물질을 분해하도록 질소·인 같은 영양염류와 수분을 토양 위에 뿌리는 설비입니다. 도식의 "영양염류공급".',[0,3.1,0]);
unit('cover','cover','빗물유입차단시설 (알루미늄 골조 · 폴리카보네이트 지붕)',['아치형 알루미늄 박스 골조 · 투명 PC 복층판','높이 약 4.6 m · 기둥 간격 4 m — 가정값','강우 유입 차단 → 침출수 발생 최소화'],'비가 오염토양에 닿아 침출수가 늘어나는 것을 막기 위해 셀 위를 덮는 지붕 구조물입니다. 알루미늄 골조에 투명 폴리카보네이트 판을 얹어 채광이 좋습니다. 도식의 "빗물유입차단시설".',[0,5.2,HW+1.6]);
unit('manhole','water','맨홀 (침출수 집수조)',['Ø1.6 m · 깊이 약 3 m — 가정값','수집관 유입 → 이송관 유출'],'수집관으로 모인 침출수가 떨어져 고이는 콘크리트 집수조입니다. 도식의 "맨홀".',[-HL-4.5,.9,0]);
unit('outlet','water','폐수처리장 이송관',['Ø150 mm 급 · 자연유하/펌프 이송 — 가정값'],'맨홀에 모인 침출수를 폐수처리장으로 보내는 관입니다. 도식의 "폐수처리장으로 이송".',[-HL-11,-1.6,0]);
unit('excavator','equip','굴착기 (경작 장비 · 20 t 급)',['경작: 토양 뒤집기·파쇄·통기','궤도식 · 붐·암·버킷 유압 — 일반 사양'],'셀 위의 오염토양을 주기적으로 갈아엎어 산소를 넣고 영양분을 섞습니다. 통기가 잘 될수록 미생물 분해가 빨라집니다.',[HL+4,3.8,0]);

// ── glb 로드 (R12: twin_id extras · cell 그룹 · 굴착기 관절 Empty · 실린더 앵커) ──
const loadEl=$('#loading');const setLoad=t=>{if(loadEl)loadEl.textContent=t;};
const LOD=/[?&]lod=preview/.test(location.search)?'preview':'final';
const draco=new DRACOLoader();draco.setDecoderPath('../twin/vendor180/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
const loadModel=src=>new Promise((res,rej)=>loader.load(src,res,e=>{if(e.total)setLoad(`3D 모델 불러오는 중 … ${Math.round(e.loaded/e.total*100)} %`);},rej));
setLoad('3D 모델 불러오는 중 …');
let gltf;try{gltf=await loadModel(LOD==='preview'?'data/landfarm_preview.glb':'data/landfarm.glb');}catch(e){console.warn('landfarm.glb 실패 → preview',e);gltf=await loadModel('data/landfarm_preview.glb');}
let LOG={};try{const r=await fetch('data/export_log.json');if(r.ok)LOG=await r.json();}catch(e){}
const model=gltf.scene;model.name='landfarm';scene.add(model);
const nodes={};model.traverse(o=>{if(o.name&&!nodes[o.name])nodes[o.name]=o;});
for(const id of Object.keys(UNITS)){groups[id]=nodes[id]||new THREE.Group();if(!nodes[id])console.warn('glb 에 노드 없음:',id);}
const cell=nodes.cell||model;cell.rotation.z=Math.atan(SLOPE); // 경사 1 % 는 glb 에 없고 뷰어가 cell 그룹을 회전(R12 §4)
const NOCLIP=new Set(['excavator','nutrient']);const clipClones=new Map();let meshCount=0,triCount=0;
model.traverse(o=>{if(!o.isMesh)return;meshCount++;let p=o,id=null;while(p&&!id){id=p.userData.twin_id||null;p=p.parent;}o.userData.id=id||'ETC';
 const src=Array.isArray(o.material)?o.material:[o.material];const isPC=src.some(m=>m.name==='pc'),isGlass=src.some(m=>m.name==='glass');
 if(!NOCLIP.has(id)){const out=src.map(m=>{let c=clipClones.get(m.uuid);if(!c){c=m.clone();c.name=m.name;c.clippingPlanes=[cutPlane];c.clipShadows=true;c.side=THREE.DoubleSide;clipClones.set(m.uuid,c);clipped.push(c);}return c;});o.material=out.length===1?out[0]:out;}
 for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.envMapIntensity=1;if(m.name==='pc'||m.name==='glass'){m.transparent=true;m.depthWrite=false;}}
 if(isPC||isGlass)o.renderOrder=2;
 o.castShadow=!(isPC||/terrain_top|subsoil|driveway|road_stones/.test(o.name));o.receiveShadow=true;
 if(o.geometry.index)triCount+=o.geometry.index.count/3;pickables.push(o);});
model.updateMatrixWorld(true);
window.__twinStats={meshes:meshCount,tris:Math.round(triCount),ids:Object.keys(groups).length,lod:LOD,glb_bytes:LOG.glb_bytes};

// ── 굴착기 관절·유압 실린더 (export_log.json cylinders 규약: 앵커 A→B 사이 lookAt·길이 조정) ──
const rig={upper:nodes.exc__upper,boom:nodes.exc__boom,stick:nodes.exc__stick,bucket:nodes.exc__bucket};const rest={};for(const k in rig)if(rig[k])rest[k]=rig[k].quaternion.clone();
const CYLS=Object.values(LOG.cylinders||{}).map(c=>({A:nodes[c.A],B:nodes[c.B],body:nodes[c.body],rod:nodes[c.rod],bl:c.body_length_fraction,bc:c.body_center_fraction,rl:c.rod_length_fraction,rc:c.rod_center_fraction})).filter(c=>c.A&&c.B&&c.body&&c.rod);
const _A=new THREE.Vector3(),_B=new THREE.Vector3(),_D=new THREE.Vector3(),_P=new THREE.Vector3(),_Q=new THREE.Quaternion(),_PQ=new THREE.Quaternion(),_R=new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0),ZAX=new THREE.Vector3(0,0,1);
function updateCyls(){if(!CYLS.length)return;model.updateMatrixWorld(true);for(const c of CYLS){c.A.getWorldPosition(_A);c.B.getWorldPosition(_B);_D.subVectors(_B,_A);const len=_D.length();_D.normalize();_Q.setFromUnitVectors(UP,_D);
 for(const [o,lf,cf] of [[c.body,c.bl,c.bc],[c.rod,c.rl,c.rc]]){_P.copy(_A).lerp(_B,cf);o.parent.worldToLocal(_P);o.position.copy(_P);o.parent.getWorldQuaternion(_PQ).invert();o.quaternion.copy(_PQ).multiply(_Q);o.scale.y=len*lf;}}}
function pose(k,axis,ang){const o=rig[k];if(!o)return;o.quaternion.copy(rest[k]).multiply(_R.setFromAxisAngle(axis,ang));}

// ── 흐름·살수 입자 (뷰어 생성 — glb 에 없음) ──
const flowM=new THREE.MeshStandardMaterial({color:0x4ea6e6,emissive:0x1b6fb0,emissiveIntensity:.6});flowM.clippingPlanes=[cutPlane];clipped.push(flowM);
const drops=[];for(let i=0;i<14;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),flowM);d.userData.t=i/14;cell.add(d);drops.push(d);}
const sprayGeo=new THREE.BufferGeometry();const N=420;const sp=new Float32Array(N*3),sv=new Float32Array(N*2);for(let i=0;i<N;i++){sv[i*2]=rnd();sv[i*2+1]=-15+Math.floor(rnd()*7)*5;}sprayGeo.setAttribute('position',new THREE.BufferAttribute(sp,3));const spray=new THREE.Points(sprayGeo,new THREE.PointsMaterial({color:0xbfe3ff,size:.08,transparent:true,opacity:.75}));scene.add(spray);

// ── 라벨·선택·정보 ──
const labelLayer=$('#labels');for(const u of Object.values(UNITS)){const el=document.createElement('button');el.className='label';el.textContent=u.name.replace(/\s*\(.*$/,'');el.onclick=()=>select(u,true);labelLayer.appendChild(el);labels.push({u,el,pos:new THREE.Vector3(...u.labelPos)});}
let labelsOn=false,picked=false,selected=null,animOn=true;const info=$('#info'),infoBody=$('#info-body');function infoShow(on){info.classList.toggle('show',!!on);}$('#info-close').onclick=()=>infoShow(false);
const selBox=new THREE.Box3Helper(new THREE.Box3(),0xffb300);selBox.visible=false;scene.add(selBox);
function select(u,user){selected=u;if(user)picked=true;const b=new THREE.Box3().setFromObject(groups[u.id]);if(!b.isEmpty()){selBox.box.copy(b).expandByScalar(.15);selBox.visible=true;}const c=CATS[u.cat];
 infoBody.innerHTML=`<span class="chip" style="background:${c.color}">${c.name}</span><span class="chip est">개념 모델 · 치수 가정</span><h2>${u.name}</h2><p class="facts">${u.facts.join(' · ')}</p><p class="note">${u.note}</p><p class="src">출처: 경작법 정화시설 단면 도식 · 형상·치수는 일반 설계 범위의 가정 · 굴착기는 20 t 급 일반 형상(절차 모델, 특정 제조사 아님)</p>`;if(user)infoShow(true);}
const ray=new THREE.Raycaster();let downAt=null;canvas.addEventListener('pointerdown',e=>downAt=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5)return;const u=pickAt(e.clientX,e.clientY);if(u)select(u,true);else{infoShow(false);selBox.visible=false;selected=null;}});
canvas.addEventListener('pointermove',e=>{const u=pickAt(e.clientX,e.clientY);$('#hover').textContent=u?u.name:'';canvas.style.cursor=u?'pointer':'';});
function visibleUp(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
function pickAt(x,y){const r=canvas.getBoundingClientRect();ray.setFromCamera({x:((x-r.left)/r.width)*2-1,y:-((y-r.top)/r.height)*2+1},camera);const hits=ray.intersectObjects(pickables,false);for(const h of hits){if(!visibleUp(h.object))continue;const mm=Array.isArray(h.object.material)?h.object.material[0]:h.object.material;if(cutOn&&mm.clippingPlanes&&mm.clippingPlanes.length&&h.point.z>cutPlane.constant)continue;const id=h.object.userData.id;if(id&&UNITS[id]&&groups[id].visible)return UNITS[id];}return null;}
// ── 패널 ──
const VIEWS=[['단면',[13,8,31],[0,-.6,0]],['전경',[34,16,36],[0,.5,0]],['상부',[0,48,.01],[0,0,0]],['맨홀',[-30,5,13],[-23,-1.2,0]],['굴착기',[29,4,9],[HL+3,1.6,0]],['차수·배수층',[-6,2.5,14],[-4,-.9,0]],['지붕 골조',[8,9,16],[0,3.5,0]]];
const views=$('#views');VIEWS.forEach(([n,p,t])=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>goView(p,t);views.appendChild(b);});
let flyFrom=null,flyTo=null,flyT=1;function goView(p,t){flyFrom={p:camera.position.clone(),t:controls.target.clone()};flyTo={p:new THREE.Vector3(...p),t:new THREE.Vector3(...t)};flyT=0;}
const cats=$('#cats'),legend=$('#legend');for(const [k,c] of Object.entries(CATS)){const l=document.createElement('label');l.innerHTML=`<input type="checkbox" checked data-cat="${k}"><i style="background:${c.color}"></i>${c.name}`;cats.appendChild(l);l.querySelector('input').onchange=e=>{for(const u of Object.values(UNITS))if(u.cat===k)groups[u.id].visible=e.target.checked;};const s=document.createElement('span');s.innerHTML=`<i style="background:${c.color}"></i>${c.name}`;legend.appendChild(s);}
$('#toggle-cut').onchange=e=>{cutOn=e.target.checked;applyCut();};$('#cut-pos').oninput=e=>{cutPlane.constant=Number(e.target.value);};$('#toggle-cover').onchange=e=>{groups.cover.visible=e.target.checked;};$('#toggle-anim').onchange=e=>{animOn=e.target.checked;};$('#toggle-labels').onchange=e=>{labelsOn=e.target.checked;};
{const t=$('#toggle-pc');if(t&&nodes.cover__pc)t.onchange=e=>{nodes.cover__pc.visible=e.target.checked;};}
$('#panel-btn').onclick=()=>document.body.classList.add('panel-open');$('#side-close').onclick=()=>document.body.classList.remove('panel-open');
$('#fullscreen').onclick=()=>{ const el=document.documentElement; const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 if(isFs()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); return; }
 if(document.body.classList.contains('pseudo-full')){ setPseudo(false); return; }
 let p=null; try{ const req=el.requestFullscreen||el.webkitRequestFullscreen; p=req&&req.call(el); }catch(e){}
 if(p&&p.catch) p.catch(()=>{}); setTimeout(()=>{ if(!isFs()) setPseudo(true); },1200); };
function setPseudo(on){ document.body.classList.toggle('pseudo-full',on); const b=$('#fullscreen'); if(b) b.textContent=on?'전체화면 해제':'전체화면'; parent.postMessage({type:'enis-twin-full',on},'*'); setTimeout(()=>dispatchEvent(new Event('resize')),50); }
for(const ev of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(ev,()=>{ const fs=!!(document.fullscreenElement||document.webkitFullscreenElement); if(fs&&document.body.classList.contains('pseudo-full')) setPseudo(false); const b=$('#fullscreen'); if(b) b.textContent=fs?'전체화면 해제':'전체화면'; });
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('pseudo-full'))setPseudo(false);if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();parent.postMessage({type:'enis-slide-key',key:e.key},'*');}else if(e.key==='c'||e.key==='C'){$('#toggle-cut').click();}});
// ── 루프 ──
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;const pr=renderer.getPixelRatio();if(canvas.width!==Math.floor(w*pr)||canvas.height!==Math.floor(h*pr)){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
const tmp=new THREE.Vector3();const clock=new THREE.Clock();
function frame(){resize();const dt=Math.min(clock.getDelta(),.05);const t=clock.elapsedTime;
 if(flyT<1){flyT=Math.min(1,flyT+dt*1.4);const k=flyT<.5?2*flyT*flyT:-1+(4-2*flyT)*flyT;camera.position.lerpVectors(flyFrom.p,flyTo.p,k);controls.target.lerpVectors(flyFrom.t,flyTo.t,k);}
 controls.update();
 if(animOn){const c=t*.55;pose('upper',UP,.06*Math.sin(c*.5));pose('boom',ZAX,.07*Math.sin(c));pose('stick',ZAX,.3*Math.sin(c+1.1));pose('bucket',ZAX,.4*Math.sin(c+2.1));
  for(const d of drops){d.userData.t=(d.userData.t+dt*.08)%1;const u=d.userData.t;if(u<.75)d.position.set(HL-u/.75*(L+2),-.8,0);else{const v=(u-.75)/.25;d.position.set(-HL-1-v*3.2,-1.0,0);}}
  const pos=sprayGeo.attributes.position.array;for(let i=0;i<N;i++){let ph=(sv[i*2]+t*.35)%1;const x0=sv[i*2+1];const r=ph*2.2;const a=i*2.399;pos[i*3]=x0+Math.cos(a)*r;pos[i*3+1]=2.35-ph*ph*1.3;pos[i*3+2]=Math.sin(a)*r;}sprayGeo.attributes.position.needsUpdate=true;spray.visible=groups.nutrient.visible;}
 updateCyls();
 const r=canvas.getBoundingClientRect();const camDist=camera.position.distanceTo(controls.target);
 for(const l of labels){tmp.copy(l.pos);if(groups[l.u.id].parent===cell)tmp.applyAxisAngle(ZAX,cell.rotation.z);tmp.project(camera);const show=(labelsOn||(picked&&selected&&selected.id===l.u.id))&&tmp.z<1&&groups[l.u.id].visible&&camDist<150;l.el.style.display=show?'':'none';if(show)l.el.style.transform=`translate(-50%,-100%) translate(${(tmp.x*.5+.5)*r.width}px,${(-tmp.y*.5+.5)*r.height}px)`;}
 renderer.render(scene,camera);requestAnimationFrame(frame);}
camera.position.set(13,8,31);controls.target.set(0,-.6,0);applyCut();if(loadEl)loadEl.remove();frame();
window.__twin={units:UNITS,groups,nodes,select,goView,get cut(){return cutOn},log:LOG};
