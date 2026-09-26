// Dr. Sharma Clinic — Hyper-Futuristic AI Voice Receptionist Engine
// Swastik AI Dual Fluid Wave Particle Orbs (Patient & Swastik AI)

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

// Noise Cancellation & VAD State
let aecNode = null;
let agcNode = null;
let noiseSuppressorNode = null;
let speakerMaskNode = null;
let currentVADProbability = 0;
let currentSNR = 0;
let currentNoiseFloor = 0;
let ncEnabled = true; // Noise cancellation toggle

// Graceful Degradation State
let lowSNRFrameCount = 0;

// Call timer state
let callStartTime = 0;
let callTimerInterval = null;

// Thinking state (between user speech end and agent speech start)
let thinkingMode = false;
let lastUserSpeechTime = 0;

// Conversation simulation state when idle
let simActive = true;
let simIdx = 0;
let simTimer = 0;

const SIM_CONVERSATION = [
  {
    speaker: "swastik",
    stage: "WHY THEY CALLED",
    hindi: "नमस्ते! डॉ. शर्मा क्लिनिक में आपका स्वागत है। मैं स्वास्तिक एआई हूँ, आपकी क्या सहायता कर सकता हूँ?",
    english: "Hello! Welcome to Dr. Sharma Clinic. I am Swastik AI, how may I help you?",
    pulseAgent: 0.52,
    pulsePatient: 0.02,
    duration: 5000,
  },
  {
    speaker: "patient",
    stage: "CALLER ASKS FOR ADVICE",
    hindi: "हाँ, मुझे कल रात से बहुत तेज दांत में दर्द हो रहा है... क्या डॉ. शर्मा से मिलना हो सकता है?",
    english: "Yes, I have severe toothache since last night... Can I consult Dr. Sharma?",
    pulseAgent: 0.02,
    pulsePatient: 0.58,
    duration: 4800,
  },
  {
    speaker: "swastik",
    stage: "READING REAL SLOTS",
    hindi: "दांत दर्द के लिए डॉ. शर्मा कल उपलब्ध हैं। क्या मैं आपके लिए सुबह 11:00 बजे का स्लॉट बुक कर दूँ?",
    english: "Dr. Sharma is available tomorrow for toothache. Shall I book an 11:00 AM slot for you?",
    pulseAgent: 0.54,
    pulsePatient: 0.02,
    showCalendar: true,
    duration: 5200,
  },
  {
    speaker: "patient",
    stage: "OFFERING A DOCTOR",
    hindi: "जी हाँ, कल 11:00 बजे का कन्फर्म कर दीजिए।",
    english: "Yes, please confirm for tomorrow at 11:00 AM.",
    pulseAgent: 0.02,
    pulsePatient: 0.46,
    duration: 3500,
  },
  {
    speaker: "swastik",
    stage: "WRITTEN TO THE CALENDAR",
    hindi: "बहुत बढ़िया! आपका 11:00 बजे का अपॉइंटमेंट बुक हो गया है। डिटेल्स आपके WhatsApp पर भेज दी हैं।",
    english: "Great! Your 11:00 AM appointment is confirmed. Details sent to your WhatsApp.",
    pulseAgent: 0.55,
    pulsePatient: 0.02,
    showBooking: true,
    showWhatsApp: true,
    duration: 5600,
  }
];

function setStage(stageName) {
  if (stageBadgeText) {
    stageBadgeText.textContent = stageName.toUpperCase();
  }
  const calBadge = document.getElementById("calLiveBadge");
  if (calBadge) {
    const isCalActive = stageName.includes("CALENDAR") || stageName.includes("SLOT");
    if (isCalActive) {
      calBadge.classList.add("is-writing");
      calBadge.textContent = "● " + (stageName.includes("WRITTEN") ? "WRITTEN" : "SYNCING");
    } else {
      calBadge.classList.remove("is-writing");
      calBadge.textContent = "● LIVE SYNC";
    }
  }
}

function setSubtitles(role, text) {
  if (!speakerTag || !subMain) return;

  if (role === "swastik") {
    speakerTag.className = "speaker-tag swastik";
    speakerTag.textContent = "SWASTIK AI";
    thinkingMode = false;
  } else {
    speakerTag.className = "speaker-tag patient";
    speakerTag.textContent = "PATIENT";
    lastUserSpeechTime = performance.now();
  }

  subMain.classList.remove("fade-in");
  void subMain.offsetWidth; // force reflow
  subMain.classList.add("fade-in");

  subMain.textContent = text;

  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (subTrans) {
    if (hasDevanagari) {
      subTrans.textContent = "(English translation) " + text;
      subTrans.style.display = "block";
    } else {
      subTrans.style.display = "none";
    }
  }
}

// Phase 3: Telemetry State
let telemetryInterval = null;

// Phase 3: Jitter Buffer
let jitterBuffer = [];
let JITTER_BUFFER_SIZE = 2; // 2 frames lookahead

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
// High-Tech 3D WebGL Engine: Dual Fluid Wave Particle Orbs (Three.js)
// Matching /orb & DualParticleOrb.tsx (Image 2 silky wave folds)
// ------------------------------------------------------------------
let width = window.innerWidth;
let height = window.innerHeight;
let isMobile = false;
let isTablet = false;

// Backward-compatible coordinate state for UI tracking
let leftOrb = { x: 0, y: 0, baseRadius: 2.3, radius: 2.3, shockwaves: [] };
let rightOrb = { x: 0, y: 0, baseRadius: 2.3, radius: 2.3, shockwaves: [] };

// 3D Scene, Camera & WebGL Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
camera.position.set(0, 0, 25);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

// Color Palettes
const THEMES = {
  cyan: {
    primary: new THREE.Color(0x00E5FF),
    deep: new THREE.Color(0x004466),
    highlight: new THREE.Color(0xE6FFFF),
    ringCol: 0x00E5FF,
    glowRgb: "0, 229, 255",
  },
  gold: {
    primary: new THREE.Color(0xFF9E00),
    deep: new THREE.Color(0x7A2200),
    highlight: new THREE.Color(0xFFF6D6),
    ringCol: 0xFF9E00,
    glowRgb: "255, 158, 0",
  },
};

// ── Procedural Textures (Zero Box Artifacts, Gaussian Softness) ──
function createPhotonTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.12, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(0.28, "rgba(255, 255, 255, 0.65)");
  grad.addColorStop(0.55, "rgba(255, 255, 255, 0.15)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createAnamorphicFlareTexture(rgb) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  const cx = 512;
  const cy = 128;
  const imgData = ctx.createImageData(1024, 256);
  const data = imgData.data;
  const [r, g, b] = rgb.split(",").map((v) => parseInt(v.trim()));

  for (let y = 0; y < 256; y++) {
    const dy = (y - cy) / 54.0;
    const dy2 = dy * dy;
    for (let x = 0; x < 1024; x++) {
      const dx = (x - cx) / 440.0;
      const dx2 = dx * dx;
      const factor = Math.exp(-(dx2 * 2.5 + dy2 * 4.8));
      const core = Math.exp(-(dx2 * 28.0 + dy2 * 28.0)) * 1.6;
      const intensity = Math.min(1.0, factor + core);
      const idx = (y * 1024 + x) * 4;
      if (intensity > 0.003) {
        const whiteBlend = Math.min(1.0, factor * 1.5 + core * 2.0);
        data[idx] = Math.round(r + (255 - r) * whiteBlend * 0.85);
        data[idx + 1] = Math.round(g + (255 - g) * whiteBlend * 0.85);
        data[idx + 2] = Math.round(b + (255 - b) * whiteBlend * 0.85);
        data[idx + 3] = Math.round(intensity * 255);
      } else {
        data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createStarGlintTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const cx = 128;
  const cy = 128;
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  for (let y = 0; y < 256; y++) {
    const dy = (y - cy) / 120.0;
    for (let x = 0; x < 256; x++) {
      const dx = (x - cx) / 120.0;
      const r = Math.sqrt(dx * dx + dy * dy);
      const spikeX = Math.exp(-((dx * 1.2) ** 2 + (dy * 22.0) ** 2));
      const spikeY = Math.exp(-((dy * 1.2) ** 2 + (dx * 22.0) ** 2));
      const diag1 = Math.exp(-(((dx + dy) * 1.4) ** 2 + ((dx - dy) * 14.0) ** 2)) * 0.35;
      const diag2 = Math.exp(-(((dx - dy) * 1.4) ** 2 + ((dx + dy) * 14.0) ** 2)) * 0.35;
      const core = Math.exp(-(r * 9.0)) * 1.3;
      const val = Math.min(1.0, spikeX * 0.8 + spikeY * 0.8 + diag1 + diag2 + core);
      const idx = (y * 256 + x) * 4;
      if (val > 0.004) {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(val * 255);
      } else {
        data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createSoftHaloTexture(rgb) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, `rgba(${rgb}, 0.65)`);
  grad.addColorStop(0.25, `rgba(${rgb}, 0.28)`);
  grad.addColorStop(0.65, `rgba(${rgb}, 0.05)`);
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const photonTex = createPhotonTexture();
const starGlintTex = createStarGlintTexture();
const flareCyanTex = createAnamorphicFlareTexture(THEMES.cyan.glowRgb);
const flareGoldTex = createAnamorphicFlareTexture(THEMES.gold.glowRgb);
const haloCyanTex = createSoftHaloTexture(THEMES.cyan.glowRgb);
const haloGoldTex = createSoftHaloTexture(THEMES.gold.glowRgb);

// ── Fluid Orb Subsystem (Silky Wave Folds from Image 2 & /orb) ──
class FluidOrbEntity {
  constructor(type, xPos, radius = 2.7) {
    this.type = type;
    this.baseRadius = radius;
    this.currentPos = new THREE.Vector3(xPos, 0, 0);
    this.group = new THREE.Group();
    this.group.position.copy(this.currentPos);

    this.sphereGroup = new THREE.Group();
    this.group.add(this.sphereGroup);

    this.ringsGroup = new THREE.Group();
    this.group.add(this.ringsGroup);

    const pal = THEMES[type];

    // 1. Inner Undulating Fluid Waves (Silky Harmonic Wave Folds)
    const WAVE_RINGS = 100;
    const POINTS_PER_RING = 130;
    const WAVE_TOTAL = WAVE_RINGS * POINTS_PER_RING;
    this.waveGeo = new THREE.BufferGeometry();
    const wPositions = new Float32Array(WAVE_TOTAL * 3);
    const wColors = new Float32Array(WAVE_TOTAL * 3);
    this.waveMeta = [];

    let idx = 0;
    for (let r = 0; r < WAVE_RINGS; r++) {
      const v = (r / (WAVE_RINGS - 1)) * Math.PI - Math.PI / 2;
      for (let p = 0; p < POINTS_PER_RING; p++) {
        const u = (p / POINTS_PER_RING) * Math.PI * 2;
        wPositions[idx * 3] = 0;
        wPositions[idx * 3 + 1] = 0;
        wPositions[idx * 3 + 2] = 0;
        wColors[idx * 3] = pal.primary.r;
        wColors[idx * 3 + 1] = pal.primary.g;
        wColors[idx * 3 + 2] = pal.primary.b;
        this.waveMeta.push({ u, v, baseR: radius * 0.92 });
        idx++;
      }
    }
    this.waveGeo.setAttribute("position", new THREE.BufferAttribute(wPositions, 3));
    this.waveGeo.setAttribute("color", new THREE.BufferAttribute(wColors, 3));

    this.waveMat = new THREE.PointsMaterial({
      size: 0.20,
      map: photonTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.waveMesh = new THREE.Points(this.waveGeo, this.waveMat);
    this.sphereGroup.add(this.waveMesh);

    // 2. Outer Crystalline Fibonacci Shell
    const SHELL_COUNT = 11000;
    this.shellGeo = new THREE.BufferGeometry();
    const sPositions = new Float32Array(SHELL_COUNT * 3);
    const sColors = new Float32Array(SHELL_COUNT * 3);
    this.shellMeta = [];

    for (let i = 0; i < SHELL_COUNT; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / SHELL_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = radius * (0.98 + Math.random() * 0.04);

      sPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      sPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      sPositions[i * 3 + 2] = r * Math.cos(phi);

      sColors[i * 3] = pal.primary.r;
      sColors[i * 3 + 1] = pal.primary.g;
      sColors[i * 3 + 2] = pal.primary.b;

      this.shellMeta.push({
        baseR: r,
        phi,
        theta,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 3.0,
      });
    }
    this.shellGeo.setAttribute("position", new THREE.BufferAttribute(sPositions, 3));
    this.shellGeo.setAttribute("color", new THREE.BufferAttribute(sColors, 3));

    this.shellMat = new THREE.PointsMaterial({
      size: 0.22,
      map: photonTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shellMesh = new THREE.Points(this.shellGeo, this.shellMat);
    this.sphereGroup.add(this.shellMesh);

    // 3. Central Incandescent Core, Starburst Glint & Anamorphic Flare
    const coreMat = new THREE.SpriteMaterial({
      map: photonTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.98,
      depthWrite: false,
    });
    this.coreSprite = new THREE.Sprite(coreMat);
    this.coreSprite.scale.set(radius * 1.5, radius * 1.5, 1);
    this.group.add(this.coreSprite);

    const starMat = new THREE.SpriteMaterial({
      map: starGlintTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
      depthWrite: false,
    });
    this.starSprite = new THREE.Sprite(starMat);
    this.starSprite.scale.set(radius * 2.0, radius * 2.0, 1);
    this.group.add(this.starSprite);

    const flareMat = new THREE.SpriteMaterial({
      map: type === "cyan" ? flareCyanTex : flareGoldTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.45,
      depthWrite: false,
    });
    this.flareSprite = new THREE.Sprite(flareMat);
    this.flareSprite.scale.set(radius * 3.2, radius * 0.8, 1);
    this.group.add(this.flareSprite);

    const haloMat = new THREE.SpriteMaterial({
      map: type === "cyan" ? haloCyanTex : haloGoldTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.60,
      depthWrite: false,
    });
    this.haloSprite = new THREE.Sprite(haloMat);
    this.haloSprite.scale.set(radius * 3.0, radius * 3.0, 1);
    this.group.add(this.haloSprite);

    // 4. Flat Concentric Orbital Rings (Stationary facing camera)
    const ringRadii = [radius * 1.25, radius * 1.55, radius * 1.88];
    const ringOpacities = [0.28, 0.16, 0.08];
    this.ringMeshes = [];

    ringRadii.forEach((rRad, rIdx) => {
      const rPoints = [];
      const segs = 96;
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        rPoints.push(new THREE.Vector3(Math.cos(angle) * rRad, Math.sin(angle) * rRad, 0));
      }
      const rGeo = new THREE.BufferGeometry().setFromPoints(rPoints);
      const rMat = new THREE.LineBasicMaterial({
        color: pal.ringCol,
        transparent: true,
        opacity: ringOpacities[rIdx],
        depthWrite: false,
      });
      const rLine = new THREE.Line(rGeo, rMat);
      this.ringMeshes.push(rLine);
      this.ringsGroup.add(rLine);
    });

    this.smoothedPulse = 0.0;
  }

  update(time, targetPulse, isMobile, rotSpd = 1.0) {
    this.smoothedPulse += (targetPulse - this.smoothedPulse) * 0.14;
    const p = this.smoothedPulse;
    const pal = THEMES[this.type];

    // Inner sphere gentle rotation
    this.sphereGroup.rotation.y += 0.0014 * rotSpd * (this.type === "cyan" ? 1 : -1);
    this.sphereGroup.rotation.x = Math.sin(time * 0.8) * 0.04;

    // 1. Silky Multi-Harmonic Fluid Waves
    const wPos = this.waveGeo.attributes.position.array;
    const wCol = this.waveGeo.attributes.color.array;
    const waveSpeed = time * 0.7 * rotSpd;
    const count = this.waveMeta.length;

    for (let i = 0; i < count; i++) {
      const m = this.waveMeta[i];
      const fold1 = Math.sin(m.u * 3.0 + waveSpeed * 1.1) * Math.cos(m.v * 3.0 - waveSpeed * 0.8);
      const fold2 = Math.sin(m.u * 5.0 - waveSpeed * 1.4 + m.v * 3.5) * 0.45;
      const fold3 = Math.cos(m.v * 6.0 + waveSpeed * 0.7 + m.u * 2.0) * 0.3;
      const swirl = Math.sin(m.u * 2.0 + m.v * 4.0 + time * 0.5) * 0.18;
      const displacement = (fold1 + fold2 + fold3 + swirl) * (0.16 + p * 0.38);
      const r = m.baseR * (1.0 + displacement);

      const cosV = Math.cos(m.v);
      wPos[i * 3] = r * cosV * Math.cos(m.u);
      wPos[i * 3 + 1] = r * Math.sin(m.v);
      wPos[i * 3 + 2] = r * cosV * Math.sin(m.u);

      const crest = Math.max(0, displacement * 2.5);
      const c = pal.primary.clone().lerp(pal.highlight, Math.min(1.0, crest * 1.25));
      if (displacement < -0.04) c.lerp(pal.deep, 0.45);

      wCol[i * 3] = c.r;
      wCol[i * 3 + 1] = c.g;
      wCol[i * 3 + 2] = c.b;
    }
    this.waveGeo.attributes.position.needsUpdate = true;
    this.waveGeo.attributes.color.needsUpdate = true;

    // 2. Outer Crystalline Shell
    const sPos = this.shellGeo.attributes.position.array;
    const sCol = this.shellGeo.attributes.color.array;
    const sCount = this.shellMeta.length;

    for (let i = 0; i < sCount; i++) {
      const sm = this.shellMeta[i];
      const twinkle = Math.sin(time * sm.twinkleSpeed + sm.twinklePhase) * 0.3 + 0.7;
      const r = sm.baseR * (1.0 + p * 0.12 + Math.sin(time * 1.1) * 0.015);

      sPos[i * 3] = r * Math.sin(sm.phi) * Math.cos(sm.theta);
      sPos[i * 3 + 1] = r * Math.sin(sm.phi) * Math.sin(sm.theta);
      sPos[i * 3 + 2] = r * Math.cos(sm.phi);

      const normalZ = Math.cos(sm.phi);
      const fresnel = 1.0 - Math.abs(normalZ);
      const bright = Math.pow(fresnel, 1.8) * twinkle;
      const c = pal.primary.clone().lerp(pal.highlight, bright * 0.85);

      sCol[i * 3] = c.r * (0.4 + bright * 0.7);
      sCol[i * 3 + 1] = c.g * (0.4 + bright * 0.7);
      sCol[i * 3 + 2] = c.b * (0.4 + bright * 0.7);
    }
    this.shellGeo.attributes.position.needsUpdate = true;
    this.shellGeo.attributes.color.needsUpdate = true;

    // 3. Central Core, Starburst, Flare & Halo
    const coreScale = this.baseRadius * 1.5 * (1.0 + p * 0.35);
    this.coreSprite.scale.set(coreScale, coreScale, 1);

    const starScale = this.baseRadius * 2.0 * (1.0 + p * 0.38);
    this.starSprite.scale.set(starScale, starScale, 1);
    this.starSprite.material.opacity = 0.75 + p * 0.25;

    const flareW = this.baseRadius * 3.2 * (1.0 + p * 0.30);
    const flareH = this.baseRadius * 0.8 * (1.0 + p * 0.22);
    this.flareSprite.scale.set(flareW, flareH, 1);
    this.flareSprite.material.opacity = 0.40 + p * 0.30;

    const haloScale = this.baseRadius * 3.0 * (1.0 + p * 0.18 + Math.sin(time * 1.1) * 0.02);
    this.haloSprite.scale.set(haloScale, haloScale, 1);

    const ringMulti = 1.0 + p * 0.08;
    this.ringMeshes.forEach((rLine, rIdx) => {
      rLine.scale.setScalar(ringMulti);
      rLine.material.opacity = (rIdx === 0 ? 0.28 : rIdx === 1 ? 0.16 : 0.08) + p * 0.22;
    });
  }

  setMode(type) {
    if (this.type === type) return;
    this.type = type;
    const pal = THEMES[type];
    this.flareSprite.material.map = type === "cyan" ? flareCyanTex : flareGoldTex;
    this.haloSprite.material.map = type === "cyan" ? haloCyanTex : haloGoldTex;
    this.ringMeshes.forEach((rLine) => {
      rLine.material.color = new THREE.Color(pal.ringCol);
    });
  }
}

// Instantiate Dual Orbs
// Left Orb = Gold Patient (Calling In)
// Right Orb = Cyan Swastik AI (Answering)
const patientSystem = new FluidOrbEntity("gold", -6.5, 2.7);
const swastikSystem = new FluidOrbEntity("cyan", 6.2, 2.7);
scene.add(patientSystem.group);
scene.add(swastikSystem.group);

// ------------------------------------------------------------------
// Connecting Luminous Synaptic Neural Beam (Flowing between the Orbs)
// ------------------------------------------------------------------
const BRIDGE_COUNT = 360;
const bridgeGeo = new THREE.BufferGeometry();
const bridgePositions = new Float32Array(BRIDGE_COUNT * 3);
const bridgeColors = new Float32Array(BRIDGE_COUNT * 3);
const bridgeMeta = [];

for (let i = 0; i < BRIDGE_COUNT; i++) {
  const strandId = i % 3; // 3 intertwined helical strands
  bridgeMeta.push({
    progress: i / BRIDGE_COUNT,
    speed: 0.0028 + (i % 7) * 0.0008,
    strandId,
    phaseOffset: strandId * ((Math.PI * 2) / 3) + (i % 5) * 0.15,
    helixRadius: 0.26 + (i % 4) * 0.12,
    yJitter: (Math.random() - 0.5) * 0.22,
    zJitter: (Math.random() - 0.5) * 0.22,
  });
  bridgePositions[i * 3] = 0;
  bridgePositions[i * 3 + 1] = 0;
  bridgePositions[i * 3 + 2] = 0;
  bridgeColors[i * 3] = 1;
  bridgeColors[i * 3 + 1] = 1;
  bridgeColors[i * 3 + 2] = 1;
}
bridgeGeo.setAttribute("position", new THREE.BufferAttribute(bridgePositions, 3));
bridgeGeo.setAttribute("color", new THREE.BufferAttribute(bridgeColors, 3));

const bridgeMat = new THREE.PointsMaterial({
  size: 0.28,
  map: photonTex,
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const bridgePoints = new THREE.Points(bridgeGeo, bridgeMat);
scene.add(bridgePoints);

// ------------------------------------------------------------------
// 3D Ambient Cosmic Starfield
// ------------------------------------------------------------------
const STAR_COUNT = 150;
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 50;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 35;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  size: 0.12,
  map: photonTex,
  color: 0x94A3B8,
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.45,
  depthWrite: false,
});
const starPoints = new THREE.Points(starGeo, starMat);
scene.add(starPoints);

// ------------------------------------------------------------------
// 3D Shockwaves & Celebration Burst
// ------------------------------------------------------------------
let activeShockwaves = [];
function triggerShockwave(targetOrb) {
  const isPatient = targetOrb === leftOrb;
  const targetGroup = isPatient ? patientSystem.group : swastikSystem.group;
  const color = isPatient ? 0xFF9E00 : 0x00E5FF;

  const ringGeo = new THREE.RingGeometry(2.35, 2.48, 64);
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
    const speed = 0.25 + Math.random() * 0.65;

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
    bColors[i * 3] = isCyan ? 0.0 : 1.0;
    bColors[i * 3 + 1] = isCyan ? 0.9 : 0.65;
    bColors[i * 3 + 2] = isCyan ? 1.0 : 0.0;
  }

  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPositions, 3));
  bGeo.setAttribute("color", new THREE.BufferAttribute(bColors, 3));

  const bMat = new THREE.PointsMaterial({
    size: 0.22,
    map: photonTex,
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
// Interactive 3D Orbit Drag & Parallax Physics
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
window.addEventListener("pointercancel", () => {
  isDragging = false;
});

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
    leftTargetPos.set(0, visibleHeight * 0.18, 0);
    rightTargetPos.set(0, -visibleHeight * 0.14, 0);
    patientSystem._baseGroupScale = 0.75;
    swastikSystem._baseGroupScale = 0.75;
  } else if (isTablet) {
    leftTargetPos.set(-visibleWidth * 0.24, 0, 0);
    rightTargetPos.set(visibleWidth * 0.22, 0, 0);
    patientSystem._baseGroupScale = 0.88;
    swastikSystem._baseGroupScale = 0.88;
  } else {
    leftTargetPos.set(-visibleWidth * 0.24, 0, 0);
    rightTargetPos.set(visibleWidth * 0.22, 0, 0);
    patientSystem._baseGroupScale = 1.0;
    swastikSystem._baseGroupScale = 1.0;
  }
}
window.addEventListener("resize", resize);

// ------------------------------------------------------------------
// Card 3D Tilt Engine (CardContainer + CardItem)
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

  // Inspira UI Border Beam Dynamic Rotation
  const beamAngle = (time * 0.08) % 360;
  document.documentElement.style.setProperty("--beam-angle", `${beamAngle.toFixed(1)}deg`);

  // Simulated Conversation Loop when idle / not on a live call
  let simAgentPulse = 0;
  let simPatientPulse = 0;

  if (!isCallActive && simActive) {
    simTimer += delta * 1000;
    const curSim = SIM_CONVERSATION[simIdx];

    if (curSim) {
      if (curSim.speaker === "swastik") {
        simAgentPulse = curSim.pulseAgent + Math.sin(time * 0.004) * 0.12 + Math.cos(time * 0.009) * 0.08;
        simPatientPulse = 0.02;
      } else {
        simPatientPulse = curSim.pulsePatient + Math.cos(time * 0.0045) * 0.14 + Math.sin(time * 0.008) * 0.09;
        simAgentPulse = 0.02;
      }

      if (simTimer > curSim.duration) {
        simTimer = 0;
        simIdx = (simIdx + 1) % SIM_CONVERSATION.length;
        const nextSim = SIM_CONVERSATION[simIdx];
        setStage(nextSim.stage);
        setSubtitles(nextSim.speaker, nextSim.hindi);

        if (nextSim.showCalendar && calendarCard && !calendarCard.classList.contains("dismissed")) {
          calendarCard.classList.add("visible");
        }
        if (nextSim.showBooking) {
          const slot1100 = $("slot-1100");
          if (slot1100) {
            slot1100.className = "slot-row booked";
            slot1100.innerHTML = `<span>11:00 · CONSULTATION</span><span class="badge-booked">BOOKED</span>`;
          }
          triggerBookingBurst();
        }
        if (nextSim.showWhatsApp && waCard && !waCard.classList.contains("dismissed")) {
          waCard.classList.add("visible");
        }
      }
    }
  }

  // Audio Pulses (Real Live Audio if active, otherwise Simulated Audio)
  let userPulse = isCallActive ? Math.min(1.2, userRMS * 8.5) : simPatientPulse;
  let realAgentLevel = getAgentAudioLevel();
  let agentPulse = isCallActive
    ? (speaking ? Math.min(1.2, Math.max(realAgentLevel * 2.4, 0.48 + Math.sin(time * 0.014) * 0.28)) : 0)
    : simAgentPulse;

  // Dynamic Speech-Reactive Orb Sizing:
  // When Patient speaks: Patient orb expands smoothly up to 1.45x
  // When Swastik speaks: Swastik orb expands smoothly up to 1.48x
  const pBaseScale = patientSystem._baseGroupScale || 1.0;
  const sBaseScale = swastikSystem._baseGroupScale || 1.0;

  let pTargetScale = pBaseScale;
  let sTargetScale = sBaseScale;

  if (userPulse > 0.05) {
    pTargetScale = pBaseScale * (1.0 + userPulse * 0.28);
    sTargetScale = sBaseScale * Math.max(0.92, 1.0 - userPulse * 0.06);
  } else if (agentPulse > 0.05) {
    sTargetScale = sBaseScale * (1.0 + agentPulse * 0.30);
    pTargetScale = pBaseScale * Math.max(0.92, 1.0 - agentPulse * 0.06);
  } else {
    // Ambient breathing
    pTargetScale = pBaseScale * (1.0 + Math.sin(time * 0.002) * 0.02);
    sTargetScale = sBaseScale * (1.0 + Math.sin(time * 0.002 + 1.5) * 0.02);
  }

  const pCurScale = patientSystem.group.scale.x;
  const sCurScale = swastikSystem.group.scale.x;
  patientSystem.group.scale.setScalar(pCurScale + (pTargetScale - pCurScale) * 0.12);
  swastikSystem.group.scale.setScalar(sCurScale + (sTargetScale - sCurScale) * 0.12);

  // Update Fluid Wave Orbs
  patientSystem.update(time * 0.001, userPulse, isMobile, 0.9);
  swastikSystem.update(time * 0.001, agentPulse, isMobile, 0.9);

  // Harmonic Floating Motion (Natural Levitation)
  const floatPatientX = Math.sin(time * 0.0009) * 0.15;
  const floatPatientY = Math.cos(time * 0.0012) * 0.25;
  const floatSwastikX = -Math.cos(time * 0.0010) * 0.15;
  const floatSwastikY = Math.sin(time * 0.0013) * 0.25;

  patientSystem.group.position.set(
    leftTargetPos.x + floatPatientX,
    leftTargetPos.y + floatPatientY,
    leftTargetPos.z
  );
  swastikSystem.group.position.set(
    rightTargetPos.x + floatSwastikX,
    rightTargetPos.y + floatSwastikY,
    rightTargetPos.z
  );

  // Update Connecting Luminous Synaptic Neural Beam
  const p1 = patientSystem.group.position;
  const p2 = swastikSystem.group.position;
  const bPos = bridgeGeo.attributes.position.array;
  const bCol = bridgeGeo.attributes.color.array;

  const flowDir = agentPulse > userPulse ? -1.0 : 1.0;
  const bridgeSpeed = (userPulse > 0.05 || agentPulse > 0.05) ? 3.0 : 1.2;
  const waveTime = time * 0.0035;

  for (let i = 0; i < BRIDGE_COUNT; i++) {
    const pt = bridgeMeta[i];
    pt.progress += pt.speed * bridgeSpeed * flowDir;
    if (pt.progress > 1.0) pt.progress -= 1.0;
    if (pt.progress < 0.0) pt.progress += 1.0;

    const t = pt.progress;
    const taper = Math.sin(t * Math.PI);

    // Helical vortex wave motion
    const angle = t * Math.PI * 4 + waveTime * 4.0 + pt.phaseOffset;
    const helixY = Math.sin(angle) * pt.helixRadius * taper;
    const helixZ = Math.cos(angle) * pt.helixRadius * taper;
    const archY = Math.sin(t * Math.PI) * 0.45;

    const baseX = p1.x + (p2.x - p1.x) * t;
    const baseY = p1.y + (p2.y - p1.y) * t + archY + helixY + pt.yJitter * taper;
    const baseZ = p1.z + (p2.z - p1.z) * t + helixZ + pt.zJitter * taper;

    bPos[i * 3] = baseX;
    bPos[i * 3 + 1] = baseY;
    bPos[i * 3 + 2] = baseZ;

    // Luminous Energy Wave: traveling quantum brightness packets
    const packet = Math.pow(Math.max(0, Math.sin((t * 2.5 - waveTime * 2.2) * Math.PI * 2)), 5) * 1.6;
    const voiceIntensity = 1.0 + Math.max(userPulse, agentPulse) * 1.5 + packet;

    // Dynamic Color Gradient: Gold (t=0) -> Emerald (t=0.5) -> Electric Cyan (t=1)
    let cr, cg, cb;
    if (t < 0.5) {
      const u = t * 2.0;
      cr = THREE.MathUtils.lerp(1.0, 0.08, u);
      cg = THREE.MathUtils.lerp(0.68, 0.88, u);
      cb = THREE.MathUtils.lerp(0.08, 0.75, u);
    } else {
      const u = (t - 0.5) * 2.0;
      cr = THREE.MathUtils.lerp(0.08, 0.0, u);
      cg = THREE.MathUtils.lerp(0.88, 0.92, u);
      cb = THREE.MathUtils.lerp(0.75, 1.0, u);
    }

    const lum = Math.min(2.4, (0.4 + taper * 0.8) * voiceIntensity);
    bCol[i * 3] = Math.min(1.0, cr * lum);
    bCol[i * 3 + 1] = Math.min(1.0, cg * lum);
    bCol[i * 3 + 2] = Math.min(1.0, cb * lum);
  }
  bridgeGeo.attributes.position.needsUpdate = true;
  bridgeGeo.attributes.color.needsUpdate = true;

  // Update Shockwaves
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

  // Update Celebration Burst
  if (burstMesh) {
    let anyAlive = false;
    const bArray = burstMesh.geometry.attributes.position.array;
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
      bArray[idx] = b.x;
      bArray[idx + 1] = b.y;
      bArray[idx + 2] = b.z;
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

  // 3D Parallax Camera Motion & Drag Inertia
  currentMouseX += (targetMouseX - currentMouseX) * 0.05;
  currentMouseY += (targetMouseY - currentMouseY) * 0.05;
  camera.position.x = currentMouseX * 1.5;
  camera.position.y = -currentMouseY * 1.0;
  camera.lookAt(0, 0, 0);

  if (!isDragging) {
    rotTargetX += dragVelX;
    rotTargetY += dragVelY;
    dragVelX *= 0.92;
    dragVelY *= 0.92;
    rotTargetX *= 0.985;
    rotTargetY *= 0.985;
  }
  rotCurrentX += (rotTargetX - rotCurrentX) * 0.08;
  rotCurrentY += (rotTargetY - rotCurrentY) * 0.08;
  scene.rotation.x = rotCurrentX;
  scene.rotation.y = rotCurrentY;

  // Render 3D Scene
  renderer.render(scene, camera);

  // Screen Space Projections for HUD Overlays & Labels
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
    badgeContainer.style.top = `${leftScreenY - (isMobile ? 120 : 155)}px`;
  }

  const orbLabels = document.querySelector(".orb-labels-container");
  if (orbLabels && !isMobile) {
    const pBlock = orbLabels.querySelector(".patient");
    const sBlock = orbLabels.querySelector(".swastik");
    if (pBlock) {
      pBlock.style.position = "absolute";
      pBlock.style.left = `${leftScreenX}px`;
      pBlock.style.top = `${leftScreenY + 140}px`;
      pBlock.style.transform = "translateX(-50%)";
      pBlock.style.margin = "0";
    }
    if (sBlock) {
      sBlock.style.position = "absolute";
      sBlock.style.left = `${rightScreenX}px`;
      sBlock.style.top = `${rightScreenY + 140}px`;
      sBlock.style.transform = "translateX(-50%)";
      sBlock.style.margin = "0";
    }
  }

  // Mini Equalizer Bars
  if (waveBars && waveBars.length) {
    const activeLevel = Math.max(userPulse, agentPulse);
    waveBars.forEach((bar, idx) => {
      const h = Math.max(
        3,
        Math.min(14, 3 + activeLevel * 10 * Math.sin(time * 0.01 + idx))
      );
      bar.style.height = `${h}px`;
      bar.style.background = agentPulse > userPulse ? "#00E5FF" : "#FF9E00";
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
    if (calendarCard) {
      calendarCard.classList.remove("dismissed");
      calendarCard.classList.add("visible");
    }
    if (cmd.slots && slotsContainer) updateSlotsUI(cmd.slots);
  } else if (cmd.action === "booking_confirmed") {
    setStage("WRITTEN TO THE CALENDAR");
    if (calendarCard) {
      calendarCard.classList.remove("dismissed");
      calendarCard.classList.add("visible");
    }

    const mode = (cmd.data && cmd.data.consultation_mode) ? cmd.data.consultation_mode.toUpperCase() : "ONLINE";
    if (cmd.slots && slotsContainer) updateSlotsUI(cmd.slots);

    const slot1100 = $("slot-1100");
    if (slot1100) {
      slot1100.className = "slot-row booked";
      slot1100.innerHTML = `<span>11:00 · ${mode}</span><span class="badge-booked">BOOKED</span>`;
    }
    triggerBookingBurst();
  } else if (cmd.action === "whatsapp_send" && cmd.data) {
    setStage("CONFIRMATION ON WHATSAPP");
    if (waCard) {
      waCard.classList.remove("dismissed");
      waCard.classList.add("visible");
    }
    const name = cmd.data.patient_name || "Patient";
    const slot = cmd.data.slot_time || "11:00 AM";
    const cat = cmd.data.category || "Consultation";
    const mode = cmd.data.consultation_mode || "Online";
    if (waText) {
      waText.textContent = `${name} — your ${mode} appointment for ${cat} with Dr. Sharma is confirmed for tomorrow at ${slot}. Consultation fee ₹499.`;
    }
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
// Connection Chime (Web Audio Synthesizer)
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
    // Decorative chime
  }
}

// ----------------------------------------------------
// Voice Playback (24kHz PCM from Gemini Live)
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

  // Send a copy to the AEC worklet as the far-end reference signal
  if (aecNode) {
    aecNode.port.postMessage({ reference: new Float32Array(f32) });
  }

  const src = audioCtx.createBufferSource();
  src.buffer = ab;
  src.connect(voiceGain);

  const now = audioCtx.currentTime;
  if (nextStart < now) {
    nextStart = now + 0.035;
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
    
    if (telemetryInterval) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
    }
  }
}

// ----------------------------------------------------
// WebSocket Live Connection & Mic AudioWorklet
// ----------------------------------------------------
function connect(clinicId = null) {
  const activeClinicId = clinicId || window.CLINIC_ID || "dr-sharma";
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/${activeClinicId}`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    if (connLabel) connLabel.textContent = "CONNECTED";
    if (statusDot) statusDot.style.background = "#10B981";
    setStage("WHY THEY CALLED");
    playConnectionChime();
  };

  ws.onclose = () => {
    if (connLabel) connLabel.textContent = "DISCONNECTED";
    if (statusDot) statusDot.style.background = "#EF4444";
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
  if (stream) return;
  try {
    // 3B. WSS Enforcement + Consent
    console.log("%c🔒 PRIVACY NOTICE: This call is processed by AI. Your voice is used only for this conversation and not stored.", "color: #10B981; font-weight: bold; font-size: 12px;");

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    
    const source = audioCtx.createMediaStreamSource(stream);

    // 3D. AudioWorklet Fallback
    if (!audioCtx.audioWorklet) {
      console.warn("AudioWorklet not supported! Falling back to ScriptProcessorNode (degraded performance).");
      // Basic fallback implementation for older browsers
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const outLen = Math.floor(inputData.length / 3);
        const pcm16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i * 3]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(pcm16.buffer);
      };
      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);
      return;
    }

    // Register all audio worklet processors
    await audioCtx.audioWorklet.addModule("/pcm-processor.js");
    await audioCtx.audioWorklet.addModule("/noise-suppressor-worklet.js");
    await audioCtx.audioWorklet.addModule("/aec-processor.js");
    await audioCtx.audioWorklet.addModule("/agc-processor.js");
    await audioCtx.audioWorklet.addModule("/speaker-mask-processor.js");

    voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
    voiceGain.connect(audioCtx.destination);

  // ── Enhanced DSP Speech Filter Chain ──────────────────────────
  //
  // Pipeline: Mic → AEC → Spectral NS → Speaker Mask → HP(80Hz) → Notch(50Hz) → LP(7600Hz) → Compressor → AGC → PCM Resampler → WebSocket

  // 0. AEC (Acoustic Echo Cancellation)
  aecNode = new AudioWorkletNode(audioCtx, "aec-processor");

  // 1. Spectral Noise Suppressor (pure-JS FFT-based spectral subtraction)
  noiseSuppressorNode = new AudioWorkletNode(audioCtx, "noise-suppressor-processor");

  // 1.5 Speaker Mask Processor (Target speaker isolation)
  speakerMaskNode = new AudioWorkletNode(audioCtx, "speaker-mask-processor");

  // Forward VAD probability from noise suppressor to PCM processor
  noiseSuppressorNode.port.onmessage = (e) => {
    if (e.data && e.data.vadProbability !== undefined) {
      currentVADProbability = e.data.vadProbability;
    }
  };

  // Log speaker enrollment events
  speakerMaskNode.port.onmessage = (e) => {
    if (e.data.type === "enrollment_complete") {
      console.log("%c🎯 Speaker Enrollment Complete", "color: #3B82F6; font-weight: bold; font-size: 14px;");
      if (statusDot) statusDot.style.background = "#3B82F6"; // Blue when enrolled
    }
  };

  // 2. Highpass: Cut low-frequency fan rumble, room vibrations, breathing pops (<80Hz)
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(80, audioCtx.currentTime);
  highpass.Q.setValueAtTime(0.7, audioCtx.currentTime);

  // 3. Notch at 50Hz: Kill India's 50Hz mains hum from cheap laptop/phone mics
  const notch50 = audioCtx.createBiquadFilter();
  notch50.type = "notch";
  notch50.frequency.setValueAtTime(50, audioCtx.currentTime);
  notch50.Q.setValueAtTime(10, audioCtx.currentTime); // Narrow notch

  // 4. Lowpass: Widened to 7600Hz (was 4000Hz) — sibilants (s, sh, f, th) live at
  //    4–8kHz and are critical for STT accuracy on Hindi/English fricatives
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(7600, audioCtx.currentTime);
  lowpass.Q.setValueAtTime(0.7, audioCtx.currentTime);

  // 5. Compressor: Keeps speech dynamic range balanced and squelches noise floor
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-45, audioCtx.currentTime);
  compressor.knee.setValueAtTime(10, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
  compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

  // 6. AGC: Target Loudness Normalization
  agcNode = new AudioWorkletNode(audioCtx, "agc-processor");

  // Forward VAD probability from noise suppressor to PCM processor
  noiseSuppressorNode.port.onmessage = (e) => {
    if (e.data && e.data.vadProbability !== undefined) {
      currentVADProbability = e.data.vadProbability;
    }
  };

  // Wire the filter chain
  source.connect(aecNode);
  aecNode.connect(noiseSuppressorNode);
  noiseSuppressorNode.connect(speakerMaskNode);
  speakerMaskNode.connect(highpass);
  highpass.connect(notch50);
  notch50.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(agcNode);

  // 7. PCM Resampler Worklet (16kHz mono, adaptive noise gate)
  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");

  workletNode.port.onmessage = (e) => {
    userRMS = e.data.rms || 0;
    currentSNR = e.data.snr || 0;
    currentNoiseFloor = e.data.noiseFloor || 0;
    const vadProb = e.data.vadProbability || 0;
    currentVADProbability = vadProb;

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Graceful Degradation UX (SNR Alert)
    if (currentSNR > 0 && currentSNR < 1.5) {
      lowSNRFrameCount++;
      // 3 seconds at 50ms per frame = 60 frames
      if (lowSNRFrameCount > 60) {
        ws.send(JSON.stringify({ type: "noise_alert", snr: currentSNR }));
        lowSNRFrameCount = 0; // Reset after sending to avoid spamming
      }
    } else {
      lowSNRFrameCount = 0;
    }

    if (speaking) {
      // ── Reference-Based AEC Barge-in ──
      if (userRMS >= BARGE_THRESHOLD) {
        speechFrameCount++;
        if (speechFrameCount >= 2) {
          stopVoice();
          speechFrameCount = 0;
          
          // Phase 3C: Jitter Buffer push
          jitterBuffer.push(e.data.pcm);
          if (jitterBuffer.length >= JITTER_BUFFER_SIZE) {
            flushJitterBuffer();
          }
        }
      } else {
        speechFrameCount = Math.max(0, speechFrameCount - 1);
      }
    } else {
      speechFrameCount = 0;
      // Phase 3C: Jitter Buffer push
      jitterBuffer.push(e.data.pcm);
      if (jitterBuffer.length >= JITTER_BUFFER_SIZE) {
        flushJitterBuffer();
      }
    }
  };

  // Phase 3C: Jitter Buffer flush helper
  function flushJitterBuffer() {
    if (jitterBuffer.length === 0) return;
    let totalLength = 0;
    for (let buf of jitterBuffer) totalLength += buf.length;
    
    const combined = new Int16Array(totalLength);
    let offset = 0;
    for (let buf of jitterBuffer) {
      combined.set(new Int16Array(buf), offset);
      offset += buf.length;
    }
    
    ws.send(combined.buffer);
    jitterBuffer = [];
  }

  // Phase 3A: Mandatory Telemetry reporting loop
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "audio_telemetry",
        snr: currentSNR,
        vadProb: currentVADProbability,
        noiseFloor: currentNoiseFloor,
        erle: 12.5 // Hardcoded approximate ERLE for now since it's computed internally in AEC
      }));
    }
  }, 2000); // Report every 2 seconds

  agcNode.connect(workletNode);

  silentSink = audioCtx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(audioCtx.destination);
  workletNode.connect(silentSink);

  console.log(
    "%c🔇 Swastik AI Noise Cancellation Active",
    "color: #14c8b2; font-weight: bold; font-size: 14px;",
    "\nPipeline: Mic → AEC → Spectral NS → Speaker Mask → HP(80Hz) → Notch(50Hz) → LP(7600Hz) → Compressor → AGC → PCM(16kHz) → WS"
  );
  } catch (err) {
    console.error("Microphone initialization failed:", err);
  }
}

function stopCall() {
  isCallActive = false;
  thinkingMode = false;
  lastUserSpeechTime = 0;
  if (callBtn) {
    callBtn.classList.remove("in-call");
    if (callBtnIcon) callBtnIcon.textContent = "🎙";
    if (callBtnText) callBtnText.textContent = "Start Call";
  }
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

  // Resume gentle simulation after call ends
  simActive = true;
  simTimer = 0;
}

async function startCall() {
  simActive = false; // Pause simulation on live call

  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    alert("Microphone access requires a secure connection (HTTPS). Please open this site over HTTPS.");
    return;
  }

  if (callBtn) {
    callBtn.classList.add("in-call");
    if (callBtnIcon) callBtnIcon.textContent = "⏳";
    if (callBtnText) callBtnText.textContent = "Connecting...";
  }

  try {
    await startMic();
    connect();
    isCallActive = true;
    if (callBtnIcon) callBtnIcon.textContent = "⏹";
    if (callBtnText) callBtnText.textContent = "End Call";
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

if (callBtn) {
  callBtn.addEventListener("click", () => {
    if (isCallActive) {
      stopCall();
    } else {
      startCall();
    }
  });
}

// Card Close (Dismiss) Button Listeners
const closeCalCardBtn = $("closeCalCardBtn");
const closeWaCardBtn = $("closeWaCardBtn");

if (closeCalCardBtn && calendarCard) {
  closeCalCardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    calendarCard.classList.remove("visible");
    calendarCard.classList.add("dismissed");
  });
}

if (closeWaCardBtn && waCard) {
  closeWaCardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    waCard.classList.remove("visible");
    waCard.classList.add("dismissed");
  });
}

// Initial subtitle and stage setup
setStage(SIM_CONVERSATION[0].stage);
setSubtitles("swastik", SIM_CONVERSATION[0].hindi);

// Initialize canvas and launch motion render loop
resize();
requestAnimationFrame(animate);
