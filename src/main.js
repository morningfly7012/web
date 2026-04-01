import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer, RenderPass, EffectPass, ChromaticAberrationEffect, BloomEffect } from 'postprocessing';

gsap.registerPlugin(ScrollTrigger);

// ===== Global State =====
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let scrollProgress = 0;

document.addEventListener('mousemove', (e) => {
  targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ===== Intro Text Scramble =====
function scrambleText(element, finalText, duration = 1500) {
  const chars = '░▒▓█▄▀■□▪▫◆◇○●';
  const steps = 20;
  const interval = duration / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    let result = '';
    for (let i = 0; i < finalText.length; i++) {
      if (step / steps > i / finalText.length) {
        result += finalText[i];
      } else {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    element.textContent = result;
    if (step >= steps) {
      clearInterval(timer);
      element.textContent = finalText;
    }
  }, interval);
}

// ===== Intro Animation =====
function playIntro() {
  const overlay = document.getElementById('intro-overlay');
  const lines = overlay.querySelectorAll('.intro-line');

  // Scramble the intro text
  lines.forEach((line, i) => {
    setTimeout(() => {
      scrambleText(line, line.dataset.final, 1200);
    }, i * 400);
  });

  // Fade out overlay
  gsap.to(overlay, {
    opacity: 0,
    duration: 1,
    delay: 2.5,
    ease: 'power2.inOut',
    onComplete: () => {
      overlay.style.display = 'none';
      document.getElementById('navbar').classList.add('visible');
    }
  });
}

// ===== Three.js Main Scene =====
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.035);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ===== Post Processing =====
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);

const chromaticAberration = new ChromaticAberrationEffect({
  offset: new THREE.Vector2(0.0, 0.0),
  radialModulation: false,
  modulationOffset: 0.0,
});

const bloom = new BloomEffect({
  intensity: 0.6,
  luminanceThreshold: 0.6,
  luminanceSmoothing: 0.3,
  mipmapBlur: true,
});

const effectPass = new EffectPass(camera, chromaticAberration, bloom);
composer.addPass(renderPass);
composer.addPass(effectPass);

// ===== Lighting =====
const ambientLight = new THREE.AmbientLight(0x1a2030, 1.2);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0x88ccff, 2.5);
mainLight.position.set(5, 8, 6);
scene.add(mainLight);

const backLight = new THREE.DirectionalLight(0x6644aa, 1.5);
backLight.position.set(-4, -3, -5);
scene.add(backLight);

const rimLight = new THREE.PointLight(0x4fc3f7, 4, 15);
rimLight.position.set(3, 2, 4);
scene.add(rimLight);

const accentLight = new THREE.PointLight(0xb388ff, 3, 12);
accentLight.position.set(-3, -1, 3);
scene.add(accentLight);

// ===== Ice Material =====
function createIceMaterial(color = 0x88ccee) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 2.0,
    ior: 1.31,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
}

// ===== Create Ice Crystal Cluster =====
function createIceCluster(seed = 0) {
  const group = new THREE.Group();

  // Main body
  const mainGeo = new THREE.IcosahedronGeometry(1.0, 1);
  // Distort vertices for organic look
  const pos = mainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const noise = Math.sin(x * 3 + seed) * Math.cos(y * 2 + seed) * 0.15;
    pos.setXYZ(i, x + noise, y + noise * 0.8, z + noise * 0.6);
  }
  mainGeo.computeVertexNormals();
  const main = new THREE.Mesh(mainGeo, createIceMaterial());
  group.add(main);

  // Crystal shards growing outward
  const shardCount = 6 + Math.floor(seed % 4);
  for (let i = 0; i < shardCount; i++) {
    const theta = (i / shardCount) * Math.PI * 2 + seed;
    const phi = Math.acos(2 * ((i * 0.618 + seed * 0.1) % 1) - 1);
    const r = 0.7 + Math.random() * 0.5;

    const shardGeo = new THREE.ConeGeometry(0.08 + Math.random() * 0.12, 0.5 + Math.random() * 0.8, 5);
    const shard = new THREE.Mesh(shardGeo, createIceMaterial(0xaaddff));
    shard.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    shard.lookAt(shard.position.clone().multiplyScalar(2));
    shard.scale.setScalar(0.6 + Math.random() * 0.8);
    group.add(shard);
  }

  // Inner glow
  const glowGeo = new THREE.IcosahedronGeometry(0.4, 2);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.12,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  return group;
}

// ===== Scene Objects =====
// Intro crystal (center, large)
const introCrystal = createIceCluster(0);
introCrystal.scale.setScalar(1.5);
introCrystal.position.set(2.5, 0, 0);
scene.add(introCrystal);

// Project ice blocks
const projectCrystals = [];
const projectData = [
  { seed: 1, color: 0x4fc3f7, pos: new THREE.Vector3(3, 0, -2) },
  { seed: 2, color: 0xb388ff, pos: new THREE.Vector3(3, 0, -2) },
  { seed: 3, color: 0x00e5ff, pos: new THREE.Vector3(3, 0, -2) },
];

projectData.forEach((data) => {
  const crystal = createIceCluster(data.seed);
  crystal.position.copy(data.pos);
  crystal.visible = false;
  scene.add(crystal);
  projectCrystals.push(crystal);
});

// ===== Background Particles (Snow/Frost) =====
const bgParticleCount = 2000;
const bgParticleGeo = new THREE.BufferGeometry();
const bgPositions = new Float32Array(bgParticleCount * 3);
const bgSizes = new Float32Array(bgParticleCount);

for (let i = 0; i < bgParticleCount; i++) {
  bgPositions[i * 3] = (Math.random() - 0.5) * 30;
  bgPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
  bgPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  bgSizes[i] = Math.random() * 2 + 0.5;
}
bgParticleGeo.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
bgParticleGeo.setAttribute('size', new THREE.BufferAttribute(bgSizes, 1));

const bgParticleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    attribute float size;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      vec3 p = position;
      p.y += sin(uTime * 0.1 + position.x * 0.3) * 0.3;
      p.x += cos(uTime * 0.08 + position.z * 0.2) * 0.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vAlpha = smoothstep(15.0, 3.0, length(mv.xyz)) * 0.4;
      gl_PointSize = size * uPixelRatio * (50.0 / -mv.z);
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * vAlpha;
      gl_FragColor = vec4(0.7, 0.85, 1.0, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const bgParticles = new THREE.Points(bgParticleGeo, bgParticleMat);
scene.add(bgParticles);

// ===== Links Section: Interactive Particle System =====
let particleScene, particleCamera, particleRenderer, particleComposer;
let linkParticles;
const LINK_PARTICLE_COUNT = 5000;
let currentTargetPositions = null;
let particleVelocities;

function initParticleScene() {
  const container = document.getElementById('particle-viewport');
  if (!container || container.offsetWidth === 0) return;

  particleScene = new THREE.Scene();
  particleCamera = new THREE.PerspectiveCamera(50, container.offsetWidth / container.offsetHeight, 0.1, 100);
  particleCamera.position.z = 5;

  particleRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  particleRenderer.setSize(container.offsetWidth, container.offsetHeight);
  particleRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(particleRenderer.domElement);

  particleComposer = new EffectComposer(particleRenderer);
  particleComposer.addPass(new RenderPass(particleScene, particleCamera));
  particleComposer.addPass(new EffectPass(particleCamera, new BloomEffect({
    intensity: 1.0,
    luminanceThreshold: 0.3,
    mipmapBlur: true,
  })));

  // Create particles
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(LINK_PARTICLE_COUNT * 3);
  const colors = new Float32Array(LINK_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(LINK_PARTICLE_COUNT);
  particleVelocities = new Float32Array(LINK_PARTICLE_COUNT * 3);

  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.5 + Math.random() * 1.5;
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);
    colors[i3] = 0.3; colors[i3 + 1] = 0.76; colors[i3 + 2] = 0.97;
    sizes[i] = Math.random() * 2 + 1;
    particleVelocities[i3] = (Math.random() - 0.5) * 0.01;
    particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
    particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: particleRenderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep(8.0, 1.0, length(mv.xyz)) * 0.8;
        gl_PointSize = size * uPixelRatio * (40.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  linkParticles = new THREE.Points(geo, mat);
  particleScene.add(linkParticles);

  // Pre-compute target shapes
  generateShapeTargets();
}

// ===== Shape targets for link hover =====
const shapeTargets = {};

function generateShapeTargets() {
  // Penguin-like shape (sphere with bumps)
  shapeTargets.penguin = generateSpherePositions(1.2);

  // Cube
  shapeTargets.cube = generateCubePositions(1.5);

  // Sphere
  shapeTargets.sphere = generateSpherePositions(1.5);

  // Torus
  shapeTargets.torus = generateTorusPositions(1.2, 0.4);

  // Diamond (octahedron)
  shapeTargets.diamond = generateDiamondPositions(1.5);
}

function generateSpherePositions(radius) {
  const arr = new Float32Array(LINK_PARTICLE_COUNT * 3);
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.8 + Math.random() * 0.2);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}

function generateCubePositions(size) {
  const arr = new Float32Array(LINK_PARTICLE_COUNT * 3);
  const hs = size / 2;
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    // Distribute on cube surface
    const face = Math.floor(Math.random() * 6);
    let x = (Math.random() - 0.5) * size;
    let y = (Math.random() - 0.5) * size;
    let z = (Math.random() - 0.5) * size;
    switch (face) {
      case 0: x = hs; break;
      case 1: x = -hs; break;
      case 2: y = hs; break;
      case 3: y = -hs; break;
      case 4: z = hs; break;
      case 5: z = -hs; break;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

function generateTorusPositions(R, r) {
  const arr = new Float32Array(LINK_PARTICLE_COUNT * 3);
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const rr = r + (Math.random() - 0.5) * 0.15;
    arr[i * 3] = (R + rr * Math.cos(v)) * Math.cos(u);
    arr[i * 3 + 1] = (R + rr * Math.cos(v)) * Math.sin(u);
    arr[i * 3 + 2] = rr * Math.sin(v);
  }
  return arr;
}

function generateDiamondPositions(size) {
  const arr = new Float32Array(LINK_PARTICLE_COUNT * 3);
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    // Octahedron surface sampling
    let x = (Math.random() - 0.5) * 2;
    let y = (Math.random() - 0.5) * 2;
    let z = (Math.random() - 0.5) * 2;
    const s = size / (Math.abs(x) + Math.abs(y) + Math.abs(z) + 0.001);
    arr[i * 3] = x * s * (0.9 + Math.random() * 0.1);
    arr[i * 3 + 1] = y * s * (0.9 + Math.random() * 0.1);
    arr[i * 3 + 2] = z * s * (0.9 + Math.random() * 0.1);
  }
  return arr;
}

// ===== Morph particles to shape =====
function morphParticlesTo(shapeName) {
  if (!linkParticles || !shapeTargets[shapeName]) return;
  currentTargetPositions = shapeTargets[shapeName];

  // Change colors based on shape
  const colorMap = {
    penguin: [0.3, 0.76, 0.97],
    cube: [0.7, 0.53, 1.0],
    sphere: [0.0, 0.9, 1.0],
    torus: [1.0, 0.56, 0.69],
    diamond: [0.5, 1.0, 0.83],
  };
  const targetColor = colorMap[shapeName] || [0.3, 0.76, 0.97];
  const colors = linkParticles.geometry.attributes.color.array;
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    colors[i3] = targetColor[0];
    colors[i3 + 1] = targetColor[1];
    colors[i3 + 2] = targetColor[2];
  }
  linkParticles.geometry.attributes.color.needsUpdate = true;
}

function resetParticles() {
  currentTargetPositions = null;
  if (!linkParticles) return;
  const colors = linkParticles.geometry.attributes.color.array;
  for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    colors[i3] = 0.3;
    colors[i3 + 1] = 0.76;
    colors[i3 + 2] = 0.97;
  }
  linkParticles.geometry.attributes.color.needsUpdate = true;
}

// ===== Link Hover Events =====
document.querySelectorAll('.link-item').forEach((item) => {
  item.addEventListener('mouseenter', () => {
    const shape = item.dataset.shape;
    morphParticlesTo(shape);
  });
  item.addEventListener('mouseleave', () => {
    resetParticles();
  });
});

// ===== GSAP Scroll Animations =====
// Hide scroll hint on scroll
ScrollTrigger.create({
  trigger: '#section-intro',
  start: 'top top',
  end: '20% top',
  onUpdate: (self) => {
    const hint = document.querySelector('.scroll-hint');
    if (self.progress > 0.1) {
      hint.classList.add('hidden');
    } else {
      hint.classList.remove('hidden');
    }
  },
});

// Intro section: crystal moves and fades
gsap.to(introCrystal.position, {
  scrollTrigger: {
    trigger: '#section-intro',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
  y: -3,
  z: -5,
});

gsap.to(introCrystal.rotation, {
  scrollTrigger: {
    trigger: '#section-intro',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
  y: Math.PI * 0.5,
  x: 0.3,
});

// Project slides - show content on scroll
document.querySelectorAll('.project-slide').forEach((slide, index) => {
  ScrollTrigger.create({
    trigger: slide,
    start: 'top 60%',
    end: 'bottom 40%',
    onEnter: () => {
      slide.querySelector('.project-content').classList.add('visible');
      // Show corresponding crystal
      projectCrystals.forEach((c, i) => {
        c.visible = i === index;
      });
      introCrystal.visible = false;

      // Chromatic aberration kick
      gsap.to(chromaticAberration.offset, {
        x: 0.005,
        y: 0.003,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      });
    },
    onLeaveBack: () => {
      if (index === 0) {
        introCrystal.visible = true;
        projectCrystals.forEach((c) => c.visible = false);
      }
    },
  });
});

// Nav breadcrumb update
const navSections = document.querySelectorAll('.nav-section');
function setActiveNav(sectionName) {
  navSections.forEach((s) => {
    s.classList.toggle('active', s.dataset.section === sectionName);
  });
}

ScrollTrigger.create({
  trigger: '#section-intro',
  start: 'top top',
  end: 'bottom top',
  onEnter: () => setActiveNav('intro'),
  onEnterBack: () => setActiveNav('intro'),
});

ScrollTrigger.create({
  trigger: '#section-projects',
  start: 'top 50%',
  end: 'bottom 50%',
  onEnter: () => setActiveNav('projects'),
  onEnterBack: () => setActiveNav('projects'),
});

ScrollTrigger.create({
  trigger: '#section-links',
  start: 'top 50%',
  onEnter: () => setActiveNav('links'),
  onEnterBack: () => setActiveNav('links'),
});

// Nav click scrolling
navSections.forEach((s) => {
  s.addEventListener('click', () => {
    const target = document.getElementById('section-' + s.dataset.section);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ===== Animation Loop =====
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  // Smooth mouse
  mouseX += (targetMouseX - mouseX) * 0.05;
  mouseY += (targetMouseY - mouseY) * 0.05;

  // Intro crystal rotation follows mouse
  if (introCrystal.visible) {
    introCrystal.rotation.x += (mouseY * 0.3 - introCrystal.rotation.x + Math.sin(elapsed * 0.2) * 0.1) * 0.03;
    introCrystal.rotation.y += (mouseX * 0.4 + elapsed * 0.1 - introCrystal.rotation.y) * 0.03;
    introCrystal.position.y += Math.sin(elapsed * 0.5) * 0.001;
  }

  // Project crystals follow mouse
  projectCrystals.forEach((crystal) => {
    if (crystal.visible) {
      crystal.rotation.x += (mouseY * 0.4 + Math.sin(elapsed * 0.3) * 0.15 - crystal.rotation.x) * 0.03;
      crystal.rotation.y += (mouseX * 0.5 + elapsed * 0.12 - crystal.rotation.y) * 0.03;
      crystal.position.y = Math.sin(elapsed * 0.4) * 0.15;
    }
  });

  // Move lights with mouse
  rimLight.position.x = 3 + mouseX * 2;
  rimLight.position.y = 2 + mouseY * 2;
  accentLight.position.x = -3 + mouseX * 1.5;
  accentLight.position.y = -1 + mouseY * 1.5;

  // Background particles
  bgParticleMat.uniforms.uTime.value = elapsed;
  bgParticles.rotation.y = elapsed * 0.005;

  // Render main scene
  composer.render();

  // Render particle scene
  if (linkParticles && particleComposer) {
    linkParticles.material.uniforms.uTime.value = elapsed;

    const positions = linkParticles.geometry.attributes.position.array;

    if (currentTargetPositions) {
      // Morph toward target
      for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] += (currentTargetPositions[i3] - positions[i3]) * 0.02;
        positions[i3 + 1] += (currentTargetPositions[i3 + 1] - positions[i3 + 1]) * 0.02;
        positions[i3 + 2] += (currentTargetPositions[i3 + 2] - positions[i3 + 2]) * 0.02;
      }
    } else {
      // Free float
      for (let i = 0; i < LINK_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] += particleVelocities[i3];
        positions[i3 + 1] += particleVelocities[i3 + 1];
        positions[i3 + 2] += particleVelocities[i3 + 2];

        // Contain in sphere
        const dist = Math.sqrt(positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2);
        if (dist > 2.5) {
          particleVelocities[i3] *= -0.8;
          particleVelocities[i3 + 1] *= -0.8;
          particleVelocities[i3 + 2] *= -0.8;
        }

        // Small random perturbation
        particleVelocities[i3] += (Math.random() - 0.5) * 0.0005;
        particleVelocities[i3 + 1] += (Math.random() - 0.5) * 0.0005;
        particleVelocities[i3 + 2] += (Math.random() - 0.5) * 0.0005;
      }
    }

    linkParticles.geometry.attributes.position.needsUpdate = true;
    linkParticles.rotation.y = elapsed * 0.05;

    particleComposer.render();
  }
}
animate();

// ===== Resize =====
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);

  const container = document.getElementById('particle-viewport');
  if (container && particleRenderer) {
    particleCamera.aspect = container.offsetWidth / container.offsetHeight;
    particleCamera.updateProjectionMatrix();
    particleRenderer.setSize(container.offsetWidth, container.offsetHeight);
    particleComposer.setSize(container.offsetWidth, container.offsetHeight);
  }
}
window.addEventListener('resize', onResize);

// ===== Init =====
setTimeout(() => {
  initParticleScene();
}, 100);

playIntro();

// ===== Glitch text effect on visible =====
const glitchObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const originalText = el.textContent;
      scrambleText(el, originalText, 800);
      glitchObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.glitch-text').forEach((el) => {
  glitchObserver.observe(el);
});
