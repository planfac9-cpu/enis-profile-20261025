// 설비·건물 외벽 로고 명판: data/logos.json 이 있을 때만 붙인다 (없으면 아무것도 안 함).
// spec: {id, faces:['+x','-x','+z','-z'], frac(면 너비 대비 로고 폭), maxW, v(바닥 기준 높이 비율), u(가로 오프셋 m), plate(흰 바탕판)}
export async function addLogos(THREE,scene,extents,base=''){
  let cfg=null; try{ const r=await fetch(base+'data/logos.json'); if(!r.ok) return null; cfg=await r.json(); }catch(_){ return null; }
  const tex=await new Promise(res=>new THREE.TextureLoader().load(base+(cfg.image||'assets/logo.png'),res,undefined,()=>res(null))); if(!tex) return null;
  tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8; const AR=(tex.image.height||67)/(tex.image.width||154);
  const logoMat=new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.5,metalness:0,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,depthWrite:false,side:THREE.DoubleSide});
  const plateMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.45,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide});
  const group=new THREE.Group(); group.name='logos'; const made=[];
  for(const s of cfg.specs||[]){ const b=extents[s.id]; if(!b||b.isEmpty()) continue; const sz=b.getSize(new THREE.Vector3()), c=b.getCenter(new THREE.Vector3());
    for(const f of s.faces||['+z']){ const horiz=(f==='+x'||f==='-x')?sz.z:sz.x; let w=Math.min(horiz*(s.frac??.4),s.maxW??4); let h=w*AR; if(h>sz.y*.45){ h=sz.y*.45; w=h/AR; } if(w<(s.minW??.25)) continue;
      const y=b.min.y+sz.y*(s.v??.62), off=s.off??.04, u=s.u??0; const holder=new THREE.Group();
      if(s.plate!==false){ const p=new THREE.Mesh(new THREE.PlaneGeometry(w*1.14,h*1.34),plateMat); p.position.z=-.005; p.renderOrder=2; holder.add(p); }
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),logoMat); m.renderOrder=3; holder.add(m);
      if(f==='+x'){ holder.position.set(b.max.x+off,y,c.z+u); holder.rotation.y=Math.PI/2; }
      else if(f==='-x'){ holder.position.set(b.min.x-off,y,c.z+u); holder.rotation.y=-Math.PI/2; }
      else if(f==='-z'){ holder.position.set(c.x+u,y,b.min.z-off); holder.rotation.y=Math.PI; }
      else { holder.position.set(c.x+u,y,b.max.z+off); }
      holder.userData.logoOf=s.id; group.add(holder); made.push(s.id+f); } }
  scene.add(group); window.__logos=made; return group;
}
