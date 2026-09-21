// Dr. Sharma Clinic — Hyper-Futuristic AI Voice Receptionist Engine
// Enhanced Edition: Shockwaves, Lightning, Particles, Chimes & Thinking

const $ = (id) => document.getElementById(id);
const canvas = $("orbCanvas");

const stageBadgeText = $("stageBadgeText");
const calendarCard = $("calendarCard");
const waCard = $("waCard");
const waText = $("waText");
const slotsContainer = $("slotsContainer");
const speakerTag = $("speakerTag");
const subMain = $("subMain");
const subTrans = $("subTrans");
const callBtn = $("callBtn");
const callBtnText = $("callBtnText");
const callBtnIcon = $("callBtnIcon");
const connLabel = $("connLabel");
const statusDot = $("statusDot");
const waveBars = document.querySelectorAll(".wave-bar");
const liveClock = $("liveClock");
const callTimer = $("callTimer");

// Audio & WebSocket state
let ws = null;
let audioCtx = null;
let workletNode = null;
let micStream = null;
let nextStart = 0;
let activeSources = [];
let speaking = false;
let userRMS = 0;
let isCallActive = false;

// Anti-Glitch Audio Gain & Sinks
let voiceGain = null;
let silentSink = null;
let speechFrameCount = 0;
const BARGE_THRESHOLD = 0.06;

// Call timer state
let callStartTime = 0;
let callTimerInterval = null;

// Thinking state (between user speech end and agent speech start)
let thinkingMode = false;
let lastUserSpeechTime = 0;

function setStage(stageName) {
  stageBadgeText.textContent = stageName.toUpperCase();
}

function setSubtitles(role, text) {
  if (role === "swastik") {
    speakerTag.className = "speaker-tag swastik";
    speakerTag.textContent = "SWASTIK AI";
    thinkingMode = false; // Agent is responding, no longer thinking
  } else {
    speakerTag.className = "speaker-tag patient";
    speakerTag.textContent = "PATIENT";
    lastUserSpeechTime = performance.now();
  }

  // Trigger subtitle fade-in animation
  subMain.classList.remove("fade-in");
  void subMain.offsetWidth; // force reflow
  subMain.classList.add("fade-in");

  subMain.textContent = text;

  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) {
    subTrans.textContent = "(English translation) " + text;
    subTrans.style.display = "block";
  } else {
    subTrans.style.display = "none";
  }
}

// ------------------------------------------------------------------
// Live Clock & Call Timer
// ------------------------------------------------------------------
function updateClock() {
  if (liveClock) {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

function startCallTimer() {
  callStartTime = Date.now();
  if (callTimer) callTimer.style.display = "inline";
  callTimerInterval = setInterval(() => {
    if (!callTimer) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    callTimer.textContent = `${mm}:${ss}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  if (callTimer) {
    callTimer.textContent = "00:00";
    callTimer.style.display = "none";
  }
}

// ------------------------------------------------------------------
// High-Tech 3D WebGL Engine: Radiant Light Core Spheres, Gyroscopic
// Concentric Rings, Neural Synapses & Quantum Parallax (Three.js)
// ------------------------------------------------------------------
let width = window.innerWidth;
let height = window.innerHeight;
let isMobile = false;
let isTablet = false;

// Backward-compatible coordinate state for UI tracking
let leftOrb = { x: 0, y: 0, baseRadius: 80, radius: 80, shockwaves: [] };
let rightOrb = { x: 0, y: 0, baseRadius: 84, radius: 84, shockwaves: [] };

// 3D Scene, Camera & WebGL Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 0, 85);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

// Procedural Luminous Particle & Glow Sprite Textures (Generated via Offscreen 2D Canvas)
function createDotTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cctx = c.getContext("2d");

  // Outer soft atmospheric bloom
  const g2 = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g2.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  g2.addColorStop(0.15, "rgba(255, 255, 255, 0.95)");
  g2.addColorStop(0.35, "rgba(220, 250, 255, 0.75)");
  g2.addColorStop(0.6, "rgba(20, 200, 178, 0.35)");
  g2.addColorStop(0.85, "rgba(0, 229, 255, 0.12)");
  g2.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  cctx.fillStyle = g2;
  cctx.fillRect(0, 0, 128, 128);

  // Intense central hot photon core
  const g1 = cctx.createRadialGradient(64, 64, 0, 64, 64, 24);
  g1.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  g1.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
  g1.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g1;
  cctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createGlowTexture(isPatient) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (isPatient) {
    g.addColorStop(0, "rgba(255, 245, 210, 0.95)");
    g.addColorStop(0.22, "rgba(245, 166, 35, 0.6)");
    g.addColorStop(0.55, "rgba(217, 119, 6, 0.15)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else {
    g.addColorStop(0, "rgba(220, 255, 255, 0.95)");
    g.addColorStop(0.22, "rgba(20, 200, 178, 0.6)");
    g.addColorStop(0.55, "rgba(13, 148, 136, 0.15)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
  }
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const dotTexture = createDotTexture();
const glowTexturePatient = createGlowTexture(true);
const glowTextureSwastik = createGlowTexture(false);

// Procedural Ethereal Air Particle Texture (High-visibility incandescent motes)
function createAirParticleTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cctx = c.getContext("2d");

  // Layer 1: Soft outer atmospheric bloom for visibility
  const g2 = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g2.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  g2.addColorStop(0.10, "rgba(255, 255, 255, 0.98)");
  g2.addColorStop(0.25, "rgba(255, 255, 255, 0.85)");
  g2.addColorStop(0.45, "rgba(255, 255, 255, 0.50)");
  g2.addColorStop(0.65, "rgba(255, 255, 255, 0.22)");
  g2.addColorStop(0.85, "rgba(255, 255, 255, 0.06)");
  g2.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g2;
  cctx.fillRect(0, 0, 128, 128);

  // Layer 2: Hot photon core for crisp visibility
  const g1 = cctx.createRadialGradient(64, 64, 0, 64, 64, 18);
  g1.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  g1.addColorStop(0.6, "rgba(255, 255, 255, 0.9)");
  g1.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g1;
  cctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const airParticleTexture = createAirParticleTexture();

// Ultra-fine dust mote texture (tiny, crisp, high-count inner nebula)
function createFineParticleTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  g.addColorStop(0.2, "rgba(255, 255, 255, 0.88)");
  g.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  g.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const fineParticleTexture = createFineParticleTexture();

// Ethereal haze texture (large, soft, diffused atmospheric fog particles)
function createHazeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, "rgba(255, 255, 255, 0.55)");
  g.addColorStop(0.15, "rgba(255, 255, 255, 0.40)");
  g.addColorStop(0.35, "rgba(255, 255, 255, 0.22)");
  g.addColorStop(0.6, "rgba(255, 255, 255, 0.08)");
  g.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const hazeTexture = createHazeTexture();

// Helper: Generate circle points
function createCirclePoints(radius, segments) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return pts;
}

// ------------------------------------------------------------------
// High-Fidelity Custom Textures for Sci-Fi Reactors & Volumetric Plasma
// ------------------------------------------------------------------

// Golden Thermonuclear Fusion Core Texture (Image 1)
function createGoldenCoreTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const cctx = c.getContext("2d");

  // Multi-tier radial gradient: pure white center -> hot golden amber -> deep solar flare
  const g = cctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.00, "rgba(255, 255, 255, 1.0)");
  g.addColorStop(0.12, "rgba(255, 250, 220, 0.98)");
  g.addColorStop(0.28, "rgba(255, 195, 45, 0.85)");
  g.addColorStop(0.50, "rgba(255, 125, 15, 0.55)");
  g.addColorStop(0.75, "rgba(215, 65, 0, 0.20)");
  g.addColorStop(1.00, "rgba(0, 0, 0, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 256, 256);

  // Intense white-hot central photon starburst
  const gCore = cctx.createRadialGradient(128, 128, 0, 128, 128, 48);
  gCore.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  gCore.addColorStop(0.6, "rgba(255, 255, 240, 0.95)");
  gCore.addColorStop(1.0, "rgba(255, 220, 120, 0.0)");
  cctx.fillStyle = gCore;
  cctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Wide Soft Amber Atmospheric Bloom Texture
function createGoldenGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.00, "rgba(255, 245, 210, 0.95)");
  g.addColorStop(0.20, "rgba(245, 166, 35, 0.65)");
  g.addColorStop(0.48, "rgba(217, 119, 6, 0.25)");
  g.addColorStop(0.78, "rgba(180, 83, 9, 0.08)");
  g.addColorStop(1.00, "rgba(0, 0, 0, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Electric Cyan Plasma Core Texture (Image 2)
function createCyanCoreTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const cctx = c.getContext("2d");

  // Pure white core radiating into electric cyan, neon teal, deep sapphire
  const g = cctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.00, "rgba(255, 255, 255, 1.0)");
  g.addColorStop(0.12, "rgba(230, 255, 255, 0.98)");
  g.addColorStop(0.30, "rgba(0, 245, 255, 0.88)");
  g.addColorStop(0.55, "rgba(0, 160, 255, 0.50)");
  g.addColorStop(0.80, "rgba(2, 65, 195, 0.18)");
  g.addColorStop(1.00, "rgba(0, 0, 0, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 256, 256);

  const gCore = cctx.createRadialGradient(128, 128, 0, 128, 128, 48);
  gCore.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  gCore.addColorStop(0.6, "rgba(240, 255, 255, 0.95)");
  gCore.addColorStop(1.0, "rgba(140, 255, 255, 0.0)");
  cctx.fillStyle = gCore;
  cctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Wide Soft Electric Cyan/Cobalt Bloom Texture
function createCyanGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.00, "rgba(220, 255, 255, 0.95)");
  g.addColorStop(0.20, "rgba(0, 229, 255, 0.65)");
  g.addColorStop(0.48, "rgba(14, 165, 233, 0.25)");
  g.addColorStop(0.78, "rgba(2, 132, 199, 0.08)");
  g.addColorStop(1.00, "rgba(0, 0, 0, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const goldenCoreTexture = createGoldenCoreTexture();
const goldenGlowTexture = createGoldenGlowTexture();
const cyanCoreTexture = createCyanCoreTexture();
const cyanGlowTexture = createCyanGlowTexture();

// ------------------------------------------------------------------
// GLSL Shaders: Tony Stark JARVIS 3D Holographic Sphere
// (Directly modeled from Video Project 2.mp4 & Image 1 / Image 2)
// ------------------------------------------------------------------

// Faint Planetary Glass Boundary Vertex Shader
const goldenOuterRimVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// High-Definition Holographic 3D Globe Grid Vertex Shader
const jarvisHologramVertexShader = `
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Subtle acoustic surface undulation on voice/speech
    float wave = sin(position.x * 2.5 + uTime * 3.0) * cos(position.y * 2.5 + uTime * 2.5);
    float disp = wave * (0.04 + uPulse * 0.22);
    vDisplacement = disp;
    vec3 displacedPos = position + normal * disp;

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// High-Definition Holographic 3D Globe Grid Fragment Shader
// Renders procedural latitude & longitude grid lines with mathematical anti-aliasing,
// Fresnel rim luminescence, holographic scanlines, and quantum shimmer!
const jarvisHologramFragShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;
  uniform vec3 uGridColor;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.4);

    // Procedural anti-aliased latitude lines (16 divisions)
    float latFract = fract(vUv.y * 16.0 - 0.5) - 0.5;
    float latLine = abs(latFract) / max(fwidth(vUv.y * 16.0), 0.001);
    float latGrid = 1.0 - smoothstep(0.0, 1.4, latLine);

    // Procedural anti-aliased longitude lines (28 divisions)
    float lonFract = fract(vUv.x * 28.0 - 0.5) - 0.5;
    float lonLine = abs(lonFract) / max(fwidth(vUv.x * 28.0), 0.001);
    float lonGrid = 1.0 - smoothstep(0.0, 1.4, lonLine);

    float totalGrid = clamp(latGrid + lonGrid, 0.0, 1.0);

    // Holographic horizontal scanlines drifting down
    float scanline = sin(vWorldPosition.y * 14.0 - uTime * 4.2) * 0.5 + 0.5;

    // Subtle holographic quantum interference flicker
    float flicker = sin(uTime * 28.0) * 0.035 + 0.965;

    // Interior is transparent/deep dark so glowing singularity core is visible inside!
    vec3 interiorCol = uBaseColor * 0.15;
    vec3 rimCol = mix(uBaseColor, uGlowColor, fresnel);
    vec3 gridCol = uGridColor;

    vec3 finalColor = mix(interiorCol, rimCol, fresnel);
    finalColor = mix(finalColor, gridCol, totalGrid * 0.85);
    finalColor *= (0.88 + scanline * 0.16) * flicker;

    // Alpha composition: Transparent center, glowing grid lines, luminous rim, voice flare
    float alpha = fresnel * 0.55 + totalGrid * 0.60;
    alpha += uPulse * 0.35;
    alpha = clamp(alpha, 0.02, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Outer Atmospheric Boundary Fresnel Shader
const jarvisAtmosphereFragShader = `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.4);
    float alpha = fresnel * 0.38;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ------------------------------------------------------------------
// Master Builder: Iron Man JARVIS 3D Holographic Sphere
// (True 3D Volumetric Spherical Hologram from Video Project 2.mp4 & Images 1 & 2)
// ------------------------------------------------------------------
function createJarvisHologramOrb(config = {}) {
  const baseRadius = config.baseRadius || 6.5;
  let mode = config.mode || 'gold'; // 'gold' or 'cyan'
  const dir = config.dir || (mode === 'gold' ? 1 : -1);

  const group = new THREE.Group();

  // Color Palettes
  const PALETTES = {
    gold: {
      baseColor: new THREE.Vector3(0.96, 0.65, 0.14),   // #F5A623 Molten Gold
      glowColor: new THREE.Vector3(1.0, 0.88, 0.48),    // #FFE07A Incandescent Flare
      gridColor: new THREE.Vector3(1.0, 0.94, 0.72),    // #FFF0B8 Coordinate Grid
      rimColor: new THREE.Vector3(1.0, 0.52, 0.08),     // #FF8514 Corona
      hexPrimary: 0xF5A623,
      hexAccent: 0xFFD54F,
      hexBright: 0xFFF9C4,
      hexDeep: 0xD97706,
      coreMap: goldenCoreTexture,
      glowMap: goldenGlowTexture,
    },
    cyan: {
      baseColor: new THREE.Vector3(0.0, 0.88, 1.0),     // #00E0FF Electric Cyan
      glowColor: new THREE.Vector3(0.55, 0.98, 1.0),    // #8CF9FF Neon Ice
      gridColor: new THREE.Vector3(0.85, 1.0, 1.0),     // #D8FFFF Coordinate Grid
      rimColor: new THREE.Vector3(0.08, 0.65, 0.95),    // #14A6F3 Deep Aqua
      hexPrimary: 0x00E5FF,
      hexAccent: 0x14C8B2,
      hexBright: 0x7DF9FF,
      hexDeep: 0x0284C7,
      coreMap: cyanCoreTexture,
      glowMap: cyanGlowTexture,
    }
  };

  let curPalette = PALETTES[mode];

  // 1. Central Thermonuclear Singularity Core
  const coreMat = new THREE.SpriteMaterial({
    map: curPalette.coreMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.96,
    depthWrite: false,
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(baseRadius * 1.55, baseRadius * 1.55, 1);
  group.add(coreSprite);

  // Volumetric Halo Atmosphere
  const innerHaloMat = new THREE.SpriteMaterial({
    map: curPalette.glowMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.72,
    depthWrite: false,
  });
  const innerHalo = new THREE.Sprite(innerHaloMat);
  innerHalo.scale.set(baseRadius * 3.6, baseRadius * 3.6, 1);
  innerHalo.position.z = -0.5;
  group.add(innerHalo);

  // 2. 3D Holographic Globe Coordinate Cage (True 3D Sphere from Video Project 2.mp4)
  const globeGeo = new THREE.SphereGeometry(baseRadius * 1.04, 48, 28);
  const globeMat = new THREE.ShaderMaterial({
    vertexShader: jarvisHologramVertexShader,
    fragmentShader: jarvisHologramFragShader,
    uniforms: {
      uTime: { value: 0.0 },
      uPulse: { value: 0.0 },
      uBaseColor: { value: curPalette.baseColor.clone() },
      uGlowColor: { value: curPalette.glowColor.clone() },
      uGridColor: { value: curPalette.gridColor.clone() },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const globeMesh = new THREE.Mesh(globeGeo, globeMat);
  group.add(globeMesh);

  // Faint Outer Atmospheric Boundary Sphere
  const outerSphereGeo = new THREE.SphereGeometry(baseRadius * 1.34, 36, 36);
  const outerSphereMat = new THREE.ShaderMaterial({
    vertexShader: goldenOuterRimVertexShader,
    fragmentShader: jarvisAtmosphereFragShader,
    uniforms: {
      uColor: { value: curPalette.rimColor.clone() },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const outerSphereMesh = new THREE.Mesh(outerSphereGeo, outerSphereMat);
  group.add(outerSphereMesh);

  // 3. 3D Gyroscopic Gimbal Rings (Astrolabe from Video Project 2.mp4)
  // 5 Nested Rings rotating in 3D with independent Euler angles and precession:
  const gimbalRings = [];

  // Helper: Create Segmented Arc Lines
  function createSegmentedArcGeometry(radius, segmentCount, arcAngleRatio) {
    const pts = [];
    const totalCirc = Math.PI * 2;
    const segStep = totalCirc / segmentCount;
    const activeArc = segStep * arcAngleRatio;
    const stepsPerSeg = 24;

    for (let s = 0; s < segmentCount; s++) {
      const startA = s * segStep;
      for (let j = 0; j < stepsPerSeg; j++) {
        const a1 = startA + activeArc * (j / stepsPerSeg);
        const a2 = startA + activeArc * ((j + 1) / stepsPerSeg);
        pts.push(new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0));
        pts.push(new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, 0));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  // Gimbal 1: Equatorial Gyroscope Ring (3 Segmented Arcs with 3 Tracking Nodes)
  const g1Group = new THREE.Group();
  const g1Geo = createSegmentedArcGeometry(baseRadius * 0.88, 3, 0.78);
  const g1Mat = new THREE.LineSegments(g1Geo, new THREE.LineBasicMaterial({
    color: curPalette.hexBright,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  g1Group.add(g1Mat);
  // 3 Orbital Tracking Beads
  const g1Beads = [];
  for (let b = 0; b < 3; b++) {
    const bMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: curPalette.hexBright, transparent: true, opacity: 0.95 })
    );
    const bAngle = (b / 3) * Math.PI * 2;
    bMesh.position.set(Math.cos(bAngle) * baseRadius * 0.88, Math.sin(bAngle) * baseRadius * 0.88, 0);
    g1Group.add(bMesh);
    g1Beads.push(bMesh);
  }
  group.add(g1Group);
  gimbalRings.push({ group: g1Group, mat: g1Mat, rotSpeed: [0, 0, 0.014 * dir], baseOpacity: 0.88 });

  // Gimbal 2: Polar Meridian Ring (Tilted 90° X, rotating along longitude)
  const g2Group = new THREE.Group();
  g2Group.rotation.x = Math.PI * 0.5;
  const g2Pts = createCirclePoints(baseRadius * 0.98, 80);
  const g2Mat = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(g2Pts),
    new THREE.LineBasicMaterial({ color: curPalette.hexPrimary, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g2Group.add(g2Mat);
  group.add(g2Group);
  gimbalRings.push({ group: g2Group, mat: g2Mat.material, rotSpeed: [0, 0.016 * dir, 0], baseOpacity: 0.75 });

  // Gimbal 3: Orbital Gimbal Alpha (Tilted 45° X, 25° Y, 4 Segmented Arcs with 4 Nodes)
  const g3Group = new THREE.Group();
  g3Group.rotation.set(0.78, 0.35, 0.20);
  const g3Geo = createSegmentedArcGeometry(baseRadius * 1.10, 4, 0.72);
  const g3Mat = new THREE.LineSegments(g3Geo, new THREE.LineBasicMaterial({
    color: curPalette.hexAccent,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  g3Group.add(g3Mat);
  group.add(g3Group);
  gimbalRings.push({ group: g3Group, mat: g3Mat, rotSpeed: [-0.009 * dir, 0.012 * dir, 0.006], baseOpacity: 0.82 });

  // Gimbal 4: Orbital Gimbal Beta (Tilted -55° X, 35° Z, with 48 Radial Local Ticks)
  const g4Group = new THREE.Group();
  g4Group.rotation.set(-0.65, 0.85, -0.45);
  const g4TickPts = [];
  const g4R1 = baseRadius * 1.18;
  const g4Ticks = 48;
  for (let k = 0; k < g4Ticks; k++) {
    const a = (k / g4Ticks) * Math.PI * 2;
    const len = k % 4 === 0 ? baseRadius * 0.06 : baseRadius * 0.03;
    g4TickPts.push(new THREE.Vector3(Math.cos(a) * g4R1, Math.sin(a) * g4R1, 0));
    g4TickPts.push(new THREE.Vector3(Math.cos(a) * (g4R1 + len), Math.sin(a) * (g4R1 + len), 0));
  }
  const g4Mat = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(g4TickPts),
    new THREE.LineBasicMaterial({ color: curPalette.hexPrimary, transparent: true, opacity: 0.70, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g4Group.add(g4Mat);
  group.add(g4Group);
  gimbalRings.push({ group: g4Group, mat: g4Mat, rotSpeed: [0.008 * dir, -0.010 * dir, 0.011], baseOpacity: 0.70 });

  // Gimbal 5: Outer Telemetry Reticle Track (72 Precision Ticks from Image 1)
  const g5Group = new THREE.Group();
  const tickPts = [];
  const tickCount = 72;
  const tickR1 = baseRadius * 1.28;
  for (let i = 0; i < tickCount; i++) {
    const a = (i / tickCount) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const isMedium = i % 3 === 0;
    const tickLen = isMajor ? baseRadius * 0.08 : (isMedium ? baseRadius * 0.045 : baseRadius * 0.025);
    tickPts.push(new THREE.Vector3(Math.cos(a) * tickR1, Math.sin(a) * tickR1, 0));
    tickPts.push(new THREE.Vector3(Math.cos(a) * (tickR1 + tickLen), Math.sin(a) * (tickR1 + tickLen), 0));
  }
  const g5Mat = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tickPts),
    new THREE.LineBasicMaterial({ color: curPalette.hexAccent, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g5Group.add(g5Mat);

  // Outer Segmented Radar Brackets
  const bracketGeo = createSegmentedArcGeometry(baseRadius * 1.40, 4, 0.45);
  const bracketMat = new THREE.LineSegments(bracketGeo, new THREE.LineBasicMaterial({
    color: curPalette.hexBright,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  g5Group.add(bracketMat);

  group.add(g5Group);
  gimbalRings.push({ group: g5Group, mat: g5Mat, rotSpeed: [0, 0, -0.004 * dir], baseOpacity: 0.65 });

  // 4. 3D Internal Swirling Magnetic Plasma Filaments (3D Lissajous & Double Helix)
  const plasmaCurves = [];

  // Curve A: 3D Spherical Lissajous Knot
  const lissPts = [];
  const lissSteps = 160;
  for (let s = 0; s <= lissSteps; s++) {
    const t = (s / lissSteps) * Math.PI * 2;
    const r = baseRadius * 0.68;
    const x = r * Math.sin(3.0 * t) * Math.cos(t);
    const y = r * Math.sin(3.0 * t) * Math.sin(t);
    const z = r * Math.cos(3.0 * t);
    lissPts.push(new THREE.Vector3(x, y, z));
  }
  const lissMat = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(lissPts),
    new THREE.LineBasicMaterial({ color: curPalette.hexBright, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(lissMat);
  plasmaCurves.push({ line: lissMat, rotSpeed: [0.012 * dir, 0.016 * dir, 0.009], baseOpacity: 0.78 });

  // Curve B: 3D Double-Helix Polar Twister
  const helixPts = [];
  const helixSteps = 120;
  for (let h = 0; h <= helixSteps; h++) {
    const ht = (h / helixSteps) * Math.PI * 2 * 3.0;
    const z = (h / helixSteps - 0.5) * baseRadius * 1.35;
    const hr = baseRadius * (0.22 + 0.40 * Math.sin((h / helixSteps) * Math.PI));
    helixPts.push(new THREE.Vector3(Math.cos(ht) * hr, Math.sin(ht) * hr, z));
  }
  const helixMat = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(helixPts),
    new THREE.LineBasicMaterial({ color: curPalette.hexAccent, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(helixMat);
  plasmaCurves.push({ line: helixMat, rotSpeed: [-0.010, 0, 0.022 * dir], baseOpacity: 0.72 });



  // 6. 3D Expanding Spherical Acoustic Shockwaves
  const shockwaves = [];
  const SHOCKWAVE_COUNT = 4;
  for (let s = 0; s < SHOCKWAVE_COUNT; s++) {
    const sPts = createCirclePoints(1.0, 72);
    const sGeo = new THREE.BufferGeometry().setFromPoints(sPts);
    const sLineMat = new THREE.LineBasicMaterial({
      color: curPalette.hexPrimary,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sLine = new THREE.LineLoop(sGeo, sLineMat);
    // Orient in different 3D planes (X-Y, Y-Z, X-Z)
    if (s % 3 === 1) sLine.rotation.x = Math.PI * 0.5;
    if (s % 3 === 2) sLine.rotation.y = Math.PI * 0.5;
    group.add(sLine);
    shockwaves.push({ line: sLine, mat: sLineMat, phase: s / SHOCKWAVE_COUNT, minR: baseRadius * 1.0, maxR: baseRadius * 2.8 });
  }

  // 7. HUD Framing Elements (Image 1 top bar and rosette)
  const hudFraming = new THREE.Group();
  const topBarPts = [];
  const barY = baseRadius * 1.42;
  const barW = baseRadius * 1.45;
  topBarPts.push(new THREE.Vector3(-barW * 0.5, barY, 0));
  topBarPts.push(new THREE.Vector3(barW * 0.5, barY, 0));
  topBarPts.push(new THREE.Vector3(-barW * 0.5, barY + 0.18, 0));
  topBarPts.push(new THREE.Vector3(barW * 0.5, barY + 0.18, 0));
  const topBarMat = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(topBarPts),
    new THREE.LineBasicMaterial({ color: curPalette.hexAccent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending })
  );
  hudFraming.add(topBarMat);

  const rosetteGroup = new THREE.Group();
  rosetteGroup.position.set(baseRadius * 1.20, -baseRadius * 1.25, 0);
  const rosetteR = baseRadius * 0.22;
  rosetteGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(createCirclePoints(rosetteR, 36)),
    new THREE.LineBasicMaterial({ color: curPalette.hexPrimary, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })
  ));
  rosetteGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(createCirclePoints(rosetteR * 0.55, 24)),
    new THREE.LineBasicMaterial({ color: curPalette.hexBright, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending })
  ));
  hudFraming.add(rosetteGroup);
  group.add(hudFraming);

  // Dynamic Mode / Theme Switcher
  function setMode(newMode) {
    if (!PALETTES[newMode]) return;
    mode = newMode;
    curPalette = PALETTES[mode];

    coreMat.map = curPalette.coreMap;
    coreMat.needsUpdate = true;
    innerHaloMat.map = curPalette.glowMap;
    innerHaloMat.needsUpdate = true;

    globeMat.uniforms.uBaseColor.value.copy(curPalette.baseColor);
    globeMat.uniforms.uGlowColor.value.copy(curPalette.glowColor);
    globeMat.uniforms.uGridColor.value.copy(curPalette.gridColor);
    outerSphereMat.uniforms.uColor.value.copy(curPalette.rimColor);

    if (g1Mat && g1Mat.material) g1Mat.material.color.setHex(curPalette.hexBright);
    g1Beads.forEach(b => b.material && b.material.color.setHex(curPalette.hexBright));
    if (g2Mat && g2Mat.material) g2Mat.material.color.setHex(curPalette.hexPrimary);
    if (g3Mat && g3Mat.material) g3Mat.material.color.setHex(curPalette.hexAccent);
    if (g4Mat && g4Mat.material) g4Mat.material.color.setHex(curPalette.hexPrimary);
    if (g5Mat && g5Mat.material) g5Mat.material.color.setHex(curPalette.hexAccent);
    if (bracketMat && bracketMat.material) bracketMat.material.color.setHex(curPalette.hexBright);

    if (lissMat && lissMat.material) lissMat.material.color.setHex(curPalette.hexBright);
    if (helixMat && helixMat.material) helixMat.material.color.setHex(curPalette.hexAccent);

    shockwaves.forEach(sw => sw.mat && sw.mat.color.setHex(curPalette.hexPrimary));
    if (topBarMat && topBarMat.material) topBarMat.material.color.setHex(curPalette.hexAccent);
  }

  // Animation Update Function
  function update(time, pulse, isMobile) {
    const voiceExpand = 1.0 + pulse * 0.55;
    const voiceSpeed = 1.0 + pulse * 6.5;

    // Update Globe Shader Uniforms
    globeMat.uniforms.uTime.value = time * 0.0015;
    globeMat.uniforms.uPulse.value = pulse;

    // Slowly rotate the 3D Holographic Globe Coordinate Mesh
    globeMesh.rotation.y += 0.0028 * dir * voiceSpeed;
    globeMesh.rotation.x = Math.sin(time * 0.0006) * 0.15;

    // Core Singularity Pulsing
    coreSprite.scale.setScalar(baseRadius * (1.55 + Math.sin(time * 0.002) * 0.08 + pulse * 1.3));
    coreMat.opacity = Math.min(1.0, 0.94 + pulse * 0.06);
    innerHalo.scale.setScalar(baseRadius * (3.6 + Math.sin(time * 0.0016) * 0.2 + pulse * 1.8));
    innerHaloMat.opacity = 0.35 + Math.sin(time * 0.002) * 0.06 + pulse * 0.65;

    // 3D Gyroscopic Gimbal Rings Precession & Acceleration
    gimbalRings.forEach((ring, idx) => {
      ring.group.rotation.x += ring.rotSpeed[0] * voiceSpeed;
      ring.group.rotation.y += ring.rotSpeed[1] * voiceSpeed;
      ring.group.rotation.z += ring.rotSpeed[2] * voiceSpeed;
      ring.mat.opacity = Math.min(1.0, ring.baseOpacity + pulse * 0.40 + Math.sin(time * 0.003 + idx) * 0.10);
    });

    // Rosette Widget Rotation
    rosetteGroup.rotation.z += 0.008 + pulse * 0.025;

    // 3D Internal Plasma Filaments Precession
    plasmaCurves.forEach(pc => {
      pc.line.rotation.x += pc.rotSpeed[0] * voiceSpeed;
      pc.line.rotation.y += pc.rotSpeed[1] * voiceSpeed;
      pc.line.rotation.z += pc.rotSpeed[2] * voiceSpeed;
      pc.line.material.opacity = Math.min(1.0, pc.baseOpacity + pulse * 0.35);
    });


    // 3D Expanding Acoustic Shockwaves
    const sSpeed = 0.0028 + pulse * 0.018;
    shockwaves.forEach(sw => {
      sw.phase = (sw.phase + sSpeed) % 1.0;
      const curR = sw.minR + sw.phase * (sw.maxR - sw.minR);
      sw.line.scale.set(curR, curR, curR);
      const env = Math.sin(sw.phase * Math.PI);
      sw.mat.opacity = env * (0.12 + pulse * 0.78);
    });
  }

  return {
    group,
    baseRadius,
    shaderMat: globeMat,
    sphereMesh: globeMesh,
    update,
    setMode,
  };
}

function createGoldenReactorOrb(baseRadius = 6.4) {
  return createJarvisHologramOrb({ baseRadius, mode: 'gold' });
}

function createCyanPlasmaOrb(baseRadius = 6.8) {
  return createJarvisHologramOrb({ baseRadius, mode: 'cyan' });
}

const patientSystem = createGoldenReactorOrb(6.4);
const swastikSystem = createCyanPlasmaOrb(6.8);
scene.add(patientSystem.group);
scene.add(swastikSystem.group);

// Global Hologram Theme Controller: 'jarvis' | 'dual' | 'cyan'
let currentHologramTheme = 'dual';

function setGlobalHologramTheme(theme) {
  currentHologramTheme = theme;
  if (theme === 'jarvis') {
    patientSystem.setMode('gold');
    swastikSystem.setMode('gold');
  } else if (theme === 'cyan') {
    patientSystem.setMode('cyan');
    swastikSystem.setMode('cyan');
  } else {
    patientSystem.setMode('gold');
    swastikSystem.setMode('cyan');
  }
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
  const btn = $(theme === 'jarvis' ? 'themeJarvisBtn' : theme === 'cyan' ? 'themeCyanBtn' : 'themeDualBtn');
  if (btn) btn.classList.add('active');
}

// Bind theme switchers on DOM ready
if (typeof window !== 'undefined') {
  const attachThemeHandlers = () => {
    const jBtn = $('themeJarvisBtn');
    const dBtn = $('themeDualBtn');
    const cBtn = $('themeCyanBtn');
    if (jBtn) jBtn.onclick = () => setGlobalHologramTheme('jarvis');
    if (dBtn) dBtn.onclick = () => setGlobalHologramTheme('dual');
    if (cBtn) cBtn.onclick = () => setGlobalHologramTheme('cyan');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachThemeHandlers);
  } else {
    attachThemeHandlers();
  }
}

// ------------------------------------------------------------------
// Swastik AI Thinking Mode Orbit Ring
// ------------------------------------------------------------------
const thinkingGroup = new THREE.Group();
thinkingGroup.rotation.set(-0.25, 0.35, 0);
const thinkingNodesCount = 6;
const thinkingNodes = [];
for (let i = 0; i < thinkingNodesCount; i++) {
  const tMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.9,
    })
  );
  thinkingGroup.add(tMesh);
  thinkingNodes.push(tMesh);
}
thinkingGroup.visible = false;
swastikSystem.group.add(thinkingGroup);

// ------------------------------------------------------------------
// 3D Neural Synaptic Particle Stream (Helical Bridge between Spheres)
// ------------------------------------------------------------------
const STREAM_PARTICLE_COUNT = 360;
const streamPositions = new Float32Array(STREAM_PARTICLE_COUNT * 3);
const streamColors = new Float32Array(STREAM_PARTICLE_COUNT * 3);
const streamData = [];

for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
  const isDust = i % 3 === 0;
  streamData.push({
    progress: Math.random(),
    speed: isDust ? (0.0018 + Math.random() * 0.0028) : (0.0028 + Math.random() * 0.0045),
    strand: Math.floor(Math.random() * 4),
    phase: Math.random() * Math.PI * 2,
    radiusJitter: (Math.random() - 0.5) * 0.85,
    isDust: isDust,
    sparkleRate: 2.5 + Math.random() * 5.0,
  });
}

const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPositions, 3));
streamGeo.setAttribute("color", new THREE.BufferAttribute(streamColors, 3));

const streamMat = new THREE.PointsMaterial({
  size: 3.4,
  map: dotTexture,
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.92,
  depthWrite: false,
});
const streamPoints = new THREE.Points(streamGeo, streamMat);
scene.add(streamPoints);

// ------------------------------------------------------------------
// 3D Connecting Quantum Filament (Axis Line)
// ------------------------------------------------------------------
const axisLineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 0),
]);
const axisLineMat = new THREE.LineDashedMaterial({
  color: 0x64748B,
  dashSize: 1.5,
  gapSize: 2.5,
  transparent: true,
  opacity: 0.25,
});
const axisLine = new THREE.Line(axisLineGeo, axisLineMat);
scene.add(axisLine);

// ------------------------------------------------------------------
// 3D Interactive Lightning Arcs
// ------------------------------------------------------------------
const LIGHTNING_SEGMENTS = 16;
const lightningPoints = [];
for (let i = 0; i <= LIGHTNING_SEGMENTS; i++) {
  lightningPoints.push(new THREE.Vector3(0, 0, 0));
}
const lightningGeo = new THREE.BufferGeometry().setFromPoints(lightningPoints);
const lightningMat = new THREE.LineBasicMaterial({
  color: 0x64F0FF,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  linewidth: 1.5,
});
const lightningLine = new THREE.Line(lightningGeo, lightningMat);
scene.add(lightningLine);

let lastLightningTime = 0;

function spawnLightning() {
  const p1 = patientSystem.group.position;
  const p2 = swastikSystem.group.position;
  const posArray = lightningGeo.attributes.position.array;

  for (let i = 0; i <= LIGHTNING_SEGMENTS; i++) {
    const t = i / LIGHTNING_SEGMENTS;
    const envelope = Math.sin(t * Math.PI);
    const jitter = envelope * 4.5;
    const idx = i * 3;
    posArray[idx] = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * jitter;
    posArray[idx + 1] = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * jitter;
    posArray[idx + 2] = p1.z + (p2.z - p1.z) * t + (Math.random() - 0.5) * jitter;
  }
  lightningGeo.attributes.position.needsUpdate = true;
  lightningMat.opacity = 0.95;
}

// ------------------------------------------------------------------
// 3D Expanding Shockwaves
// ------------------------------------------------------------------
let activeShockwaves = [];

function triggerShockwave(targetOrb) {
  const isPatient = targetOrb === leftOrb;
  const targetGroup = isPatient ? patientSystem.group : swastikSystem.group;
  const color = isPatient ? 0xF5A623 : 0x14C8B2;

  const ringGeo = new THREE.RingGeometry(targetGroup.scale.x * 6.5, targetGroup.scale.x * 6.7, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.copy(targetGroup.position);
  scene.add(ringMesh);

  activeShockwaves.push({
    mesh: ringMesh,
    scale: 1.0,
    opacity: 0.85,
    speed: 0.045,
  });
}

// ------------------------------------------------------------------
// 3D Booking Celebration Particle Burst
// ------------------------------------------------------------------
let burstMesh = null;
let burstData = [];

function triggerBookingBurst() {
  const burstCount = 65;
  const origin = swastikSystem.group.position;
  burstData = [];

  const bPositions = new Float32Array(burstCount * 3);
  const bColors = new Float32Array(burstCount * 3);

  for (let i = 0; i < burstCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const speed = 0.35 + Math.random() * 0.95;

    burstData.push({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.008,
    });

    const isCyan = Math.random() > 0.4;
    bColors[i * 3] = isCyan ? 0.2 : 0.45;
    bColors[i * 3 + 1] = isCyan ? 0.95 : 0.92;
    bColors[i * 3 + 2] = isCyan ? 0.9 : 0.72;
  }

  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPositions, 3));
  bGeo.setAttribute("color", new THREE.BufferAttribute(bColors, 3));

  const bMat = new THREE.PointsMaterial({
    size: 2.8,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 1.0,
    depthWrite: false,
  });

  if (burstMesh) scene.remove(burstMesh);
  burstMesh = new THREE.Points(bGeo, bMat);
  scene.add(burstMesh);

  triggerShockwave(rightOrb);
  triggerShockwave(leftOrb);
}

// ------------------------------------------------------------------
// 3D Ambient Cosmic Starfield
// ------------------------------------------------------------------
const STAR_COUNT = 180;
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 140;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 90;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 120 - 20;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  size: 1.3,
  map: dotTexture,
  color: 0x94A3B8,
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.4,
  depthWrite: false,
});
const starPoints = new THREE.Points(starGeo, starMat);
scene.add(starPoints);

// ------------------------------------------------------------------
// Interactive 3D Orbit Drag & Lenis-Inspired Momentum Physics
// ------------------------------------------------------------------
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

let isDragging = false;
let prevPointerX = 0;
let prevPointerY = 0;
let rotTargetX = 0;
let rotTargetY = 0;
let rotCurrentX = 0;
let rotCurrentY = 0;
let dragVelX = 0;
let dragVelY = 0;

window.addEventListener("pointerdown", (e) => {
  // Allow interactive 3D rotation when dragging background / canvas
  const isCard = e.target.closest(".hud-card, .subtitles-container, .hud-header, button, a");
  if (!isCard) {
    isDragging = true;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;
    dragVelX = 0;
    dragVelY = 0;
    const dragHint = $("dragHint");
    if (dragHint) dragHint.style.opacity = "0.3";
  }
});

window.addEventListener("pointermove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;

  if (isDragging) {
    const dx = e.clientX - prevPointerX;
    const dy = e.clientY - prevPointerY;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;

    dragVelY = dx * 0.0035;
    dragVelX = dy * 0.0035;
    rotTargetY += dragVelY;
    rotTargetX += dragVelX;
  }
});

window.addEventListener("pointerup", () => {
  isDragging = false;
  const dragHint = $("dragHint");
  if (dragHint) dragHint.style.opacity = "1";
});
window.addEventListener("pointercancel", () => { isDragging = false; });

// ------------------------------------------------------------------
// Responsive 3D Layout & Projection
// ------------------------------------------------------------------
let leftTargetPos = new THREE.Vector3();
let rightTargetPos = new THREE.Vector3();

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  isMobile = width <= 768 || (width <= 900 && height > width);
  isTablet = !isMobile && width <= 1024;

  const vFOV = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
  const visibleWidth = visibleHeight * camera.aspect;

  if (isMobile) {
    // Stacked vertically on mobile / portrait view
    leftTargetPos.set(0, visibleHeight * 0.18, 0);
    rightTargetPos.set(0, -visibleHeight * 0.14, 0);
    patientSystem._baseGroupScale = 0.68;
    swastikSystem._baseGroupScale = 0.70;
  } else if (isTablet) {
    leftTargetPos.set(-visibleWidth * 0.22, 0, 0);
    rightTargetPos.set(visibleWidth * 0.22, 0, 0);
    patientSystem._baseGroupScale = 0.9;
    swastikSystem._baseGroupScale = 0.92;
  } else {
    leftTargetPos.set(-visibleWidth * 0.23, 0, 0);
    rightTargetPos.set(visibleWidth * 0.23, 0, 0);
    patientSystem._baseGroupScale = 1.0;
    swastikSystem._baseGroupScale = 1.02;
  }
}
window.addEventListener("resize", resize);

// ------------------------------------------------------------------
// Inspira UI 3D Card Tilt Engine (CardContainer + CardItem)
// ------------------------------------------------------------------
function init3DCardTilt() {
  const cards = document.querySelectorAll(".hud-card, .subtitles-container, .hud-header");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--mouse-x", `${(e.clientX - rect.left).toFixed(1)}px`);
      card.style.setProperty("--mouse-y", `${(e.clientY - rect.top).toFixed(1)}px`);
      const rotY = (x * 12).toFixed(2);
      const rotX = (-y * 12).toFixed(2);
      const isVis = card.classList.contains("visible") || !card.classList.contains("hud-card");
      if (isVis) {
        card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
      }
    });

    card.addEventListener("pointerleave", () => {
      const isVis = card.classList.contains("visible") || !card.classList.contains("hud-card");
      if (isVis) {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
      }
    });
  });
}
init3DCardTilt();

// ------------------------------------------------------------------
// Real-Time Agent Voice Audio Analyser
// ------------------------------------------------------------------
let agentAnalyser = null;
let agentDataArray = null;

function getAgentAudioLevel() {
  if (!agentAnalyser) {
    if (!audioCtx || !voiceGain) return 0;
    try {
      agentAnalyser = audioCtx.createAnalyser();
      agentAnalyser.fftSize = 64;
      agentAnalyser.smoothingTimeConstant = 0.8;
      agentDataArray = new Uint8Array(agentAnalyser.frequencyBinCount);
      voiceGain.connect(agentAnalyser);
    } catch (e) {
      return 0;
    }
  }
  if (!speaking || !agentDataArray) return 0;
  agentAnalyser.getByteFrequencyData(agentDataArray);
  let sum = 0;
  for (let i = 0; i < agentDataArray.length; i++) {
    sum += agentDataArray[i];
  }
  return sum / (agentDataArray.length * 255);
}

// ------------------------------------------------------------------
// Main 3D WebGL Animation Loop
// ------------------------------------------------------------------
let lastTime = 0;
const projVector = new THREE.Vector3();

function animate(time) {
  const delta = (time - lastTime) * 0.001;
  lastTime = time;

  // Update Inspira UI Border Beam Dynamic Rotation Angle
  const beamAngle = (time * 0.08) % 360;
  document.documentElement.style.setProperty("--beam-angle", `${beamAngle.toFixed(1)}deg`);

  // Check thinking mode transition
  if (lastUserSpeechTime > 0 && !speaking && isCallActive) {
    const elapsed = performance.now() - lastUserSpeechTime;
    if (elapsed > 800 && elapsed < 15000) {
      thinkingMode = true;
    }
  }

  // Audio Pulses
  const userPulse = Math.min(1.2, userRMS * 8.5);
  const realAgentLevel = getAgentAudioLevel();
  const agentPulse = speaking
    ? Math.min(1.2, Math.max(realAgentLevel * 2.4, 0.48 + Math.sin(time * 0.014) * 0.28 + Math.sin(time * 0.033) * 0.18))
    : 0;
  const isCommunicating = userPulse > 0.03 || speaking;

  // Update Shader Uniforms (if defined)
  if (patientSystem.shaderMat && patientSystem.shaderMat.uniforms) {
    patientSystem.shaderMat.uniforms.uTime.value = time * 0.001;
    patientSystem.shaderMat.uniforms.uPulse.value = userPulse;
  }
  if (swastikSystem.shaderMat && swastikSystem.shaderMat.uniforms) {
    swastikSystem.shaderMat.uniforms.uTime.value = time * 0.001;
    swastikSystem.shaderMat.uniforms.uPulse.value = agentPulse;
  }
  if (patientSystem.sphereMesh) patientSystem.sphereMesh.scale.setScalar(1.0 + userPulse * 0.75);
  if (swastikSystem.sphereMesh) swastikSystem.sphereMesh.scale.setScalar(1.0 + agentPulse * 0.75);

  // Dynamic Speech-Reactive Orb Sizing:
  // When Patient speaks: Patient orb grows up to 1.55x (55% larger!),
  // while Swastik orb subtly eases into an attentive listening state (0.92x).
  // When Swastik speaks: Swastik orb grows up to 1.58x (58% larger!),
  // while Patient orb subtly eases into an attentive listening state (0.92x).
  // When idle: both relax at base scale (1.0x) with gentle organic breathing.
  const pBaseScale = patientSystem._baseGroupScale || 1.0;
  const sBaseScale = swastikSystem._baseGroupScale || 1.02;

  let pTargetScale = pBaseScale;
  let sTargetScale = sBaseScale;

  if (userPulse > 0.03) {
    // Patient speaking: dramatic scale expansion (up to 1.55x)
    pTargetScale = pBaseScale * (1.0 + userPulse * 0.52);
    sTargetScale = sBaseScale * Math.max(0.90, 1.0 - userPulse * 0.08);
  } else if (speaking) {
    // Swastik AI speaking: dramatic scale expansion (up to 1.58x)
    sTargetScale = sBaseScale * (1.0 + agentPulse * 0.54);
    pTargetScale = pBaseScale * Math.max(0.90, 1.0 - agentPulse * 0.08);
  } else {
    // Idle ambient breathing
    pTargetScale = pBaseScale * (1.0 + Math.sin(time * 0.002) * 0.035);
    sTargetScale = sBaseScale * (1.0 + Math.sin(time * 0.002 + 1.5) * 0.035);
  }

  // Snappy yet organic lerp for instantaneous speech responsiveness
  const pCurScale = patientSystem.group.scale.x;
  const sCurScale = swastikSystem.group.scale.x;
  const pNewScale = pCurScale + (pTargetScale - pCurScale) * 0.14;
  const sNewScale = sCurScale + (sTargetScale - sCurScale) * 0.14;
  patientSystem.group.scale.setScalar(pNewScale);
  swastikSystem.group.scale.setScalar(sNewScale);

  // Update Golden Sci-Fi Arc Reactor Orb (Image 1)
  if (patientSystem && patientSystem.update) {
    patientSystem.update(time, userPulse, isMobile);
  }

  // Update Electric Cyan Volumetric Plasma Nebula Orb (Image 2)
  if (swastikSystem && swastikSystem.update) {
    swastikSystem.update(time, agentPulse, isMobile);
  }

  // Thinking Mode Indicator Animation
  const thinkingDotsEl = $("aiThinkingDots");
  if (thinkingMode) {
    thinkingGroup.visible = true;
    if (thinkingDotsEl) thinkingDotsEl.style.display = "inline-flex";
    thinkingGroup.rotation.z += 0.035;
    for (let i = 0; i < thinkingNodesCount; i++) {
      const angle = (i / thinkingNodesCount) * Math.PI * 2;
      const r = swastikSystem.baseRadius * (1.45 + Math.sin(time * 0.006 + i) * 0.1);
      thinkingNodes[i].position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    }
  } else {
    thinkingGroup.visible = false;
    if (thinkingDotsEl) thinkingDotsEl.style.display = "none";
  }

  // Harmonic Floating Motion (Levitation & Natural Breathing)
  const floatPatientX = Math.sin(time * 0.0009) * 0.5 + Math.cos(time * 0.0018) * 0.2;
  const floatPatientY = Math.cos(time * 0.0012) * 0.65 + Math.sin(time * 0.0023) * 0.25;
  const floatPatientZ = Math.sin(time * 0.0015) * 0.35;

  const floatSwastikX = -Math.cos(time * 0.0010) * 0.5 + Math.sin(time * 0.0019) * 0.2;
  const floatSwastikY = Math.sin(time * 0.0013) * 0.65 - Math.cos(time * 0.0025) * 0.25;
  const floatSwastikZ = Math.cos(time * 0.0014) * 0.35;

  // Audio Micro-Vibration & Physical Resonance
  const vibP = userPulse > 0.05 ? (Math.random() - 0.5) * userPulse * 0.15 : 0;
  const vibS = agentPulse > 0.05 ? (Math.random() - 0.5) * agentPulse * 0.15 : 0;

  patientSystem.group.position.set(
    leftTargetPos.x + floatPatientX,
    leftTargetPos.y + floatPatientY + vibP,
    leftTargetPos.z + floatPatientZ
  );
  swastikSystem.group.position.set(
    rightTargetPos.x + floatSwastikX,
    rightTargetPos.y + floatSwastikY + vibS,
    rightTargetPos.z + floatSwastikZ
  );

  // Update 3D Connecting Axis Filament (connect outer rims, scaling dynamically with orb size)
  const rOffsetP = patientSystem.baseRadius * 1.08 * patientSystem.group.scale.x;
  const rOffsetS = swastikSystem.baseRadius * 1.08 * swastikSystem.group.scale.x;
  const axisPositions = axisLine.geometry.attributes.position.array;
  axisPositions[0] = patientSystem.group.position.x + rOffsetP;
  axisPositions[1] = patientSystem.group.position.y;
  axisPositions[2] = patientSystem.group.position.z;
  axisPositions[3] = swastikSystem.group.position.x - rOffsetS;
  axisPositions[4] = swastikSystem.group.position.y;
  axisPositions[5] = swastikSystem.group.position.z;
  axisLine.geometry.attributes.position.needsUpdate = true;
  axisLine.computeLineDistances();

  // Update 3D Helical Neural Synaptic Particle Stream (Connecting outer rims)
  const sPos = streamGeo.attributes.position.array;
  const sCol = streamGeo.attributes.color.array;
  const p1 = new THREE.Vector3(patientSystem.group.position.x + rOffsetP, patientSystem.group.position.y, patientSystem.group.position.z);
  const p2 = new THREE.Vector3(swastikSystem.group.position.x - rOffsetS, swastikSystem.group.position.y, swastikSystem.group.position.z);

  // Stream flows according to speaker activity
  let flowDir = 1.0;
  if (speaking && userPulse < 0.05) {
    flowDir = -1.0; // flow from Swastik to Patient
  }
  const streamSpeedBoost = isCommunicating ? 3.4 : 1.0;

  for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
    const pt = streamData[i];
    pt.progress += pt.speed * streamSpeedBoost * flowDir;
    if (pt.progress > 1.0) pt.progress -= 1.0;
    if (pt.progress < 0.0) pt.progress += 1.0;

    const t = pt.progress;
    // Multi-strand DNA helix with organic twist and voice expansion
    const strandAngle = t * Math.PI * 6 + time * 0.0035 + pt.strand * 1.57 + pt.phase;
    const voiceExpand = isCommunicating ? (1.0 + Math.max(userPulse, agentPulse) * 0.65) : 1.0;
    const baseHelixR = (pt.isDust ? 0.9 : 1.5) + Math.sin(t * Math.PI) * 1.8;
    const helixRadius = (baseHelixR * voiceExpand + pt.radiusJitter) * (isMobile ? 0.6 : 1.0);

    const baseX = p1.x + (p2.x - p1.x) * t;
    const baseY = p1.y + (p2.y - p1.y) * t;
    const baseZ = p1.z + (p2.z - p1.z) * t;

    // Cross vector offsets for 3D helix with harmonic flutter
    const flutter = Math.sin(time * 0.004 + t * 12.0) * 0.25;
    const idx = i * 3;
    if (isMobile) {
      sPos[idx] = baseX + Math.cos(strandAngle) * helixRadius;
      sPos[idx + 1] = baseY + flutter;
      sPos[idx + 2] = baseZ + Math.sin(strandAngle) * helixRadius;
    } else {
      sPos[idx] = baseX;
      sPos[idx + 1] = baseY + Math.sin(strandAngle) * helixRadius + flutter;
      sPos[idx + 2] = baseZ + Math.cos(strandAngle) * helixRadius;
    }

    // Color gradient & dynamic energy boost:
    // Gold near Patient -> Cyan/Teal near Swastik, sparkling with voice surges!
    const sparkle = Math.sin(time * 0.001 * pt.sparkleRate + pt.phase) * 0.3 + 0.7;
    const surge = isCommunicating ? 0.25 : 0.0;
    sCol[idx] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(1.0, 0.15, t) * sparkle + surge, 0, 1);
    sCol[idx + 1] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.75, 0.95, t) * sparkle + surge, 0, 1);
    sCol[idx + 2] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.2, 1.0, t) * sparkle + surge, 0, 1);
  }
  streamGeo.attributes.position.needsUpdate = true;
  streamGeo.attributes.color.needsUpdate = true;

  // Stream particle size reacts dynamically to speech energy!
  streamMat.size = 3.4 + Math.max(userPulse, agentPulse) * 2.6;
  streamMat.opacity = Math.min(1.0, 0.88 + Math.max(userPulse, agentPulse) * 0.12);

  // 3D Lightning Arc during Voice Communication
  if (isCommunicating && time - lastLightningTime > 320 + Math.random() * 650) {
    spawnLightning();
    lastLightningTime = time;
  }
  if (lightningMat.opacity > 0) {
    lightningMat.opacity -= 0.045;
  }

  // Update 3D Shockwaves
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.scale += sw.speed;
    sw.opacity -= 0.018;
    sw.mesh.scale.set(sw.scale, sw.scale, sw.scale);
    sw.mesh.material.opacity = Math.max(0, sw.opacity);

    if (sw.opacity <= 0) {
      scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
      activeShockwaves.splice(i, 1);
    }
  }

  // Update 3D Booking Celebration Particles
  if (burstMesh) {
    let anyAlive = false;
    const bPos = burstMesh.geometry.attributes.position.array;
    for (let i = 0; i < burstData.length; i++) {
      const b = burstData[i];
      if (b.life <= 0) continue;
      anyAlive = true;
      b.x += b.vx;
      b.y += b.vy;
      b.z += b.vz;
      b.vx *= 0.96;
      b.vy *= 0.96;
      b.vz *= 0.96;
      b.life -= b.decay;

      const idx = i * 3;
      bPos[idx] = b.x;
      bPos[idx + 1] = b.y;
      bPos[idx + 2] = b.z;
    }
    burstMesh.geometry.attributes.position.needsUpdate = true;
    burstMesh.material.opacity = Math.max(0, burstData[0]?.life || 0);

    if (!anyAlive) {
      scene.remove(burstMesh);
      burstMesh.geometry.dispose();
      burstMesh.material.dispose();
      burstMesh = null;
      burstData = [];
    }
  }

  // Twinkle Ambient Starfield
  starMat.opacity = 0.35 + Math.sin(time * 0.001) * 0.1;

  // 3D Parallax Camera Motion & Lenis Momentum Damping
  currentMouseX += (targetMouseX - currentMouseX) * 0.05;
  currentMouseY += (targetMouseY - currentMouseY) * 0.05;
  camera.position.x = currentMouseX * 5.5;
  camera.position.y = -currentMouseY * 3.8;
  camera.lookAt(0, 0, 0);

  // Apply Lenis Momentum Drag to 3D Scene Rotation
  if (!isDragging) {
    rotTargetX += dragVelX;
    rotTargetY += dragVelY;
    dragVelX *= 0.92; // Inertia damping
    dragVelY *= 0.92;
    rotTargetX *= 0.985; // Spring return to neutral
    rotTargetY *= 0.985;
  }
  rotCurrentX += (rotTargetX - rotCurrentX) * 0.08;
  rotCurrentY += (rotTargetY - rotCurrentY) * 0.08;
  scene.rotation.x = rotCurrentX;
  scene.rotation.y = rotCurrentY;

  // Render 3D Scene
  renderer.render(scene, camera);

  // Screen Space Projections for HUD overlays & Stage Status Badge
  patientSystem.group.getWorldPosition(projVector);
  projVector.project(camera);
  const leftScreenX = (projVector.x * 0.5 + 0.5) * width;
  const leftScreenY = (-(projVector.y * 0.5) + 0.5) * height;

  swastikSystem.group.getWorldPosition(projVector);
  projVector.project(camera);
  const rightScreenX = (projVector.x * 0.5 + 0.5) * width;
  const rightScreenY = (-(projVector.y * 0.5) + 0.5) * height;

  leftOrb.x = leftScreenX;
  leftOrb.y = leftScreenY;
  rightOrb.x = rightScreenX;
  rightOrb.y = rightScreenY;

  const badgeContainer = $("stageBadgeContainer");
  if (badgeContainer) {
    badgeContainer.style.left = `${leftScreenX}px`;
    badgeContainer.style.top = `${leftScreenY - (isMobile ? 78 : 94)}px`;
  }

  // Dynamically position orb labels on desktop/tablet
  const orbLabels = document.querySelector(".orb-labels-container");
  if (orbLabels && !isMobile) {
    const pBlock = orbLabels.querySelector(".patient");
    const sBlock = orbLabels.querySelector(".swastik");
    if (pBlock) {
      pBlock.style.position = "absolute";
      pBlock.style.left = `${leftScreenX}px`;
      pBlock.style.top = `${leftScreenY + 75}px`;
      pBlock.style.transform = "translateX(-50%)";
      pBlock.style.margin = "0";
    }
    if (sBlock) {
      sBlock.style.position = "absolute";
      sBlock.style.left = `${rightScreenX}px`;
      sBlock.style.top = `${rightScreenY + 75}px`;
      sBlock.style.transform = "translateX(-50%)";
      sBlock.style.margin = "0";
    }
  }

  // Update Mini Equalizer Bars
  if (waveBars && waveBars.length) {
    const activeLevel = speaking ? agentPulse : userPulse;
    waveBars.forEach((bar, idx) => {
      const h = Math.max(
        3,
        Math.min(14, 3 + activeLevel * 10 * Math.sin(time * 0.01 + idx))
      );
      bar.style.height = `${h}px`;
      bar.style.background = speaking ? "#14C8B2" : "#F5A623";
    });
  }

  requestAnimationFrame(animate);
}

// ----------------------------------------------------
// Tool Action Handlers & HUD Card Animations
// ----------------------------------------------------
function handleToolAction(cmd) {
  if (cmd.action === "show_calendar") {
    setStage("READING REAL SLOTS");
    calendarCard.classList.add("visible");

    if (cmd.slots && slotsContainer) {
      updateSlotsUI(cmd.slots);
    }
  } else if (cmd.action === "booking_confirmed") {
    setStage("WRITTEN TO THE CALENDAR");
    calendarCard.classList.add("visible");

    const mode = (cmd.data && cmd.data.consultation_mode) ? cmd.data.consultation_mode.toUpperCase() : "ONLINE";

    if (cmd.slots && slotsContainer) {
      updateSlotsUI(cmd.slots);
    }

    const slot1100 = $("slot-1100");
    if (slot1100) {
      slot1100.className = "slot-row booked";
      slot1100.innerHTML = `<span>11:00 · ${mode}</span><span class="badge-booked">BOOKED</span>`;
    }

    // Trigger celebration effects
    triggerBookingBurst();
  } else if (cmd.action === "whatsapp_send" && cmd.data) {
    setStage("CONFIRMATION ON WHATSAPP");
    waCard.classList.add("visible");
    const name = cmd.data.patient_name || "Patient";
    const slot = cmd.data.slot_time || "11:00 AM";
    const cat = cmd.data.category || "Consultation";
    const mode = cmd.data.consultation_mode || "Online";
    waText.textContent = `${name} — your ${mode} appointment for ${cat} with Dr. Sharma is confirmed for tomorrow at ${slot}. Consultation fee ₹499.`;

    const waFormLink = $("waFormLink");
    if (waFormLink && cmd.data.form_url) waFormLink.href = cmd.data.form_url;

    const waSendBtn = $("waSendBtn");
    if (waSendBtn && cmd.data.wa_url) {
      waSendBtn.href = cmd.data.wa_url;
      waSendBtn.style.display = "flex";
    }

    triggerShockwave(rightOrb);
  } else if (cmd.action === "slot_update" && cmd.slots) {
    updateSlotsUI(cmd.slots);
  }
}

// Dynamic slot UI update
function updateSlotsUI(slots) {
  if (!slotsContainer) return;
  const slotIds = ["slot-1100", "slot-1130", "slot-1200", "slot-1230", "slot-1300"];
  slots.forEach((slot, idx) => {
    if (idx >= slotIds.length) return;
    const el = $(slotIds[idx]);
    if (!el) return;
    if (slot.status === "BOOKED") {
      el.className = "slot-row booked";
      el.innerHTML = `<span>${slot.time} ${slot.type}</span><span class="badge-booked">BOOKED</span>`;
    } else {
      el.className = "slot-row";
      el.innerHTML = `<span>${slot.time} ${slot.type}</span><span class="badge-free">FREE</span>`;
    }
  });
}

// ----------------------------------------------------
// Connection Chime (synthesized via Web Audio oscillator)
// ----------------------------------------------------
function playConnectionChime() {
  if (!audioCtx) return;
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
    osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime + 0.24);
    osc1.stop(audioCtx.currentTime + 0.36);
    osc2.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    // Silently fail — chime is decorative
  }
}

// ----------------------------------------------------
// Voice Playback (24kHz PCM from Gemini Live) with Anti-Glitch Gain
// ----------------------------------------------------
function playVoice(buf) {
  if (!audioCtx) return;
  if (!voiceGain) {
    voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
    voiceGain.connect(audioCtx.destination);
  }

  const int16 = new Int16Array(buf);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
  const ab = audioCtx.createBuffer(1, f32.length, 24000);
  ab.getChannelData(0).set(f32);

  const src = audioCtx.createBufferSource();
  src.buffer = ab;
  src.connect(voiceGain);

  const now = audioCtx.currentTime;
  if (nextStart < now) {
    // Increase buffer delay to 0.15s to reduce stuttering/buffering
    nextStart = now + 0.15;
  }
  src.start(nextStart);
  nextStart += ab.duration;

  activeSources.push(src);
  src.onended = () => {
    activeSources = activeSources.filter((s) => s !== src);
    if (!activeSources.length) {
      speaking = false;
    }
  };
  speaking = true;
  thinkingMode = false;
}

function stopVoice() {
  if (!speaking && !activeSources.length) return;

  if (voiceGain && audioCtx) {
    const now = audioCtx.currentTime;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
    voiceGain.gain.linearRampToValueAtTime(0.001, now + 0.035);
    setTimeout(() => {
      activeSources.forEach((s) => { try { s.stop(); } catch { } });
      activeSources = [];
      nextStart = 0;
      speaking = false;
      if (voiceGain && audioCtx) {
        voiceGain.gain.cancelScheduledValues(audioCtx.currentTime);
        voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
      }
    }, 40);
  } else {
    activeSources.forEach((s) => { try { s.stop(); } catch { } });
    activeSources = [];
    nextStart = 0;
    speaking = false;
  }
}

// ----------------------------------------------------
// WebSocket Live Connection & Mic AudioWorklet
// ----------------------------------------------------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    connLabel.textContent = "CONNECTED";
    statusDot.style.background = "#10B981";
    setStage("WHY THEY CALLED");
    playConnectionChime();
  };

  ws.onclose = () => {
    connLabel.textContent = "DISCONNECTED";
    statusDot.style.background = "#EF4444";
    stopVoice();
  };

  ws.onmessage = (evt) => {
    if (typeof evt.data !== "string") {
      playVoice(evt.data);
      return;
    }
    const msg = JSON.parse(evt.data);
    if (msg.type === "transcript") {
      setSubtitles(msg.role, msg.text);
      if (msg.role === "user") {
        setStage("CALLER ASKS FOR ADVICE");
        triggerShockwave(leftOrb);
      }
    } else if (msg.type === "tool_action") {
      handleToolAction(msg);
    } else if (msg.type === "interrupted") {
      stopVoice();
    }
  };
}

async function startMic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  await audioCtx.audioWorklet.addModule("/pcm-processor.js");

  voiceGain = audioCtx.createGain();
  voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
  voiceGain.connect(audioCtx.destination);

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const source = audioCtx.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");

  workletNode.port.onmessage = (e) => {
    userRMS = e.data.rms || 0;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(e.data.pcm);
    }

    if (userRMS >= BARGE_THRESHOLD) {
      speechFrameCount++;
      if (speechFrameCount >= 3 && speaking) {
        stopVoice();
        speechFrameCount = 0;
      }
    } else {
      speechFrameCount = Math.max(0, speechFrameCount - 1);
    }
  };

  source.connect(workletNode);

  silentSink = audioCtx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(audioCtx.destination);
  workletNode.connect(silentSink);
}

function stopCall() {
  isCallActive = false;
  thinkingMode = false;
  lastUserSpeechTime = 0;
  callBtn.classList.remove("in-call");
  callBtnIcon.textContent = "🎙";
  callBtnText.textContent = "Start Call";
  stopCallTimer();
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  stopVoice();
}

async function startCall() {
  // Check for HTTPS / Secure Context when running in production
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    alert("Microphone access requires a secure connection (HTTPS). Please open this site over HTTPS.");
    return;
  }

  callBtn.classList.add("in-call");
  callBtnIcon.textContent = "⏳";
  callBtnText.textContent = "Connecting...";

  try {
    await startMic();
    connect();
    isCallActive = true;
    callBtnIcon.textContent = "⏹";
    callBtnText.textContent = "End Call";
    startCallTimer();
  } catch (err) {
    console.error("Failed to start voice call:", err);
    stopCall();
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      alert("Microphone permission was denied. Please allow microphone access in your browser settings to speak with Swastik AI.");
    } else {
      alert("Could not start microphone: " + (err.message || err.name || "Unknown error"));
    }
  }
}

callBtn.addEventListener("click", () => {
  if (isCallActive) {
    stopCall();
  } else {
    startCall();
  }
});

// Initialize canvas and launch motion render loop
resize();
requestAnimationFrame(animate);
