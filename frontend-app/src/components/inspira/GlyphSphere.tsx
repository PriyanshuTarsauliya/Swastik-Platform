import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '../../lib/utils';

export interface GlyphSphereProps {
  className?: string;
  size?: number;
  glyphCount?: number;
  color?: string;
  rotationSpeed?: number;
}

export default function GlyphSphere({
  className = '',
  size = 240,
  glyphCount = 8000,
  color = '#ffffff',
  rotationSpeed = 0.5,
}: GlyphSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    
    // Orthographic or Perspective? A perspective camera looking at the origin
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 250;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // Keep it exactly to the requested size
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(size, size);
    renderer.setPixelRatio(dpr);
    mountRef.current.appendChild(renderer.domElement);

    // --- Texture Generation ---
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, 1024, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
      for(let i = 0; i < 32; i++) {
        ctx.fillText(chars[i], i * 32 + 16, 16);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // --- Geometry ---
    const positions = new Float32Array(glyphCount * 3);
    const charIndices = new Float32Array(glyphCount);
    const phases = new Float32Array(glyphCount);
    const sizeBases = new Float32Array(glyphCount);

    const maxR = 100;
    const minR = maxR * 0.316; // Core radius constraint

    for (let i = 0; i < glyphCount; i++) {
      // Uniform random in spherical shell
      const u = Math.random();
      const r = Math.cbrt(u * (Math.pow(maxR, 3) - Math.pow(minR, 3)) + Math.pow(minR, 3));
      
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      charIndices[i] = Math.floor(Math.random() * 32);
      phases[i] = Math.random();
      
      // Random size variation
      sizeBases[i] = 10 + Math.random() * 6; // 10 to 16
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('charIndex', new THREE.BufferAttribute(charIndices, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('sizeBase', new THREE.BufferAttribute(sizeBases, 1));

    // Convert hex to normalized RGB
    const c = new THREE.Color(color);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) }
      },
      vertexShader: `
        attribute float charIndex;
        attribute float phase;
        attribute float sizeBase;
        
        varying float vCharIndex;
        varying float vPhase;
        
        void main() {
          vCharIndex = charIndex;
          vPhase = phase;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = sizeBase * (250.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform vec3 uColor;
        
        varying float vCharIndex;
        varying float vPhase;
        
        void main() {
          // Flicker math based on phase and time
          float flicker = sin(uTime * 4.0 + vPhase * 100.0) * 0.5 + 0.5;
          flicker = pow(flicker, 2.0); // Sharpen flicker
          
          float intensity = mix(0.2, 1.0, flicker);
          
          float uOffset = floor(vCharIndex);
          // Map point coordinate [0,1] into the 32-column sprite sheet
          vec2 uv = vec2((gl_PointCoord.x + uOffset) / 32.0, 1.0 - gl_PointCoord.y);
          
          vec4 texColor = texture2D(uTexture, uv);
          
          if(texColor.a < 0.1) discard;
          
          // Additive blend output
          gl_FragColor = vec4(uColor * intensity, texColor.a * intensity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sphere = new THREE.Points(geometry, material);
    scene.add(sphere);

    // --- Animation Loop ---
    let animationFrameId: number;
    const start = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      
      material.uniforms.uTime.value = elapsed;
      sphere.rotation.y = elapsed * rotationSpeed;
      sphere.rotation.x = elapsed * (rotationSpeed * 0.3); // slight tumble
      
      renderer.render(scene, camera);
    };

    animate();

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [size, glyphCount, color, rotationSpeed]);

  return (
    <div
      data-slot="glyph-sphere"
      className={cn('relative overflow-hidden rounded-full flex items-center justify-center', className)}
      style={{
        width: size,
        height: size,
      }}
      ref={mountRef}
    />
  );
}
