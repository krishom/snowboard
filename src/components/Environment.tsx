import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

import { useGameStore } from '../store/gameStore';

const FINISH_Z = -1000;
const SLOPE_ANGLE = 0.2;

// ---------------------------------------------------------------------------
// Checkerboard finish stripe
// ---------------------------------------------------------------------------
const FinishLine: React.FC = () => {
  const texture = useMemo(() => {
    const size = 512;
    const cols = 8;
    const rows = 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = (size / cols) * rows; // keep squares square
    const ctx = canvas.getContext('2d')!;
    const cellW = size / cols;
    const cellH = canvas.height / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  // The floor mesh is inside a RigidBody rotated by [-PI/2 - 0.2, 0, 0],
  // so we replicate that tilt here and place the stripe just above the snow.
  const finishY = FINISH_Z * Math.tan(SLOPE_ANGLE);

  return (
    <group position={[0, finishY, FINISH_Z]} rotation={[-Math.PI / 2 - SLOPE_ANGLE, 0, 0]}>
      {/* Checkerboard decal — sits 0.05 units above the floor to avoid z-fighting */}
      <mesh position={[0, 0, 0.25]} receiveShadow>
        <planeGeometry args={[50, 8]} />
        <meshStandardMaterial map={texture} roughness={0.9} transparent={false} />
      </mesh>

      {/* Left banner pole */}
      <mesh position={[-25, 0, 5]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 14, 8]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>
      {/* Right banner pole */}
      <mesh position={[25, 0, 5]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 14, 8]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>
      {/* Horizontal crossbar */}
      <mesh position={[0, 0, 12]} castShadow>
        <boxGeometry args={[50.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Alternating red/white segments on crossbar */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-22.5 + i * 5, 0, 12.35]} castShadow>
          <boxGeometry args={[2.5, 0.65, 0.35]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#cc0000' : '#ffffff'} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Jump Ramp
// ---------------------------------------------------------------------------
const JumpRamp: React.FC<{ z: number, x?: number }> = ({ z, x = 0 }) => {
  const y = z * Math.tan(SLOPE_ANGLE);
  return (
    <group position={[x, y, z]} rotation={[-Math.PI / 2 - SLOPE_ANGLE, 0, 0]}>
      {/* Rotate the RigidBody to form the ramp incline */}
      <RigidBody
        type="fixed"
        colliders="cuboid"
        friction={0.01}
        restitution={0.1}
        position={[0, 0, -1]}
        rotation={[0.25, 0, 0]}
      >
        <mesh receiveShadow castShadow>
          <boxGeometry args={[10.8, 24, 4]} />
          {/* Slightly darker snow contour to be visible */}
          <meshStandardMaterial color="#c2e0ff" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Flag poles - purely visual so no colliders */}
      <group position={[0, 0, -1]} rotation={[0.25, 0, 0]}>
        <mesh position={[-4.9, 11, 4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 4]} />
          <meshStandardMaterial color="#ff3333" />
        </mesh>
        <mesh position={[4.9, 11, 4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 4]} />
          <meshStandardMaterial color="#ff3333" />
        </mesh>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main Environment
// ---------------------------------------------------------------------------
export const Environment: React.FC = () => {
  const treeRefs = useRef<THREE.Group[]>([]);
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);

  // Generate random trees
  const trees = useMemo(() => {
    const arr = [];
    const minZ = -500;
    const maxZ = 50;

    for (let i = 0; i < 200; i++) {
      // Place them at the inner face of the snow banks (banks centered at ±27, inner edge at ±25)
      const x = getTreeX();
      const z = Math.random() * (maxZ - minZ) + minZ;
      // Calculate y based on the slope. 
      // slope angle is roughly Math.PI / 12 (15 degrees)
      const y = z * Math.tan(SLOPE_ANGLE);

      const scale = Math.random() * 0.5 + 0.8;

      arr.push(
        <group key={i} ref={(el) => { if (el) treeRefs.current[i] = el; }} position={[x, y, z]} scale={scale}>
          {/* Trunk */}
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.6, 4]} />
            <meshStandardMaterial color="#4a3b32" />
          </mesh>
          {/* Leaves */}
          <mesh position={[0, 6, 0]} castShadow>
            <coneGeometry args={[3.0, 6, 5]} />
            <meshStandardMaterial color="#2d4c1e" />
          </mesh>
          <mesh position={[0, 9, 0]} castShadow>
            <coneGeometry args={[2.4, 5, 5]} />
            <meshStandardMaterial color="#3a5f27" />
          </mesh>
        </group>
      );
    }
    return arr;
  }, []);

  useFrame(() => {
    // Use the exact instantaneous gameStore distance to avoid the 1-frame camera lag on respawn
    const distance = useGameStore.getState().distance;
    const playerZ = -distance;
    const playerY = playerZ * Math.tan(SLOPE_ANGLE);

    // Move the directional light to follow the player so its shadow frustum stays centred
    if (dirLightRef.current) {
      dirLightRef.current.position.set(20, playerY + 60, playerZ + 50);
      dirLightRef.current.target.position.set(0, playerY, playerZ);
      dirLightRef.current.target.updateMatrixWorld();
    }

    treeRefs.current.forEach((tree) => {
      // If the tree is definitively behind the player (+20 units buffer)
      if (tree.position.z > playerZ + 40) {
        // Move it way ahead into the fog, maintaining roughly 550 units of tree spread
        tree.position.z -= 550;

        // Randomize the new X position so it doesn't look like the same tree
        tree.position.x = getTreeX();

        // Update Y height to match the new Z position on the slope
        tree.position.y = tree.position.z * Math.tan(SLOPE_ANGLE);
      }
    });
  });

  return (
    <group>
      {/* Lighting and Scene Setup */}
      <ambientLight intensity={0.6} />
      <directionalLight ref={dirLightRef} position={[20, 50, -20]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.1, 600]} />
      </directionalLight>

      {/* The main Slope and Walls combined into one tilted RigidBody */}
      <RigidBody
        type="fixed"
        friction={0.01}
        restitution={0.1}
        position={[0, -250 * Math.tan(0.2), -250]}
        rotation={[-Math.PI / 2 - 0.2, 0, 0]}
        colliders={false}
      >
        {/* Floor */}
        <CuboidCollider args={[50, 25000, 1]} position={[0, 0, -1]} />
        <mesh receiveShadow position={[0, 0, -1]}>
          <boxGeometry args={[100, 50000, 2]} />
          <meshStandardMaterial color="#e0f0ff" roughness={0.8} />
        </mesh>

        {/* Left wall */}
        {/* Keep the invisible, towering physics collider slightly inward to act as an invisible bumper */}
        <CuboidCollider args={[1, 25000, 10]} position={[-24, 0, 9]} />
        {/* Render the tall visual snow bank wider, creating a safe non-clipping boundary */}
        <mesh position={[-27, 0, 4]} castShadow receiveShadow>
          <boxGeometry args={[4, 50000, 8]} />
          <meshStandardMaterial color="#e0f0ff" roughness={0.9} />
        </mesh>

        {/* Right wall */}
        <CuboidCollider args={[1, 25000, 10]} position={[24, 0, 9]} />
        <mesh position={[27, 0, 4]} castShadow receiveShadow>
          <boxGeometry args={[4, 50000, 8]} />
          <meshStandardMaterial color="#e0f0ff" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Trees */}
      <group>
        {trees}
      </group>

      {/* Jump Ramps */}
      <JumpRamp z={-500} />

      {/* Finish Line at 1000m */}
      <FinishLine />
    </group>
  );
};

function getTreeX() {
  return (Math.random() * 10 + 10) * (Math.random() > 0.5 ? -1 : 1);
}
