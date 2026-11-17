/* studio.js · plató cinematográfico: entorno de softboxes (PMREM), luces con sombra, suelo de obsidiana con reflejo, bokeh y postproceso */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export const QUALITY = {
  eco: { label: 'ECO', layers: 14, density: 60, shadow: 1024, reflect: 0, composer: false, pr: 1, bloom: 0 },
  normal: { label: 'NORMAL', layers: 26, density: 78, shadow: 1536, reflect: 0.35, composer: true, pr: 1.25, bloom: 0.22 },
  profundo: { label: 'PROFUNDO', layers: 40, density: 98, shadow: 2048, reflect: 0.6, composer: true, pr: 1.75, bloom: 0.26 },
  maximo: { label: 'MÁXIMO', layers: 58, density: 125, shadow: 4096, reflect: 1, composer: true, pr: 2, bloom: 0.28 }
};

export const LIGHTS = {
  cine: { label: 'Estudio cine', bg: ['#2a1c10', '#0b0806', '#030201'], key: { pos: [-4.2, 6.5, 5.5], color: '#ffe6c4', i: 3.6 }, rim: { pos: [4.5, 3.4, -5], color: '#b4d6ff', i: 2.6 }, rim2: { pos: [-5, 2.5, -4], color: '#ffc980', i: 1.2 }, exposure: 1.18, bokeh: '#ffcc66', floor: '#c9a35a',
    panels: [[7, 5.5, [-6, 7, 7], '#ffd8a6', 9], [1.8, 9, [8, 4, -7], '#9ccaff', 9], [1.8, 8, [-8, 3, -6], '#ffc46b', 6], [12, 2.2, [0, 1, 9], '#ffe7cf', 1.8], [10, 10, [0, 11, 0], '#fff1de', 1.4], [5, 3, [6, 2, 7], '#ffb878', 2.2]], dome: ['#1a130d', '#070504'] },
  neon: { label: 'Neón noche', bg: ['#25103a', '#0a0616', '#030208'], key: { pos: [-4, 5, 6], color: '#ff9ce6', i: 2.2 }, rim: { pos: [5, 3, -4], color: '#6be8ff', i: 2.6 }, rim2: { pos: [-5, 2, -4], color: '#a07bff', i: 1.8 }, exposure: 1.05, bokeh: '#ff7bd8', floor: '#8a6bff',
    panels: [[2, 9, [-8, 3, 3], '#ff4fd8', 10], [2, 9, [8, 3, 3], '#35e1ff', 10], [6, 2, [0, 8, -5], '#9a6bff', 6], [8, 3, [0, 1, 9], '#ffd9f5', 1.6], [8, 8, [0, 11, 0], '#d9c8ff', 1.1]], dome: ['#150a26', '#05030c'] },
  dia: { label: 'Día soleado', bg: ['#a8d4ff', '#5fa3e6', '#2c6db8'], key: { pos: [4, 8, 5], color: '#fff2d6', i: 3.1 }, rim: { pos: [-5, 3, -4], color: '#cfe6ff', i: 1.4 }, rim2: { pos: [5, 2, -4], color: '#fff0c8', i: 0.9 }, exposure: 0.95, bokeh: '#ffffff', floor: '#f2d8a8',
    panels: [[9, 7, [6, 10, 6], '#fff4dc', 13], [14, 14, [0, 12, 0], '#cfe7ff', 3.6], [10, 3, [0, 1, 9], '#fff0dc', 2.2], [3, 8, [-8, 4, 2], '#dfeeff', 3]], dome: ['#7fb8f0', '#d8c9a8'] }
};

function makePanel(sc, w, h, pos, color, k) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
  m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 1, 0); sc.add(m);
}
export function buildEnv(renderer, L) {
  const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, uniforms: { a: { value: new THREE.Color(L.dome[0]) }, b: { value: new THREE.Color(L.dome[1]) } }, vertexShader: 'varying float y; void main(){ y=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'uniform vec3 a,b; varying float y; void main(){ gl_FragColor=vec4(mix(b,a,smoothstep(-0.3,0.9,y)),1.0);}' }));
  sc.add(dome); L.panels.forEach((p) => makePanel(sc, p[0], p[1], p[2], p[3], p[4]));
  const rt = pm.fromScene(sc, 0.025); pm.dispose(); sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); return rt.texture;
}

function bgTexture(L) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(256, 330, 20, 256, 300, 420); gr.addColorStop(0, L.bg[0]); gr.addColorStop(0.55, L.bg[1]); gr.addColorStop(1, L.bg[2]); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function discTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.4)'); gr.addColorStop(0.9, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}
function poolTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(cv);
}
function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVig: { value: 0.55 }, uWarm: { value: new THREE.Color(1.03, 1.0, 0.96) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig; uniform vec3 uWarm; varying vec2 vUv;
float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uTime)*43758.5453); }
void main(){ vec4 c=texture2D(tDiffuse,vUv); vec2 d=vUv-0.5; float v=1.0-dot(d,d)*uVig*2.2; c.rgb*=clamp(v,0.0,1.0)*uWarm;
 c.rgb=c.rgb*c.rgb*(3.0-2.0*c.rgb)*0.35+c.rgb*0.65; c.rgb+=(rnd(vUv*vec2(1920.0,1080.0))-0.5)*uGrain; gl_FragColor=c; }`
};

export function createStudio(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80); camera.position.set(0, 1.6, 7.6);
  const S = { renderer, scene, camera, q: QUALITY[opts.quality || 'normal'], light: null, composer: null, target: new THREE.Vector3(0, 1.25, 0), t: 0 };
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.castShadow = true; key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2; key.shadow.camera.top = 3.6; key.shadow.camera.bottom = -2.4; key.shadow.camera.near = 1; key.shadow.camera.far = 22; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xffffff, 1.6), rim2 = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(key, key.target, rim, rim2); S.key = key; S.rimL = rim; S.rim2L = rim2;
  // suelo: reflector (espejo difuminado y que se desvanece) + receptor de sombras + sombra de contacto
  S.floorGroup = new THREE.Group(); scene.add(S.floorGroup);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.55 })); shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0.004; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.006; blob.renderOrder = 1; scene.add(blob); S.blob = blob;
  // bokeh
  const N = 70, pos = new Float32Array(N * 3), rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-9, 9); pos[i * 3 + 1] = rnd(0.2, 6); pos[i * 3 + 2] = rnd(-12, -5); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  S.bokeh = new THREE.Points(bg, new THREE.PointsMaterial({ size: 0.55, map: discTexture(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffcc66, toneMapped: false })); const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, toneMapped: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.002; scene.add(pool); S.pool = pool;
  S.bokeh.layers.set(1); camera.layers.enable(1); scene.add(S.bokeh);
  S.setLight = (id) => {
    const L = LIGHTS[id] || LIGHTS.cine; S.light = L; S.lightId = id;
    if (S.envTex) S.envTex.dispose(); S.envTex = buildEnv(renderer, L); scene.environment = S.envTex; scene.environmentIntensity = 1; renderer.toneMappingExposure = L.exposure;
    if (scene.background && scene.background.dispose) scene.background.dispose(); scene.background = bgTexture(L);
    key.color.set(L.key.color); key.intensity = L.key.i; key.position.set(...L.key.pos); rim.color.set(L.rim.color); rim.intensity = L.rim.i; rim.position.set(...L.rim.pos); rim2.color.set(L.rim2.color); rim2.intensity = L.rim2.i; rim2.position.set(...L.rim2.pos);
    S.bokeh.material.color.set(L.bokeh); S.pool.material.color.set(L.floor).multiplyScalar(0.9); S.buildFloor();
  };
  S.buildFloor = () => {
    if (S.floor) { S.floorGroup.remove(S.floor); S.floor.geometry.dispose(); S.floor.material.dispose(); S.floor.dispose && S.floor.dispose(); S.floor = null; }
    if (!S.q.reflect) return;
    const tint = new THREE.Color(S.light.floor).multiplyScalar(0.55);
    const f = new Reflector(new THREE.CircleGeometry(7, 48), { textureWidth: Math.round(1024 * S.q.reflect), textureHeight: Math.round(1024 * S.q.reflect), clipBias: 0.003, multisample: 2, shader: {
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTint: { value: tint } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vP; void main(){ vUv=textureMatrix*vec4(position,1.0); vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; varying vec4 vUv; varying vec2 vP;
void main(){ vec2 p=vUv.xy/vUv.w; float r=length(vP)/7.0; vec3 a=vec3(0.0); float rad=0.0008+r*0.006;
 for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++){ a+=texture2D(tDiffuse,p+vec2(float(i),float(j))*rad).rgb; } a/=25.0;
 float fade=pow(1.0-smoothstep(0.05,1.0,r),1.6); vec3 base=uTint*0.012*(1.0-r); gl_FragColor=vec4(base+a*uTint*fade*0.55,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment> }` } });
    f.rotation.x = -Math.PI / 2; f.position.y = 0; S.floor = f; S.floorGroup.add(f);
  };
  S.setQuality = (id) => {
    S.q = QUALITY[id] || QUALITY.normal; S.qid = id; key.shadow.mapSize.set(S.q.shadow, S.q.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.q.pr)); S.buildFloor(); S.resize();
  };
  S.resize = () => {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(), W = Math.floor(w * pr), H = Math.floor(h * pr);
    if (S.q.composer) {
      if (S.composer) { S.composer.dispose(); S.composer = null; }
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
      const c = new EffectComposer(renderer, rt); c.setPixelRatio(1); c.setSize(W, H); c.addPass(new RenderPass(scene, camera));
      S.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), S.q.bloom, 0.65, 0.88); c.addPass(S.bloom); c.addPass(new OutputPass()); S.grade = new ShaderPass(GRADE); c.addPass(S.grade); S.composer = c;
    } else if (S.composer) { S.composer.dispose(); S.composer = null; }
  };
  S.render = (dt) => {
    S.t += dt; GRADE.uniforms.uTime.value = S.t % 10; if (S.grade) S.grade.uniforms.uTime.value = (S.t * 7) % 10;
    S.bokeh.position.x = Math.sin(S.t * 0.1) * 0.25; S.bokeh.material.opacity = 0.3 + Math.sin(S.t * 0.7) * 0.05;
    if (S.composer) S.composer.render(dt); else renderer.render(scene, camera);
  };
  S.setLight(opts.light || 'cine'); S.setQuality(opts.quality || 'normal');
  return S;
}
