// 보조 장면 요소 (DOM 없음): 스튜디오 바닥, 물질 흐름 입자, 제작 보류 핀. 설비 형상은 glTF(plant_video.glb) 가 담당.
// 설비 좌표: x 동, y 북, z 상(미터) → three: x, y=z, z=−y
export function buildExtras(THREE,data){
  const root=new THREE.Group(); root.name='extras';
  const col=h=>new THREE.Color(h);
  const toWorld=(x,y,z)=>new THREE.Vector3(x,z,-y);
  const [hw,hd]=data.hall;
  // ── 스튜디오 바닥: 중앙이 밝은 방사형 회색 (영상 배경 톤) ──
  const floorTex=makeStudio(THREE);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(90,96),new THREE.MeshStandardMaterial({color:'#ffffff',map:floorTex,roughness:.62,metalness:0,envMapIntensity:.35}));
  floor.rotation.x=-Math.PI/2; floor.position.set(hw/2,-.005,-hd/2); floor.receiveShadow=true; root.add(floor);
  // 홀 외곽선(12,940×10,000) 얇은 선
  const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([toWorld(0,0,.004),toWorld(hw,0,.004),toWorld(hw,hd,.004),toWorld(0,hd,.004)]),new THREE.LineBasicMaterial({color:'#8d9ba5',transparent:true,opacity:.6})); root.add(outline);
  // ── 흐름 경로 + 입자 ──
  const flows=[];
  for(const f of data.flows){
    const pts=f.pts.map(p=>toWorld(...p)); const segs=[]; let L=0; for(let i=0;i<pts.length-1;i++){ const l=pts[i].distanceTo(pts[i+1]); segs.push({a:pts[i],b:pts[i+1],l,s:L}); L+=l; }
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:col(f.color),transparent:true,opacity:.5})); root.add(line);
    const n=Math.max(8,Math.round(L*2.2)); const pos=new Float32Array(n*3); const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const pointsMat=new THREE.PointsMaterial({color:col(f.color),size:.16,sizeAttenuation:true,transparent:true,opacity:.95,depthWrite:false});
    const points=new THREE.Points(geo,pointsMat); points.frustumCulled=false; root.add(points);
    flows.push({f,segs,L,n,pos,geo,line,points,offset:0});
  }
  function sampleFlow(fl,s){ s=((s%fl.L)+fl.L)%fl.L; for(const sg of fl.segs){ if(s<=sg.s+sg.l){ const t=sg.l?(s-sg.s)/sg.l:0; return sg.a.clone().lerp(sg.b,t); } } return fl.segs.at(-1).b.clone(); }
  function tickFlows(dt){ for(const fl of flows){ fl.offset+=fl.f.speed*dt; for(let i=0;i<fl.n;i++){ const p=sampleFlow(fl,fl.offset+i*fl.L/fl.n); fl.pos[i*3]=p.x; fl.pos[i*3+1]=p.y; fl.pos[i*3+2]=p.z; } fl.geo.attributes.position.needsUpdate=true; } }
  function setFlowsVisible(v){ for(const fl of flows){ fl.line.visible=v; fl.points.visible=v; } }
  // ── 보류 핀 ──
  const holds=[];
  const pinMat=new THREE.MeshStandardMaterial({color:'#ff8a3d',emissive:col('#ff6a00'),emissiveIntensity:.6,roughness:.4});
  for(const h of data.holds){ const m=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),pinMat); m.position.copy(toWorld(...h.pos)); m.userData.hold=h; root.add(m); holds.push({h,mesh:m}); }
  return {root,toWorld,flows,tickFlows,setFlowsVisible,holds,floor};
}
function makeStudio(THREE){ if(typeof document==='undefined') return null; const c=document.createElement('canvas'); c.width=c.height=2048; const g=c.getContext('2d'); const rg=g.createRadialGradient(1024,1024,80,1024,1024,1040); rg.addColorStop(0,'#939ba1'); rg.addColorStop(.55,'#7e868c'); rg.addColorStop(1,'#656d73'); g.fillStyle=rg; g.fillRect(0,0,2048,2048);
  // 콘크리트 질감(Codex 렌더 바닥 톤): 미세 반점(1 px ≈ 9 cm, 반점 10~20 cm, 저대비)
  for(let i=0;i<160000;i++){ const x=Math.random()*2048,y=Math.random()*2048,r=Math.random()*.9+.3; g.fillStyle=Math.random()<.5?'rgba(255,255,255,.045)':'rgba(0,0,0,.055)'; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
