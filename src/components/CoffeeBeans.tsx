import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

const SLOPE_ANGLE = 0.2;
const SPACING = 15;
const VISIBLE_COUNT = 20;

const QuarterEgg = () => (
  <group>
    {/* Dome covering +X, +Z quadrant, facing outwards */}
    <mesh castShadow>
      <sphereGeometry args={[0.5, 32, 32, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
    </mesh>
    {/* YZ plane flat face covering +Z, facing -X */}
    <mesh castShadow rotation={[0, -Math.PI / 2, 0]}>
      <circleGeometry args={[0.5, 32, -Math.PI / 2, Math.PI]} />
      <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
    </mesh>
    {/* XY plane flat face covering +X, facing -Z */}
    <mesh castShadow rotation={[0, Math.PI, 0]}>
      <circleGeometry args={[0.5, 32, Math.PI / 2, Math.PI]} />
      <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
    </mesh>
  </group>
);

// Individual bean component to handle its own rotation and collection state
const Bean = ({ index }: { index: number }) => {
  const meshRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const bodyRef = useRef<RapierRigidBody>(null);
  
  const [collected, setCollected] = useState(false);
  const addScore = useGameStore((state) => state.addScore);
  
  // Track continuous logical Z representation for continuous sine wave
  const logicalIndexRef = useRef(index);

  useFrame((_, delta) => {
    if (meshRef.current && !collected) {
      meshRef.current.rotation.y += delta * 2;
    }

    const dist = useGameStore.getState().distance;
    const playerZ = -dist;
    
    // Performance optimization: only enable light if near player
    if (lightRef.current && bodyRef.current) {
      const pos = bodyRef.current.translation();
      const distanceToPlayer = Math.abs(pos.z - playerZ);
      lightRef.current.visible = !collected && distanceToPlayer < 60;
      
      // Recycling logic: if bean is thoroughly behind the player (~20m)
      if (pos.z > playerZ + 20) {
        // Move logical index ahead by the pool size
        logicalIndexRef.current += VISIBLE_COUNT;
        
        const newZ = -30 - logicalIndexRef.current * SPACING;
        const newX = Math.sin(logicalIndexRef.current * 0.3) * 8;
        const newY = newZ * Math.tan(SLOPE_ANGLE) + 1.2;
        
        // Only reset state & teleport if we haven't crossed the finish line
        if (newZ >= -1000) {
          setCollected(false);
          bodyRef.current.setTranslation({ x: newX, y: newY, z: newZ }, true);
        } else {
          // Hide it permanently and move it far out of the way
          setCollected(true);
          bodyRef.current.setTranslation({ x: 0, y: -9000, z: newZ }, true);
        }
      }
    }
  });

  // Calculate the initial starting position of this pooled object
  const startZ = -30 - index * SPACING;
  const startX = Math.sin(index * 0.3) * 8;
  const startY = startZ * Math.tan(SLOPE_ANGLE) + 1.2;

  return (
    <RigidBody 
      ref={bodyRef}
      type="fixed" 
      colliders={false}
      position={[startX, startY, startZ]}
    >
      {/* Explicit sensor collider that is 1.5x the size of the visible geometry */}
      <CuboidCollider 
        args={[0.75, 1.125, 0.5]} 
        sensor 
        onIntersectionEnter={() => {
          if (!collected) {
             setCollected(true);
             addScore(10);
          }
        }}
      />
      {/* 
        A golden coffee bean shape: 
        Constructed using true quarter spheres to perfectly resemble a coffee bean with 
        a flat slit running down its center and a flat back.
      */}
      <group ref={meshRef} scale={[1, 1.5, 1]} visible={!collected} rotation={[0, index * (Math.PI / 12), 0]}>
        {/* Right Quarter of the bean */}
        <group position={[0.02, 0, 0]}>
          <QuarterEgg />
        </group>
        
        {/* Left Quarter of the bean, mirrored horizontally around the Z axis */}
        <group position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI]}>
          <QuarterEgg />
        </group>
      </group>
      
      {/* Golden glow cast onto the floor */}
      <pointLight 
        ref={lightRef}
        color="#ffcc00" 
        intensity={2.5} 
        distance={20} 
        decay={2} 
        position={[0, -0.5, 0]} 
      />
    </RigidBody>
  );
};

export const CoffeeBeans: React.FC = () => {
  // We only mount VISIBLE_COUNT beans in physics context and recycle their positions
  const indices = useMemo(() => Array.from({ length: VISIBLE_COUNT }, (_, i) => i), []);

  return (
    <group>
      {indices.map((i) => (
        <Bean key={i} index={i} />
      ))}
    </group>
  );
};
