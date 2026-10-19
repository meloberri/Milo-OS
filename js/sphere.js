// MILO OS — particle sphere. Midnight-blue core (#1e40d8) wrapped in a
// blue-glow halo (#5b86ff), two satellite mini-spheres, state-driven animation.
import * as THREE from 'three';

const BLUE = 0x1e40d8;
const BLUE_GLOW = 0x5b86ff;
const ICE = 0xeaf2ff;
const COUNT = 2500;
const RADIUS = 1.55;

function roundSprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function fibSphere(count, radius, out) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    out[i * 3] = Math.cos(th) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(th) * r * radius;
  }
}

function makeCloud(count, radius, color, size, opacity) {
  const base = new Float32Array(count * 3);
  fibSphere(count, radius, base);
  const pos = new Float32Array(base); // mutable copy
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size, map: roundSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0.28)'),
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  return { pts, base, pos, count };
}

export function createSphere(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 6.4;

  const core = makeCloud(COUNT, RADIUS, BLUE, 0.055, 0.95);
  scene.add(core.pts);

  // halo: big soft glow sprite behind the cloud
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: roundSprite('rgba(91,134,255,0.85)', 'rgba(91,134,255,0.18)'),
    color: BLUE_GLOW, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(5.4, 5.4, 1);
  scene.add(halo);

  // satellites — the "crew"
  const satA = makeCloud(260, 0.22, ICE, 0.05, 0.9);       // ice-white, upper-left
  const satB = makeCloud(260, 0.22, BLUE_GLOW, 0.05, 0.9); // blue-glow, upper-right
  const pivotA = new THREE.Group(), pivotB = new THREE.Group();
  pivotA.add(satA.pts); pivotB.add(satB.pts);
  scene.add(pivotA); scene.add(pivotB);

  // working-state data stream
  const stream = makeCloud(220, 0.4, BLUE_GLOW, 0.045, 0.0);
  scene.add(stream.pts);

  const api = {
    mode: 'idle',      // idle | listening | thinking | speaking | working
    energy: 0,         // 0..1, driven by speech/caption progress
    setMode(m) { api.mode = m; },
    setEnergy(e) { api.energy = Math.max(0, Math.min(1, e)); },
  };

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();

  function wobble(cloud, t, amp, speed) {
    const { base, pos, count } = cloud;
    for (let i = 0; i < count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const n = 1 / (Math.hypot(bx, by, bz) || 1);
      const w = Math.sin(t * speed + i * 0.7) * amp
              + Math.sin(t * speed * 1.7 + i * 0.23) * amp * 0.5;
      pos[i * 3] = bx + bx * n * w;
      pos[i * 3 + 1] = by + by * n * w;
      pos[i * 3 + 2] = bz + bz * n * w;
    }
    cloud.pts.geometry.attributes.position.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const m = api.mode;

    // base rotation — always alive
    const spin = m === 'idle' ? 0.12 : m === 'thinking' ? 0.55 : m === 'working' ? 0.35 : 0.2;
    core.pts.rotation.y += 0.0035 * (spin / 0.12);
    core.pts.rotation.x = Math.sin(t * 0.2) * 0.08;

    // wobble amplitude per state
    let amp = 0.03, speed = 1.6;
    if (m === 'listening') { amp = 0.07; speed = 2.6; }
    if (m === 'thinking') { amp = 0.12; speed = 4.2; }
    if (m === 'speaking') { amp = 0.05 + api.energy * 0.22; speed = 3 + api.energy * 9; }
    if (m === 'working') { amp = 0.09; speed = 3.4; }
    wobble(core, t, amp, speed);

    // halo breathing
    const haloBase = m === 'listening' ? 0.75 : m === 'speaking' ? 0.6 + api.energy * 0.4 : 0.5;
    halo.material.opacity = haloBase + Math.sin(t * (m === 'listening' ? 3.2 : 1.4)) * 0.08;
    const hs = 5.4 + (m === 'speaking' ? api.energy * 0.7 : 0) + Math.sin(t * 1.4) * 0.12;
    halo.scale.set(hs, hs, 1);

    // satellites: slow orbits, faster when listening
    const orb = m === 'listening' ? 0.9 : 0.35;
    pivotA.rotation.y = t * orb; pivotA.rotation.z = 0.4;
    pivotB.rotation.y = -t * orb * 0.8; pivotB.rotation.z = -0.5;
    satA.pts.position.set(Math.cos(t * orb) * 2.6, 1.5, Math.sin(t * orb) * 1.2);
    satB.pts.position.set(Math.cos(t * orb * 0.8 + Math.PI) * 2.7, 1.1, Math.sin(t * orb * 0.8 + Math.PI) * 1.2);

    // working data stream: spiral rising through the sphere
    const sm = stream.pts.material;
    sm.opacity += ((m === 'working' ? 0.85 : 0) - sm.opacity) * 0.05;
    if (sm.opacity > 0.02) {
      const { base, pos, count } = stream;
      for (let i = 0; i < count; i++) {
        const p = ((t * 0.5 + i / count) % 1);
        const ang = p * Math.PI * 6 + i;
        const r = 0.5 + p * 1.6;
        pos[i * 3] = Math.cos(ang) * r * 0.6;
        pos[i * 3 + 1] = (p - 0.5) * 4.4;
        pos[i * 3 + 2] = Math.sin(ang) * r * 0.6;
        void base;
      }
      stream.pts.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }
  animate();

  return api;
}
