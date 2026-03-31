import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ===== Cursor Glow =====
const cursorGlow = document.getElementById('cursor-glow');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let targetMouseX = mouseX;
let targetMouseY = mouseY;

document.addEventListener('mousemove', (e) => {
  targetMouseX = e.clientX;
  targetMouseY = e.clientY;
});

function updateCursor() {
  mouseX += (targetMouseX - mouseX) * 0.1;
  mouseY += (targetMouseY - mouseY) * 0.1;
  cursorGlow.style.left = mouseX + 'px';
  cursorGlow.style.top = mouseY + 'px';
  requestAnimationFrame(updateCursor);
}
updateCursor();

// ===== Three.js Scene =====
const canvas = document.getElementById('hero-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ===== Create Ice Crystal Geometry =====
function createIceCrystal() {
  const group = new THREE.Group();

  // Main crystal body - icosahedron for organic ice shape
  const mainGeo = new THREE.IcosahedronGeometry(1.2, 1);
  const mainMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccee,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 1.5,
    ior: 1.31, // ice refractive index
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.0,
    transparent: true,
    opacity: 0.9,
  });
  const mainMesh = new THREE.Mesh(mainGeo, mainMat);
  group.add(mainMesh);

  // Secondary crystal shards
  const shardPositions = [
    { pos: [0.8, 1.2, 0.3], rot: [0.5, 0.3, 0.2], scale: 0.4 },
    { pos: [-0.6, 0.9, -0.4], rot: [0.2, 0.8, 0.4], scale: 0.35 },
    { pos: [0.5, -1.0, 0.5], rot: [0.7, 0.1, 0.6], scale: 0.3 },
    { pos: [-0.9, -0.5, 0.2], rot: [0.3, 0.5, 0.1], scale: 0.25 },
    { pos: [0.3, 0.5, -0.8], rot: [0.1, 0.6, 0.8], scale: 0.35 },
    { pos: [-0.4, -0.8, -0.5], rot: [0.6, 0.2, 0.3], scale: 0.28 },
  ];

  shardPositions.forEach(({ pos, rot, scale }) => {
    const shardGeo = new THREE.OctahedronGeometry(1, 0);
    const shardMat = new THREE.MeshPhysicalMaterial({
      color: 0xaaddff,
      metalness: 0.05,
      roughness: 0.02,
      transmission: 0.9,
      thickness: 0.8,
      ior: 1.31,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.85,
    });
    const shard = new THREE.Mesh(shardGeo, shardMat);
    shard.position.set(...pos);
    shard.rotation.set(...rot);
    shard.scale.setScalar(scale);
    group.add(shard);
  });

  // Inner glow core
  const coreGeo = new THREE.IcosahedronGeometry(0.5, 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.15,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  return group;
}

const crystal = createIceCrystal();
scene.add(crystal);

// ===== Particles =====
const particleCount = 1500;
const particleGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;
  const radius = 3 + Math.random() * 5;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = radius * Math.cos(phi);
  velocities[i3] = (Math.random() - 0.5) * 0.002;
  velocities[i3 + 1] = (Math.random() - 0.5) * 0.002;
  velocities[i3 + 2] = (Math.random() - 0.5) * 0.002;
  sizes[i] = Math.random() * 2 + 0.5;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0x4fc3f7) },
    uColor2: { value: new THREE.Color(0xb388ff) },
    uPixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    attribute float size;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      pos.x += sin(uTime * 0.3 + position.y * 0.5) * 0.15;
      pos.y += cos(uTime * 0.2 + position.z * 0.5) * 0.15;
      pos.z += sin(uTime * 0.25 + position.x * 0.5) * 0.1;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float dist = length(mvPosition.xyz);
      vAlpha = smoothstep(8.0, 2.0, dist) * 0.6;
      gl_PointSize = size * uPixelRatio * (80.0 / -mvPosition.z);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;

      float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
      vec3 color = mix(uColor1, uColor2, sin(uTime * 0.5) * 0.5 + 0.5);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// ===== Lighting =====
const ambientLight = new THREE.AmbientLight(0x223344, 0.8);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0x88ccff, 2.0);
mainLight.position.set(3, 4, 5);
scene.add(mainLight);

const backLight = new THREE.DirectionalLight(0xb388ff, 1.0);
backLight.position.set(-3, -2, -3);
scene.add(backLight);

const rimLight = new THREE.PointLight(0x4fc3f7, 3, 10);
rimLight.position.set(0, 3, 2);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0xb388ff, 2, 8);
bottomLight.position.set(0, -3, 1);
scene.add(bottomLight);

// ===== Mouse Interaction for 3D =====
let mouseNormX = 0;
let mouseNormY = 0;

document.addEventListener('mousemove', (e) => {
  mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNormY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ===== Animation Loop =====
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Crystal rotation - follows mouse + gentle auto-rotate
  const targetRotX = mouseNormY * 0.4 + Math.sin(elapsed * 0.3) * 0.1;
  const targetRotY = mouseNormX * 0.5 + elapsed * 0.15;
  crystal.rotation.x += (targetRotX - crystal.rotation.x) * 0.05;
  crystal.rotation.y += (targetRotY - crystal.rotation.y) * 0.05;

  // Crystal subtle float
  crystal.position.y = Math.sin(elapsed * 0.5) * 0.15;

  // Inner glow pulse
  const core = crystal.children[crystal.children.length - 1];
  if (core.material.opacity !== undefined) {
    core.material.opacity = 0.1 + Math.sin(elapsed * 1.5) * 0.08;
  }

  // Move rim light with mouse
  rimLight.position.x = mouseNormX * 3;
  rimLight.position.y = mouseNormY * 3 + 2;

  // Particle animation
  particleMaterial.uniforms.uTime.value = elapsed;
  particles.rotation.y = elapsed * 0.02;
  particles.rotation.x = elapsed * 0.01;

  renderer.render(scene, camera);
}
animate();

// ===== Resize =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

// ===== GSAP Scroll Animations =====
// Animate section titles
document.querySelectorAll('.section-title[data-animate]').forEach((el) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => el.classList.add('animated'),
  });
});

// Animate cards and items
document.querySelectorAll('.about-card, .project-item, .link-card').forEach((el, i) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay: i % 4 * 0.1,
        ease: 'power3.out',
      });
    },
  });
});

// Hero parallax on scroll
gsap.to('.hero-content', {
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
  y: -100,
  opacity: 0,
});

// Crystal scale down on scroll
gsap.to(crystal.scale, {
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
  x: 0.3,
  y: 0.3,
  z: 0.3,
});

// ===== Nav active state =====
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach((section) => {
    const top = section.offsetTop - 200;
    if (window.scrollY >= top) {
      current = section.getAttribute('id');
    }
  });
  navLinks.forEach((link) => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
});

// ===== Project hover color =====
document.querySelectorAll('.project-item').forEach((item) => {
  const color = item.dataset.color;
  item.addEventListener('mouseenter', () => {
    item.querySelector('.project-name').style.color = color;
  });
  item.addEventListener('mouseleave', () => {
    item.querySelector('.project-name').style.color = '';
  });
});
