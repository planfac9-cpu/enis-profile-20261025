// CCU 3D explorer R03 — photoreal renders first, diorama 3D on demand.
// Diagnostic switches (URL): ?explore=1 &cam=01_hero|02_process|03_storage|04_towers|05_low_oblique|dio
//   &shadow=0|1 &depth=log|std &dpr=<n> &env=<intensity> &sun=<intensity> &ao=0|1 &site=0|1 &exp=<exposure> &msaa=0|1
const Q = new URLSearchParams(location.search);
if (Q.get('mini') === '1') document.body.classList.add('mini');
const qn = (k, d) => (Q.has(k) ? Number(Q.get(k)) : d);
const $ = (s) => document.querySelector(s);
const photo = $('#photo'), host = $('#canvas'), status = $('#status'), select = $('#assembly');
const mobile = matchMedia('(max-width: 700px), (pointer: coarse)').matches;

const VIEWS = {
  low: { cam: '05_low_oblique', label: '현장 시점 · 낮은 사선' },
  hero: { cam: '01_hero', label: 'CCU 설비 전경' },
  process: { cam: '02_process', label: '공정설비와 배관 연결' },
  storage: { cam: '03_storage', label: '횡형 저장설비' },
  towers: { cam: '04_towers', label: '수직설비와 유지관리 구조' },
};
const HIDDEN_BY_DEFAULT = ['foundations'];

let THREE, renderer, scene, camera, controls, sun, composer = null;
let groups = {}, cams = {}, bounds = null, siteRoot = null;
let ready = false, loading = false, mode3d = false, current = '', isolated = false, view = 'low';
let needsRender = true, anim = null, stillActive = false, initPromise = null;
let labelItems = [], labelsEnabled = false;
const tour = { open: false, playing: false, index: 0, timer: null, serial: 0 };
const TOUR_STEPS = [
  { key: 'low', title: '현장 시점', text: '낮은 사선에서 설비와 주변 공간을 살펴봅니다.' },
  { key: 'hero', title: '전체 전경', text: '탑과 저장설비, 건물과 배관의 전체 배치를 살펴봅니다.' },
  { key: 'process', title: '공정설비', text: '설비 구역과 주변 배관 구조를 가까이 살펴봅니다.' },
  { key: 'storage', title: '저장설비', text: '횡형 저장설비와 주변 구조물을 살펴봅니다.' },
  { key: 'towers', title: '수직설비', text: '수직 설비와 작업 발판을 살펴봅니다.' },
];

const message = (t) => { status.textContent = t; status.hidden = !t; };

// ---------------- photo mode ----------------
function viewPhoto(key) {
  view = key;
  mode3d = false;
  stillActive = false;
  anim = null;
  photo.src = `data/${key}.jpg`;
  photo.alt = VIEWS[key].label + ' · 렌더링';
  photo.hidden = false; photo.classList.remove('fade');
  host.hidden = true;
  $('#labels').hidden = true;
  $('#mode-label').textContent = '실사 이미지';
  $('#interaction-hint').textContent = '이미지 · 드래그하면 3D 탐색';
  $('#explore').textContent = '3D 탐색';
  $('#caption').textContent = VIEWS[key].label;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === key)));
  message('');
}

// ---------------- 3D ----------------
function requestRender() { needsRender = true; }

function resize() {
  if (!renderer) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
}

function setClip(dist) {
  // keep the depth range tight: the whole diorama is ~160 m across
  camera.near = Math.max(0.3, dist / 300);
  camera.far = Math.max(600, dist * 6);
  camera.updateProjectionMatrix();
}

function matchedFov(fov) {
  const targetAspect = 16 / 9;
  const vfov = THREE.MathUtils.degToRad(fov);
  return camera.aspect < targetAspect
    ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(vfov / 2) * targetAspect / camera.aspect))
    : fov;
}

function goTo(pos, target, fovV, ms = 0, onComplete = null) {
  const P = new THREE.Vector3(...pos), T = new THREE.Vector3(...target);
  if (!ms) {
    // Cancel an earlier fit/selection animation before restoring a photo camera.
    anim = null;
    // Flush OrbitControls' residual damping before assigning the exact pose.
    const wasDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = wasDamping;
    camera.position.copy(P); controls.target.copy(T);
    if (fovV) { camera.fov = fovV; }
    setClip(P.distanceTo(T)); controls.update(); requestRender();
    return;
  }
  const p0 = camera.position.clone(), t0 = controls.target.clone(), f0 = camera.fov, f1 = fovV || camera.fov;
  const start = performance.now();
  anim = (now) => {
    const k = Math.min(1, (now - start) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(p0, P, e); controls.target.lerpVectors(t0, T, e);
    camera.fov = f0 + (f1 - f0) * e;
    setClip(camera.position.distanceTo(controls.target));
    controls.update(); requestRender();
    if (k >= 1) { anim = null; if (onComplete) onComplete(); }
  };
}

function fitBox(box, ms = 700) {
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const r = 0.5 * Math.hypot(s.x, s.y, s.z);
  const fov = 34;
  const vfov = THREE.MathUtils.degToRad(fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const d = (r / Math.sin(Math.min(vfov, hfov) / 2)) * (camera.aspect < 1 ? 1.12 : 0.92);
  const dir = new THREE.Vector3(0.62, 0.55, 0.56).normalize();
  goTo(c.clone().addScaledVector(dir, d).toArray(), c.toArray(), fov, ms);
}

function groupBox(id) {
  const box = new THREE.Box3();
  (groups[id] || []).forEach((o) => box.expandByObject(o));
  return box;
}

function applyVisibility() {
  Object.entries(groups).forEach(([id, obs]) => obs.forEach((o) => {
    o.visible = isolated ? id === current : (!HIDDEN_BY_DEFAULT.includes(id) || id === current);
  }));
  // The below-ground group would otherwise be hidden inside the diorama slab.
  if (siteRoot) siteRoot.visible = current !== 'foundations';
  if (renderer) renderer.shadowMap.needsUpdate = true;
  $('#isolate').textContent = isolated ? '주변 설비 함께 보기' : '선택 설비만 보기';
  $('#isolate').setAttribute('aria-pressed', String(isolated));
  requestRender();
}

function choose(id, focus = true) {
  pauseTour();
  current = id;
  select.value = id;
  $('#isolate').disabled = !id;
  $('#caption').textContent = id ? select.options[select.selectedIndex].text : 'CCU 전체 설비 · 3D 디오라마';
  applyVisibility();
  if (focus) id ? fitBox(groupBox(id)) : fitBox(bounds);
}

async function explore() {
  mode3d = true;
  $('#explore').textContent = '렌더 보기';
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (ready) { enter3d(); return; }
  if (!initPromise) { loading = true; initPromise = init3d(); }
  message('3D 설비를 불러오는 중…');
  try {
    await initPromise;
    ready = true;
    // A user can return to a photo while the model is still downloading.
    // Do not reopen 3D after the user has left it.
    if (mode3d) enter3d();
    message('');
  } catch (e) {
    console.error(e);
    initPromise = null;
    viewPhoto(view);
    message('3D를 열지 못했습니다. 렌더 이미지를 표시합니다.');
    $('#explore').textContent = '3D 다시 열기';
  } finally {
    loading = false;
  }
}

function enter3d() {
  host.hidden = false;
  stillActive = false;
  $('#mode-label').textContent = '3D 탐색';
  $('#interaction-hint').textContent = '드래그 회전 · 휠 확대 · 설비 클릭';
  $('#labels').hidden = !labelsEnabled;
  resize();
  // start from the same viewpoint as the render that was on screen, then fade the render out
  const c = cams[VIEWS[view]?.cam];
  if (Q.get('cam') === 'dio' || !c) fitBox(bounds, 0);
  else {
    // The reference render is 16:9 and is letterboxed on portrait screens.
    // Preserve its horizontal field of view when the viewport is narrower.
    goTo(c.pos, c.target, matchedFov(c.fov_v_deg), 0);
  }
  if (Q.get('cam') && Q.get('cam') !== 'dio' && cams[Q.get('cam')]) {
    const q = cams[Q.get('cam')]; goTo(q.pos, q.target, q.fov_v_deg, 0);
  }
  if (Q.get('cp')) goTo(Q.get('cp').split(',').map(Number), Q.get('ct').split(',').map(Number), qn('fov', 34), 0);
  renderNow();
  photo.classList.add('fade');
  setTimeout(() => { if (mode3d) photo.hidden = true; }, 450);
  $('#caption').textContent = 'CCU 전체 설비 · 3D 디오라마';
  // Keep the chosen photo viewpoint. An automatic fit-to-site made the plant
  // shrink immediately after entering 3D and defeated the matched transition.
}

function renderNow() {
  if (composer) composer.render(); else renderer.render(scene, camera);
  updateLabels();
  needsRender = false;
}

function updateLabels() {
  if (!labelsEnabled || !mode3d || stillActive || !camera) return;
  const w = host.clientWidth, h = host.clientHeight;
  const stageRect = $('.stage').getBoundingClientRect(), hostRect = host.getBoundingClientRect();
  for (const item of labelItems) {
    const visible = (groups[item.id] || []).some((o) => o.visible);
    const p = item.pos.clone().project(camera);
    const show = visible && p.z < 1 && p.z > -1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
    item.el.hidden = !show;
    if (show) { item.el.style.left = `${(p.x + 1) * w / 2 + hostRect.left - stageRect.left}px`; item.el.style.top = `${(1 - p.y) * h / 2 + hostRect.top - stageRect.top}px`; }
  }
}

function hideStill() {
  if (!stillActive) return;
  stillActive = false;
  photo.classList.add('fade');
  setTimeout(() => { if (mode3d && !stillActive) photo.hidden = true; }, 350);
  $('#mode-label').textContent = '3D 탐색';
  $('#interaction-hint').textContent = '드래그 회전 · 휠 확대 · 설비 클릭';
  $('#explore').textContent = '렌더 보기';
  $('#labels').hidden = !labelsEnabled;
  requestRender();
}

function showStill(key) {
  view = key;
  photo.src = `data/${key}.jpg`;
  photo.alt = VIEWS[key].label + ' · 실사 렌더';
  photo.hidden = false;
  photo.classList.remove('fade');
  stillActive = true;
  $('#labels').hidden = true;
  $('#mode-label').textContent = '실사 이미지';
  $('#interaction-hint').textContent = '이미지 · 드래그하면 3D 탐색';
  $('#explore').textContent = '3D 탐색';
  $('#caption').textContent = VIEWS[key].label;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === key)));
}

async function navigateView(key) {
  stopTour();
  if (!ready || !mode3d) await explore();
  if (!ready || !mode3d) return;
  hideStill();
  isolated = false; current = ''; select.value = ''; $('#isolate').disabled = true; applyVisibility();
  const c = cams[VIEWS[key].cam];
  goTo(c.pos, c.target, matchedFov(c.fov_v_deg), matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 850, () => {
    if (mode3d && !tour.open) showStill(key);
  });
}

function pauseTour() {
  if (!tour.open) return;
  tour.playing = false;
  ++tour.serial;
  anim = null;
  clearTimeout(tour.timer);
  $('#tour-play').textContent = '▶ 계속';
}

function tourGo(index) {
  if (!tour.open || !ready) return;
  clearTimeout(tour.timer);
  const serial = ++tour.serial;
  tour.index = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
  const step = TOUR_STEPS[tour.index], c = cams[VIEWS[step.key].cam];
  isolated = false; current = ''; select.value = ''; $('#isolate').disabled = true; applyVisibility();
  if (stillActive) hideStill();
  $('#tour-step').textContent = `${tour.index + 1} / ${TOUR_STEPS.length}`;
  $('#tour-title').textContent = step.title;
  $('#tour-text').textContent = step.text;
  $('#tour-prev').disabled = tour.index === 0;
  $('#tour-next').disabled = tour.index === TOUR_STEPS.length - 1;
  view = step.key;
  goTo(c.pos, c.target, matchedFov(c.fov_v_deg), matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 850, () => {
    if (!tour.open || serial !== tour.serial) return;
    showStill(step.key);
    if (tour.playing) {
      tour.timer = setTimeout(() => {
        if (!tour.open || !tour.playing || serial !== tour.serial) return;
        if (tour.index === TOUR_STEPS.length - 1) pauseTour(); else tourGo(tour.index + 1);
      }, 7000);
    }
  });
}

async function startTour() {
  if (tour.open) { stopTour(); return; }
  tour.open = true; tour.playing = true; ++tour.serial;
  $('#tour').hidden = false; $('#tour-start').textContent = '둘러보기 종료';
  $('#tour-play').textContent = '⏸ 일시정지';
  if (!ready || !mode3d) await explore();
  if (!tour.open || !ready || !mode3d) return;
  resize(); tourGo(0);
}

function stopTour() {
  if (!tour.open) return;
  tour.open = false; tour.playing = false; ++tour.serial;
  clearTimeout(tour.timer); anim = null;
  $('#tour').hidden = true; $('#tour-start').textContent = '▶ CCU 둘러보기';
  hideStill(); resize(); requestRender();
}

async function init3d() {
  THREE = await import('three');
  const [{ OrbitControls }, { GLTFLoader }, { DRACOLoader }, { HDRLoader }] = await Promise.all([
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
    import('./vendor/HDRLoader.js'),
  ]);

  const depth = Q.get('depth') || 'std';  // log/rev depth break the shadow map (verified 2026-10-26)
  renderer = new THREE.WebGLRenderer({
    antialias: qn('msaa', 1) === 1, alpha: true, powerPreference: 'high-performance',
    logarithmicDepthBuffer: depth === 'log',
    reverseDepthBuffer: depth === 'rev',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Q.has('dpr') ? qn('dpr', 1) : Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = qn('exp', 1.0);
  renderer.shadowMap.enabled = qn('shadow', 1) === 1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 1, 2000);

  // same sky as the Blender renders (Poly Haven kloofendal_43d_clear_puresky, CC0), rotated like the renders
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Retain the full HDR environment used by the still render: comparison
  // showed that the previously clamped sky flattened metal highlights.
  const skyFile = Q.get('sky') === 'clamped' ? 'data/sky_nosun_1k.hdr' : 'data/sky_1k.hdr';
  const hdr = await new HDRLoader().loadAsync(skyFile);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  // Blender world rotation 64 deg about Z (Z-up) == about Y in glTF space
  scene.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(64), 0);
  // The full HDR has more indirect energy than the clamped map. Reducing
  // diffuse fill preserves the darker side of the building seen in the still.
  scene.environmentIntensity = qn('env', 0.3);
  hdr.dispose(); pmrem.dispose();

  // direct sun matching the HDRI sun (elevation 43 deg, azimuth from Blender: angle -100 deg in XY)
  const el = THREE.MathUtils.degToRad(43), az = THREE.MathUtils.degToRad(qn('az', -100));
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az));
  sun = new THREE.DirectionalLight(0xfff4e6, qn('sun', 3.2));
  sun.position.copy(sunDir).multiplyScalar(220);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 60, far: 420 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 4;
  controls.maxDistance = 520;
  // The approved low-oblique camera is level with its target (90 degrees).
  // An 86 degree limit silently moved that camera upward on every transition.
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90);
  controls.addEventListener('change', requestRender);

  const draco = new DRACOLoader().setDecoderPath('./vendor/three180/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let loaded = 0;
  const progress = (e) => { if (e.total) message(`3D 설비 불러오는 중 · ${Math.round(e.loaded / e.total * 100)}%`); };
  const lod = Q.get('lod') || (mobile ? 'mobile' : 'high');
  const modelFile = {mobile: 'data/ccu_mobile.glb', full: 'data/ccu.glb', high: 'data/ccu_high.glb'}[lod] || 'data/ccu_high.glb';
  const [fac, site, asm, camJson] = await Promise.all([
    loader.loadAsync(modelFile, progress),
    qn('site', 1) ? loader.loadAsync('data/site.glb') : Promise.resolve(null),
    fetch('data/assemblies.json').then((r) => r.json()),
    fetch('data/cameras.json').then((r) => r.json()),
  ]);
  cams = camJson;
  scene.add(fac.scene);
  const adjustedMaterials = new Set();
  fac.scene.traverse((o) => {
    if (!o.isMesh) return;
    const id = o.userData.assembly_id;
    if (id) (groups[id] ??= []).push(o);
    o.castShadow = true; o.receiveShadow = true;
    // The source facade reads warmer in the web shader than in the approved
    // Cycles render. Apply the measured neutral/cool correction once per material.
    if (o.material.name === 'facade' && !adjustedMaterials.has(o.material)) {
      o.material.color.r *= 0.84;
      o.material.color.g *= 0.96;
      o.material.color.b *= 1.14;
      adjustedMaterials.add(o.material);
    }
    // Blender's metals reflect surrounding plant/trees near the horizon; the web sky alone is too bright there
    if (o.material.metalness > 0.5) { o.material.envMap = scene.environment; o.material.envMapRotation.copy(scene.environmentRotation); o.material.envMapIntensity = qn('metalEnv', 0.4); }
  });
  bounds = new THREE.Box3();
  if (site) {
    scene.add(site.scene);
    siteRoot = site.scene;
    site.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !/DIO_(dash|edge|pstripe)/.test(o.name);
      o.receiveShadow = true;
      if (o.material.alphaTest > 0) o.material.side = THREE.DoubleSide;
    });
    bounds.setFromObject(site.scene);
  } else {
    Object.entries(groups).forEach(([id, obs]) => { if (!HIDDEN_BY_DEFAULT.includes(id)) obs.forEach((o) => bounds.expandByObject(o)); });
  }
  Object.entries(asm).forEach(([id, g]) => {
    if (!groups[id]) return;
    const opt = document.createElement('option'); opt.value = id; opt.textContent = g.name; select.appendChild(opt);
    const box = groupBox(id), pos = box.getCenter(new THREE.Vector3());
    pos.y = box.max.y;
    const el = document.createElement('button');
    el.className = 'label'; el.textContent = g.name; el.hidden = true;
    el.addEventListener('click', () => { pauseTour(); hideStill(); choose(id); });
    $('#labels').appendChild(el); labelItems.push({ id, pos, el });
  });
  applyVisibility();

  if (qn('ao', mobile ? 0 : 1) === 1) {
    const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/GTAOPass.js'), import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
    composer.addPass(new GTAOPass(scene, camera, w * pr, h * pr));
    composer.addPass(new OutputPass());
  }

  renderer.shadowMap.needsUpdate = true;

  // picking
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { pauseTour(); anim = null; hideStill(); down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('wheel', () => { pauseTour(); anim = null; hideStill(); }, { passive: true });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hit = ray.intersectObjects(Object.values(groups).flat().filter((o) => o.visible), false)[0];
    if (hit) choose(hit.object.userData.assembly_id, true);
  });

  renderer.setAnimationLoop((now) => {
    if (!mode3d) return;
    if (anim) anim(now);
    controls.update();
    if (needsRender) renderNow();
  });
  draco.dispose();
  window.__ccu = { THREE, renderer, scene, camera, controls, groups, cams, renderNow, goTo, fitBox, bounds };
  window.__ccuTour = () => ({ open: tour.open, playing: tour.playing, index: tour.index, still: stillActive });
}

// ---------------- UI ----------------
new ResizeObserver(resize).observe(host);
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => navigateView(b.dataset.view)));
$('#explore').onclick = () => {
  if (stillActive) { pauseTour(); hideStill(); }
  else if (mode3d) { stopTour(); viewPhoto(view); }
  else explore();
};
$('#panel-btn').onclick = async () => {
  const opening = $('#controls').hidden;
  $('#controls').hidden = !opening;
  $('#panel-btn').setAttribute('aria-expanded', String(opening));
  if (opening && !ready) await explore();
};
$('#panel-close').onclick = () => { $('#controls').hidden = true; $('#panel-btn').setAttribute('aria-expanded', 'false'); };
$('#toggle-labels').onchange = (e) => { labelsEnabled = e.target.checked; $('#labels').hidden = !labelsEnabled || !mode3d || stillActive; requestRender(); };
select.onchange = async () => { if (!mode3d) await explore(); hideStill(); choose(select.value); };
$('#isolate').onclick = () => { pauseTour(); hideStill(); isolated = !isolated; applyVisibility(); fitBox(current ? groupBox(current) : bounds); };
$('#reset').onclick = () => { pauseTour(); hideStill(); isolated = false; choose(''); };
$('#tour-start').onclick = startTour;
$('#tour-close').onclick = stopTour;
$('#tour-prev').onclick = () => tourGo(tour.index - 1);
$('#tour-next').onclick = () => tourGo(tour.index + 1);
$('#tour-restart').onclick = () => tourGo(0);
$('#tour-play').onclick = () => {
  if (tour.playing) pauseTour();
  else { tour.playing = true; $('#tour-play').textContent = '⏸ 일시정지'; tourGo(tour.index === TOUR_STEPS.length - 1 ? 0 : tour.index); }
};
$('.stage').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button,select,input,#controls')) return;
  if (mode3d || loading) return;
  // Keep the first drag meaningful even when the 3D model loads asynchronously.
  const stage = e.currentTarget, id = e.pointerId;
  let px = e.clientX, py = e.clientY, dx = 0, dy = 0, ended = false;
  stage.setPointerCapture(id);
  const apply = () => {
    if (!ready || !mode3d || (!dx && !dy)) return;
    const off = camera.position.clone().sub(controls.target);
    const sphere = new THREE.Spherical().setFromVector3(off);
    const scale = 2 * Math.PI / Math.max(1, host.clientHeight);
    sphere.theta -= dx * scale;
    sphere.phi = THREE.MathUtils.clamp(sphere.phi - dy * scale, 0.01, Math.PI / 2);
    camera.position.copy(new THREE.Vector3().setFromSpherical(sphere).add(controls.target));
    camera.lookAt(controls.target); controls.update(); requestRender(); dx = 0; dy = 0;
  };
  const move = (ev) => { if (ev.pointerId !== id) return; dx += ev.clientX - px; dy += ev.clientY - py; px = ev.clientX; py = ev.clientY; apply(); };
  const up = (ev) => { if (ev.pointerId !== id) return; ended = true; stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', up); stage.removeEventListener('pointercancel', up); };
  stage.addEventListener('pointermove', move); stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  explore().then(() => { apply(); if (ended && stage.hasPointerCapture(id)) stage.releasePointerCapture(id); });
});
$('.stage').addEventListener('wheel', (e) => {
  if (mode3d || loading || e.target.closest('#controls')) return;
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 0.86 : 1.16;
  explore().then(() => {
    if (!ready || !mode3d) return;
    const delta = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(delta.length() * zoomFactor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(delta.normalize().multiplyScalar(distance));
    setClip(distance); controls.update(); requestRender();
  });
}, { passive: false });
$('#full').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { window.open(location.href, '_blank', 'noopener'); }
};
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (tour.open) stopTour(); $('#controls').hidden = true; $('#panel-btn').setAttribute('aria-expanded', 'false'); return; }
  if (e.target.matches('select,input,button')) return;
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) parent.postMessage({ type: 'enis-slide-key', key: e.key }, '*');
});

viewPhoto(Q.get('view') && VIEWS[Q.get('view')] ? Q.get('view') : 'low');
// Open in interactive 3D by default, including the company-profile cover.
// The still remains a loading placeholder; ?photo=1 is an explicit photo-only start.
if (Q.get('photo') !== '1') explore();
