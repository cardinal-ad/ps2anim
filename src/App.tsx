import { useEffect, useState, useRef, useCallback } from 'react';
import { Canvas, useFrame, extend, ThreeEvent } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// Gaussian random function
function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

// Custom shader material
const CubeMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0x006FEE),
    index: 0,
    randomValue: 0,
    isHovered: 0.0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform float time;
    uniform float index;
    uniform float isHovered;
    
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      vec3 pos = position;
      pos.x += sin(time * 2.0 + index * 0.5) * 0.02;
      
      // Add slight scale effect when hovered
      pos *= 1.0 + isHovered * 0.15;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment shader with improved foggy glow
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform vec3 color;
    uniform float time;
    uniform float index;
    uniform float randomValue;
    uniform float isHovered;

    vec3 customPalette(float t) {
      const vec3 c0 = vec3(0.35, 0.0, 0.0);
      const vec3 c1 = vec3(0.5, 0.0, 0.1);
      const vec3 c2 = vec3(0.7, 0.1, 0.2);
      const vec3 c3 = vec3(0.9, 0.2, 0.1);
      const vec3 c4 = vec3(1.0, 0.4, 0.1);
      const vec3 c5 = vec3(1.0, 0.6, 0.2);
      
      float t0 = smoothstep(0.0, 0.2, t);
      float t1 = smoothstep(0.2, 0.4, t);
      float t2 = smoothstep(0.4, 0.6, t);
      float t3 = smoothstep(0.6, 0.8, t);
      float t4 = smoothstep(0.8, 1.0, t);
      
      vec3 color = mix(c0, c1, t0);
      color = mix(color, c2, t1);
      color = mix(color, c3, t2);
      color = mix(color, c4, t3);
      color = mix(color, c5, t4);
      
      return color;
    }

    // Improved fog function
    float fogFactor(float dist, float density) {
      float fogAmount = 1.0 - exp(-dist * density);
      return clamp(fogAmount, 0.0, 1.0);
    }

    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
      
      float t = mod(randomValue + time * 0.1, 1.0);
      vec3 baseColor = customPalette(t);
      
      // Enhanced rim light effect
      float rim = pow(1.0 - dot(viewDirection, vNormal), 3.0) * 0.5;
      
      vec3 finalColor = baseColor;
      finalColor += rim * vec3(0.3, 0.1, 0.1);
      finalColor *= 0.8 + 0.2 * sin(time * 2.0 + index * 0.5);
      
      // Foggy glow effect when hovered
      if (isHovered > 0.0) {
        // Create pulsating fog density
        float fogDensity = 2.0 + sin(time * 3.0) * 0.5;
        float dist = length(vPosition);
        float fog = fogFactor(dist, fogDensity);
        
        // Create warm, glowing fog color
        vec3 fogColor = vec3(1.0, 0.3, 0.1);
        vec3 glowColor = mix(
          finalColor,
          fogColor,
          fog * isHovered * (0.8 + 0.2 * sin(time * 4.0))
        );
        
        // Add pulsating emission
        float emission = 0.4 + 0.2 * sin(time * 5.0);
        finalColor = mix(finalColor, glowColor, isHovered);
        finalColor += fogColor * emission * isHovered;
        
        // Add fresnel-based edge glow
        float edgeGlow = pow(1.0 - dot(viewDirection, vNormal), 4.0);
        finalColor += fogColor * edgeGlow * isHovered;
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ CubeMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      cubeMaterial: any;
    }
  }
}

function Cube({ position, color, index, randomValue }: {
  position: [number, number, number];
  color: THREE.Color;
  index: number;
  randomValue: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.time = state.clock.elapsedTime;
      materialRef.current.color = color;
      materialRef.current.index = index;
      materialRef.current.randomValue = randomValue;
      materialRef.current.isHovered = hovered ? 1.0 : 0.0;
    }
  });

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <mesh 
      ref={meshRef} 
      position={position} 
      castShadow 
      receiveShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <cubeMaterial ref={materialRef} />
    </mesh>
  );
}

function Tower({ position, delay, height, randomValue }: {
  position: [number, number, number];
  delay: number;
  height: number;
  randomValue: number;
}) {
  const [cubes, setCubes] = useState<JSX.Element[]>([]);
  const [visible, setVisible] = useState(true);
  const startTime = useRef(Date.now());
  const numCubes = Math.floor(height * 8);

  useEffect(() => {
    const cubeElements = [];
    for (let i = 0; i < numCubes; i++) {
      const cubeRandomValue = gaussianRandom(0.5, 0.2);
      cubeElements.push(
        <Cube
          key={i}
          position={[position[0], position[1] + (i * 0.5), position[2]]}
          color={new THREE.Color(0x006FEE)}
          index={i}
          randomValue={cubeRandomValue}
        />
      );
    }
    setCubes(cubeElements);

    const interval = setInterval(() => {
      if (Math.random() < 0.1) {
        setVisible(prev => !prev);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [position, height, randomValue]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsedTime = (Date.now() - startTime.current) / 1000 - delay;
    if (elapsedTime < 0 || !visible) {
      groupRef.current.scale.y = 0;
      return;
    }

    if (elapsedTime > 1.5) {
      groupRef.current.scale.y = 1;
      return;
    }

    const progress = Math.min(elapsedTime / 1.5, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    groupRef.current.scale.y = easeOutQuart;
  });

  return <group ref={groupRef}>{cubes}</group>;
}

function Towers() {
  const groupRef = useRef<THREE.Group>(null);
  const towers = [];
  const size = 12;
  const spacing = 0.8;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const posX = (x - size / 2 + 0.5) * spacing;
      const posZ = (z - size / 2 + 0.5) * spacing;
      const delay = (x + z) * 0.08;
      
      const centerX = size / 2 - 0.5;
      const centerZ = size / 2 - 0.5;
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2)
      );
      const maxDistance = Math.sqrt(2) * size / 2;
      
      const baseHeight = 2.5;
      const heightVariation = 1.5;
      const normalizedDistance = distanceFromCenter / maxDistance;
      const height = baseHeight - (heightVariation * normalizedDistance) + (gaussianRandom(0, 0.3));
      
      const randomValue = gaussianRandom(0.5, 0.2);
      
      towers.push(
        <Tower
          key={`${x}-${z}`}
          position={[posX, -2, posZ]}
          delay={delay}
          height={Math.max(0.5, height)}
          randomValue={randomValue}
        />
      );
    }
  }

  return <group ref={groupRef}>{towers}</group>;
}

function PS2Text() {
  const [visible, setVisible] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      <Center position={[0, 0, 0]}>
        <Text3D
          font="/fonts/helvetiker_regular.typeface.json"
          size={0.8}
          height={0.2}
          curveSegments={12}
        >
          {`PS2`}
          <meshStandardMaterial color="#660000" />
        </Text3D>
      </Center>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <Towers />
      <PS2Text />
    </>
  );
}

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleFullscreen]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#330000]">
      <Canvas camera={{ position: [12, 12, 12], fov: 45 }}>
        <Scene />
      </Canvas>
      <div className="fixed bottom-4 right-4 text-white text-sm opacity-50">
        Press F for fullscreen
      </div>
    </div>
  );
}