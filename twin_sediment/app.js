// 수저오염퇴적물 정화 시스템 디지털 트윈 — 공정 그림 기반 절차 생성 개념 모델 (three 0.180)
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=s=>document.querySelector(s);
const EMBED=window.self!==window.top||/[?&]embed/.test(location.search);
if(EMBED) document.body.classList.add('embed'); if(/[?&]mini=1/.test(location.search)) document.body.classList.add('mini');
const canvas=$('#view');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xdbe6ee);scene.fog=new THREE.Fog(0xdbe6ee,80,200);
const camera=new THREE.PerspectiveCamera(42,1,.1,500);const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=120;
scene.add(new THREE.HemisphereLight(0xdfeeff,0x9a8f7a,.8));const sun=new THREE.DirectionalLight(0xfff4e0,2.0);sun.position.set(24,36,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:32,bottom:-32,near:1,far:120});sun.shadow.bias=-.0006;scene.add(sun);
function speckle(base,spots,count,size=256,rmin=1,rmax=3){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,size,size);for(let i=0;i<count;i++){g.fillStyle=spots[i%spots.length];const r=rmin+Math.random()*(rmax-rmin);g.beginPath();g.arc(Math.random()*size,Math.random()*size,r,0,7);g.fill();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
const texConc=speckle('#c4c6c3',['#b4b6b3','#d0d2cf','#a9aba8'],900,256,1,2.5);texConc.repeat.set(16,10);const texMud=speckle('#5b4a33',['#44362a','#6f5b40','#3a2d22'],1800,256,1,3);texMud.repeat.set(4,4);
const cutPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);let cutOn=false;const clipped=[];
function mat(opts,clip=true){const m=new THREE.MeshStandardMaterial(Object.assign({roughness:.6,metalness:.1,side:clip?THREE.DoubleSide:THREE.FrontSide},opts));if(clip){m.clippingPlanes=[];clipped.push(m);}return m;}
function applyCut(){for(const m of clipped){m.clippingPlanes=cutOn?[cutPlane]:[];m.clipShadows=cutOn;m.needsUpdate=true;}}
const CATS={feed:{name:'반입·전처리',color:'#8a6a3a'},wash:{name:'세척 (화학적 산화)',color:'#277fb6'},sep:{name:'분리 (하이드로사이클론)',color:'#e07b39'},adv:{name:'고도처리',color:'#2e8ca2'},out:{name:'탈수·반출·처리수',color:'#5f7d8c'},pipe:{name:'배관·펌프',color:'#9aa5ad'}};
const UNITS={},groups={},labels=[],pickables=[];
function unit(id,cat,name,facts,note,labelPos){UNITS[id]={id,cat,name,facts,note,labelPos};const g=new THREE.Group();g.userData.id=id;groups[id]=g;scene.add(g);return g;}
function add(g,geo,m,pos,rot,shadow=true){const mesh=new THREE.Mesh(geo,m);if(pos)mesh.position.set(...pos);if(rot)mesh.rotation.set(...rot);mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.userData.id=g.userData.id;g.add(mesh);pickables.push(mesh);return mesh;}
const steel=mat({color:0xcfd6da,roughness:.35,metalness:.55}),steelD=mat({color:0x6d7a85,roughness:.5,metalness:.5}),conc=mat({map:texConc,roughness:.95}),brown=mat({color:0x8a6a3a,roughness:.5,metalness:.2}),blueP=mat({color:0x3d7fb0,roughness:.4,metalness:.4}),redP=mat({color:0xb7452c,roughness:.4,metalness:.3});
const liquid=new THREE.MeshPhysicalMaterial({color:0x5a4630,transparent:true,opacity:.85,roughness:.3,side:THREE.DoubleSide});const water=new THREE.MeshPhysicalMaterial({color:0x6fb4d8,transparent:true,opacity:.6,roughness:.15,side:THREE.DoubleSide});const glass=new THREE.MeshPhysicalMaterial({color:0xdfe9f0,transparent:true,opacity:.22,roughness:.1,side:THREE.DoubleSide,depthWrite:false});
// 바닥 슬래브
{const g=unit('site','feed','처리장 바닥 (콘크리트 슬래브)',['30 × 20 m · 가정값'],'준설 퇴적물 정화 설비를 놓는 콘크리트 바닥입니다. 실제 배치는 현장 부지에 따라 달라집니다.',[-14,.3,-9]);add(g,new THREE.BoxGeometry(34,.3,22),conc,[1,-.15,0]);}
// 1 반입 호퍼·스크린
{const g=unit('hopper','feed','반입 호퍼 · 전처리 스크린',['준설 퇴적물 투입 · 협잡물·자갈 제거','호퍼 4 × 4 m — 가정값'],'준설한 오염 퇴적물을 투입하는 호퍼입니다. 스크린에서 쓰레기·자갈 같은 협잡물을 걸러낸 뒤 세척조로 보냅니다.',[-15,5.2,5]);
 const hop=new THREE.CylinderGeometry(2.4,.5,2.6,4,1,true);hop.rotateY(Math.PI/4);add(g,hop,steelD,[-15,3.3,5]);add(g,new THREE.BoxGeometry(3.6,.15,3.6),steelD,[-15,4.6,5]);
 for(let i=-1.4;i<=1.4;i+=.35)add(g,new THREE.BoxGeometry(.06,.06,3.4),steel,[-15+i,4.7,5],null,false);
 for(const [x,z] of [[-16.5,3.5],[-13.5,3.5],[-16.5,6.5],[-13.5,6.5]])add(g,new THREE.BoxGeometry(.2,4.5,.2),steelD,[x,2.25,z]);
 add(g,new THREE.BoxGeometry(3,.6,1.2),mat({map:texMud}),[-15,4.9,5]);}
// 2 세척조 4단 (교반기)
let mixers=[];{const g=unit('wash','wash','세척조 (4단 · 화학적 산화)',['산화제 + 비이온계면활성제 투입','4단 직렬 교반 · 조 2.5 × 3.5 × 3 m — 가정값'],'퇴적물 슬러리를 4개의 조에서 차례로 교반하며 산화제와 비이온계면활성제로 유기물을 화학적으로 산화·탈착시킵니다. 그림의 "세척 Washing".',[-8,4.6,4]);
 for(let i=0;i<4;i++){const x=-11.75+i*2.5;add(g,new THREE.BoxGeometry(2.5,3,3.5),glass,[x,1.5,4],null,false);add(g,new THREE.BoxGeometry(2.4,2.2,3.4),liquid,[x,1.1,4],null,false);
  add(g,new THREE.BoxGeometry(2.5,.12,3.5),steel,[x,3.06,4]);add(g,new THREE.CylinderGeometry(.6,.6,.12,32),steelD,[x,3.18,4]);
  add(g,new THREE.BoxGeometry(.5,.5,.5),blueP,[x,3.5,4]);const sh=new THREE.Group();sh.position.set(x,3.2,4);g.add(sh);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.8,8),steel);shaft.position.y=-1.4;sh.add(shaft);for(let k=0;k<3;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.25),steel);bl.position.y=-2.5;bl.rotation.y=k*Math.PI/3;sh.add(bl);}mixers.push(sh);}
 for(const z of [2.25,5.75])for(const x of [-13,-5.5])add(g,new THREE.BoxGeometry(.15,3,.15),steelD,[x,1.5,z]);}
// 3 약품 공급
{const g=unit('chem','wash','약품 공급 (산화제 · 비이온계면활성제)',['산화제 탱크 + 계면활성제 탱크 · 정량펌프 — 가정값'],'유기물 산화용 산화제와 오염물 탈착을 돕는 비이온계면활성제를 세척조에 정량 주입합니다.',[-15,3.4,-.5]);
 add(g,new THREE.CylinderGeometry(.9,.9,2.4,32),mat({color:0x3d7fb0,roughness:.4}),[-16.2,1.35,-1]);add(g,new THREE.CylinderGeometry(.9,.9,2.4,32),mat({color:0x3f9a6a,roughness:.4}),[-13.8,1.35,-1]);
 add(g,new THREE.BoxGeometry(.5,.4,.5),steelD,[-15,.45,.6]);}
// 4·5 하이드로사이클론
function cyclone(g,x,z,s,m){add(g,new THREE.CylinderGeometry(.65*s,.65*s,1.1*s,32),m,[x,4.7*s,z]);add(g,new THREE.CylinderGeometry(.65*s,.08*s,2.6*s,32),m,[x,2.85*s,z]);add(g,new THREE.CylinderGeometry(.18*s,.18*s,.9*s,16),steel,[x,5.6*s,z]);add(g,new THREE.CylinderGeometry(.14*s,.14*s,.8*s,16),steel,[x,1.2*s,z]);for(const [dx,dz] of [[-.9,-.9],[.9,-.9],[-.9,.9],[.9,.9]])add(g,new THREE.BoxGeometry(.12,4.2*s,.12),steelD,[x+dx*s,2.1*s,z+dz*s]);add(g,new THREE.BoxGeometry(2.2*s,.1,2.2*s),steelD,[x,4.1*s,z]);}
{const g=unit('cycA','sep','하이드로사이클론 1차 (조립 분리)',['원심력으로 모래(조립) · 미세토 분리','처리 50 ㎥/h 급 — 가정값'],'세척된 슬러리를 접선 방향으로 넣어 회전시키면 무거운 모래는 아래(언더플로)로, 오염물이 붙은 미세 입자는 위(오버플로)로 나뉩니다. 그림의 "분리 Hydrocyclone".',[1,7.2,4]);cyclone(g,1,4,1.15,redP);}
{const g=unit('cycB','sep','하이드로사이클론 2차 (미세 분리)',['1차 오버플로 재분리 · 미세토 농축'],'1차에서 넘어온 미세 슬러리를 다시 분리해 세척 모래 회수율을 높이고 고도처리로 보내는 미세토를 농축합니다.',[1,5.6,-4]);cyclone(g,1,-4,.85,blueP);}
// 6 세척 모래(정화토) 반출
{const g=unit('sandbin','out','세척 모래 · 정화토 반출',['사이클론 언더플로 → 탈수 스크린 → 야적'],'분리된 깨끗한 모래는 탈수 스크린을 거쳐 야적하고, 기준 충족 시 재활용(골재·복토)합니다.',[5,2.8,7.5]);
 add(g,new THREE.BoxGeometry(3,.8,2),steelD,[5,.6,7.5]);add(g,new THREE.ConeGeometry(1.3,1.6,24),mat({map:texMud,color:0xc9b27c}),[5,1.8,7.5]);for(const z of [7,8])add(g,new THREE.BoxGeometry(2.8,.08,.12),steel,[5,1.05,z],null,false);}
// 7 고도처리조 (원형 침전·응집)
let rake;{const g=unit('adv','adv','고도처리조 (응집 · 침전)',['Ø8 m 원형 · 중심 구동 레이크 — 가정값','응집제 투입 → 미세토·오염물 침강'],'미세 슬러리에 응집제를 넣어 플록을 만들고 원형 조에서 가라앉힙니다. 바닥의 레이크가 슬러지를 중앙으로 모으고 위쪽 맑은 물은 월류합니다. 그림의 "고도처리 Advanced Treatment".',[11,4.2,0]);
 add(g,new THREE.CylinderGeometry(4,4,2.6,48,1,true),conc,[11,1.3,0]);add(g,new THREE.CylinderGeometry(4,4,.2,48),conc,[11,.1,0]);add(g,new THREE.CylinderGeometry(3.9,3.9,1.9,48),water,[11,1.15,0],null,false);
 add(g,new THREE.CylinderGeometry(4.2,4.2,.15,48,1,true),steel,[11,2.7,0]);add(g,new THREE.CylinderGeometry(.35,.35,3.6,16),steelD,[11,1.9,0]);add(g,new THREE.CylinderGeometry(.9,.9,1.0,24,1,true),steelD,[11,2.3,0]);
 add(g,new THREE.BoxGeometry(8.4,.1,.8),steelD,[11,3.0,0]);add(g,new THREE.BoxGeometry(8.4,.5,.05),steelD,[11,3.3,.4],null,false);add(g,new THREE.BoxGeometry(.8,.6,.8),blueP,[11,3.4,0]);
 rake=new THREE.Group();rake.position.set(11,.35,0);g.add(rake);for(let k=0;k<2;k++){const a=new THREE.Mesh(new THREE.BoxGeometry(7.6,.12,.2),steel);a.rotation.y=k*Math.PI/2;rake.add(a);for(let r=-3.4;r<=3.4;r+=.6){const b=new THREE.Mesh(new THREE.BoxGeometry(.08,.3,.5),steel);b.position.set(r,-.1,0);b.rotation.y=k*Math.PI/2;rake.add(b);}}
 add(g,new THREE.BoxGeometry(.5,.4,.5),steelD,[11,.6,-4.6]);}
// 8 탈수기 (필터프레스)
{const g=unit('press','out','탈수기 (필터프레스) · 슬러지 케이크',['침강 슬러지 탈수 → 케이크 처분'],'고도처리조 바닥의 오염 슬러지를 필터프레스로 짜서 부피를 줄인 케이크로 만들어 처분합니다.',[11,3.6,-8]);
 for(let i=0;i<14;i++)add(g,new THREE.BoxGeometry(.2,1.6,1.6),i%2?steelD:mat({color:0x3b4a56,roughness:.7}),[8.6+i*.35,1.6,-8]);
 add(g,new THREE.BoxGeometry(5.8,.12,.12),steel,[11,2.5,-8.75]);add(g,new THREE.BoxGeometry(5.8,.12,.12),steel,[11,2.5,-7.25]);for(const x of [8.2,13.8])add(g,new THREE.BoxGeometry(.3,2.4,1.7),steelD,[x,1.2,-8]);
 add(g,new THREE.BoxGeometry(4,.6,1.4),mat({map:texMud}),[11,.3,-10.3]);}
// 9 처리수
{const g=unit('water','out','처리수 (재이용 · 방류)',['월류수 → 처리수조 → 세척수 재이용 / 수질 확인 후 방류'],'고도처리조 상부의 맑은 물을 모아 세척수로 다시 쓰거나 수질 기준을 확인한 뒤 방류합니다.',[17.5,3,0]);
 add(g,new THREE.BoxGeometry(3,2.2,3),mat({color:0x4f8fbf,roughness:.5}),[17.5,1.1,0]);add(g,new THREE.BoxGeometry(2.9,.1,2.9),water,[17.5,2.0,0],null,false);}
// 10 배관·펌프 (흐름 경로)
const PATHS=[];function pipe(g,pts,r,m,flow){const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.02);add(g,new THREE.TubeGeometry(curve,Math.max(16,pts.length*10),r,12,false),m,[0,0,0]);if(flow)PATHS.push({curve,color:flow,n:Math.round(curve.getLength()/1.2)});}
{const g=unit('pipes','pipe','배관 · 펌프 (슬러리 / 처리수)',['갈색 = 퇴적물 슬러리 · 회색 = 처리수·세척수 순환'],'호퍼 → 세척조 → 1차·2차 사이클론 → 고도처리조 → 탈수기/처리수조로 이어지는 배관과 이송 펌프입니다. 처리수는 세척조로 되돌려 재이용합니다.',[5,.9,-7]);
 pipe(g,[[-15,2.0,5],[-14.2,1.0,5],[-13.3,.6,5],[-12.8,.6,4],[-12.5,1.5,4]],.14,brown,0x8a6a3a);
 pipe(g,[[-16.2,2.6,-1],[-16.2,3.9,-1],[-11.75,3.9,2.4],[-11.75,3.3,3.2]],.06,blueP,null);pipe(g,[[-13.8,2.6,-1],[-13.8,3.9,-.6],[-9.25,3.9,2.4],[-9.25,3.3,3.2]],.06,mat({color:0x3f9a6a,roughness:.4}),null);
 pipe(g,[[-4.25,2.2,4],[-3,2.2,4],[-2.5,1.0,4],[-1.5,.6,4],[-.2,.6,4],[.3,5.0,4],[1.0,5.0,4.6]],.14,brown,0x8a6a3a);
 pipe(g,[[1,1.2,4],[1,.8,4.8],[3,.8,7.0],[5,.8,7.5]],.12,mat({color:0xc9b27c,roughness:.6}),0xc9b27c);
 pipe(g,[[1,6.3,4],[1,6.8,4],[1,6.8,-2.5],[1,4.2,-4],[1,4.2,-4.5]],.11,brown,0x8a6a3a);
 pipe(g,[[1,.9,-4],[1,.6,-4],[3,.6,-3],[6,.6,0],[7,2.4,0],[10,2.4,0],[11,2.0,0]],.12,brown,0x8a6a3a);
 pipe(g,[[1,5.3,-4],[1,5.6,-4],[1,5.6,-7],[2.5,.8,-7],[4,.8,7.6],[5,.8,7.5]],.09,mat({color:0xc9b27c,roughness:.6}),null);
 pipe(g,[[11,.6,-4.6],[11,.4,-5.2],[11,.4,-6.8],[11,1.5,-7.3]],.11,mat({color:0x3a2d22,roughness:.6}),0x3a2d22);
 pipe(g,[[15,2.5,0],[16,2.5,0],[17.5,2.2,0]],.1,steel,0x6fb4d8);
 pipe(g,[[17.5,.4,0],[17.5,.4,-3],[17.5,.4,-11.5],[-10,.4,-11.5],[-10,.4,-1.2],[-10,3.6,-1.2],[-10,3.6,2.3]],.1,steel,0x6fb4d8);
 for(const [x,z] of [[-13.3,5],[-1.5,4],[3,-3],[2.5,-7],[11,-6.8],[16,0],[-10,-11.5]])add(g,new THREE.BoxGeometry(.6,.5,.6),steelD,[x,.25,z]);}
// 흐름 입자
const flowGroup=new THREE.Group();scene.add(flowGroup);const flows=[];for(const p of PATHS){for(let i=0;i<p.n;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.5}));d.userData={t:i/p.n,curve:p.curve};flowGroup.add(d);flows.push(d);}}
// 라벨·선택
const labelLayer=$('#labels');for(const u of Object.values(UNITS)){const el=document.createElement('button');el.className='label';el.textContent=u.name.replace(/\s*\(.*$/,'');el.onclick=()=>select(u,true);labelLayer.appendChild(el);labels.push({u,el,pos:new THREE.Vector3(...u.labelPos)});}
let labelsOn=false,picked=false,selected=null,animOn=true;const info=$('#info'),infoBody=$('#info-body');function infoShow(on){info.classList.toggle('show',!!on);}$('#info-close').onclick=()=>infoShow(false);
const selBox=new THREE.Box3Helper(new THREE.Box3(),0xffb300);selBox.visible=false;scene.add(selBox);
function select(u,user){selected=u;if(user)picked=true;const b=new THREE.Box3().setFromObject(groups[u.id]);if(!b.isEmpty()){selBox.box.copy(b).expandByScalar(.15);selBox.visible=true;}const c=CATS[u.cat];
 infoBody.innerHTML=`<span class="chip" style="background:${c.color}">${c.name}</span><span class="chip est">개념 모델 · 치수 가정</span><h2>${u.name}</h2><p class="facts">${u.facts.join(' · ')}</p><p class="note">${u.note}</p><p class="src">출처: 수저오염퇴적물 정화 시스템 공정 그림(세척 Washing · 분리 Hydrocyclone · 고도처리 Advanced Treatment · 배관 계통) · 형상·치수는 일반 설계 범위의 가정</p>`;if(user)infoShow(true);}
const ray=new THREE.Raycaster();let downAt=null;canvas.addEventListener('pointerdown',e=>downAt=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5)return;const u=pickAt(e.clientX,e.clientY);if(u)select(u,true);else{infoShow(false);selBox.visible=false;selected=null;}});
canvas.addEventListener('pointermove',e=>{const u=pickAt(e.clientX,e.clientY);$('#hover').textContent=u?u.name:'';canvas.style.cursor=u?'pointer':'';});
function pickAt(x,y){const r=canvas.getBoundingClientRect();ray.setFromCamera({x:((x-r.left)/r.width)*2-1,y:-((y-r.top)/r.height)*2+1},camera);const hits=ray.intersectObjects(pickables.filter(m=>m.visible&&m.parent.visible),false);for(const h of hits){if(cutOn&&h.point.z>cutPlane.constant)continue;const id=h.object.userData.id;if(id&&UNITS[id]&&groups[id].visible)return UNITS[id];}return null;}
const VIEWS=[['전경',[14,16,30],[1,1,0]],['세척조',[-8,7,14],[-8,1.5,4]],['사이클론',[8,8,10],[1,3.5,0]],['고도처리조',[18,9,10],[11,1.5,0]],['탈수·처리수',[18,7,-12],[13,1,-6]],['상부',[1,40,.01],[1,0,0]]];
const views=$('#views');VIEWS.forEach(([n,p,t])=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>goView(p,t);views.appendChild(b);});
let flyFrom=null,flyTo=null,flyT=1;function goView(p,t){flyFrom={p:camera.position.clone(),t:controls.target.clone()};flyTo={p:new THREE.Vector3(...p),t:new THREE.Vector3(...t)};flyT=0;}
const cats=$('#cats'),legend=$('#legend');for(const [k,c] of Object.entries(CATS)){const l=document.createElement('label');l.innerHTML=`<input type="checkbox" checked data-cat="${k}"><i style="background:${c.color}"></i>${c.name}`;cats.appendChild(l);l.querySelector('input').onchange=e=>{for(const u of Object.values(UNITS))if(u.cat===k)groups[u.id].visible=e.target.checked;};const s=document.createElement('span');s.innerHTML=`<i style="background:${c.color}"></i>${c.name}`;legend.appendChild(s);}
$('#toggle-cut').onchange=e=>{cutOn=e.target.checked;applyCut();};$('#cut-pos').oninput=e=>{cutPlane.constant=Number(e.target.value);};$('#toggle-cover').onchange=e=>{groups.pipes.visible=e.target.checked;flowGroup.visible=e.target.checked;};
$('#toggle-anim').onchange=e=>{animOn=e.target.checked;};$('#toggle-labels').onchange=e=>{labelsOn=e.target.checked;};
$('#panel-btn').onclick=()=>document.body.classList.add('panel-open');$('#side-close').onclick=()=>document.body.classList.remove('panel-open');
$('#fullscreen').onclick=()=>{ const el=document.documentElement; const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 if(isFs()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); return; }
 if(document.body.classList.contains('pseudo-full')){ setPseudo(false); return; }
 let p=null; try{ const req=el.requestFullscreen||el.webkitRequestFullscreen; p=req&&req.call(el); }catch(e){}
 if(p&&p.catch) p.catch(()=>{}); setTimeout(()=>{ if(!isFs()) setPseudo(true); },1200); };
function setPseudo(on){ document.body.classList.toggle('pseudo-full',on); const b=$('#fullscreen'); if(b) b.textContent=on?'전체화면 해제':'전체화면'; parent.postMessage({type:'enis-twin-full',on},'*'); setTimeout(()=>dispatchEvent(new Event('resize')),50); }
addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('pseudo-full')) setPseudo(false); });
for(const ev of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(ev,()=>{ const fs=!!(document.fullscreenElement||document.webkitFullscreenElement); if(fs&&document.body.classList.contains('pseudo-full')) setPseudo(false); const b=$('#fullscreen'); if(b) b.textContent=fs?'전체화면 해제':'전체화면'; });

addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();parent.postMessage({type:'enis-slide-key',key:e.key},'*');}else if(e.key==='c'||e.key==='C'){$('#toggle-cut').click();}});
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;const pr=renderer.getPixelRatio();if(canvas.width!==Math.floor(w*pr)||canvas.height!==Math.floor(h*pr)){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
const tmp=new THREE.Vector3();const clock=new THREE.Clock();
function frame(){resize();const dt=Math.min(clock.getDelta(),.05);const t=clock.elapsedTime;
 if(flyT<1){flyT=Math.min(1,flyT+dt*1.4);const k=flyT<.5?2*flyT*flyT:-1+(4-2*flyT)*flyT;camera.position.lerpVectors(flyFrom.p,flyTo.p,k);controls.target.lerpVectors(flyFrom.t,flyTo.t,k);}
 controls.update();
 if(animOn){for(const m of mixers)m.rotation.y+=dt*3;rake.rotation.y+=dt*.25;for(const d of flows){d.userData.t=(d.userData.t+dt*.06)%1;d.userData.curve.getPointAt(d.userData.t,d.position);}}
 const r=canvas.getBoundingClientRect();const camDist=camera.position.distanceTo(controls.target);
 for(const l of labels){tmp.copy(l.pos).project(camera);const show=(labelsOn||(picked&&selected&&selected.id===l.u.id))&&tmp.z<1&&groups[l.u.id].visible&&camDist<120;l.el.style.display=show?'':'none';if(show)l.el.style.transform=`translate(-50%,-100%) translate(${(tmp.x*.5+.5)*r.width}px,${(-tmp.y*.5+.5)*r.height}px)`;}
 renderer.render(scene,camera);requestAnimationFrame(frame);}
camera.position.set(14,16,30);controls.target.set(1,1,0);applyCut();$('#loading').remove();frame();
window.__twin={units:UNITS,groups,select,goView,get cut(){return cutOn}};
