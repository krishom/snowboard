import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

import { useGameStore } from '../store/gameStore';

export const Environment: React.FC = () => {
  const treeRefs = useRef<THREE.Group[]>([]);

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
      const slopeAngle = 0.2; // roughly
      const y = z * Math.tan(slopeAngle);

      const scale = Math.random() * 0.5 + 0.8;

      arr.push(
        <group key={i} ref={(el) => { if (el) treeRefs.current[i] = el; }} position={[x, y, z]} scale={scale}>
          {/* Trunk */}
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.3, 2]} />
            <meshStandardMaterial color="#4a3b32" />
          </mesh>
          {/* Leaves */}
          <mesh position={[0, 3, 0]} castShadow>
            <coneGeometry args={[1.5, 3, 5]} />
            <meshStandardMaterial color="#2d4c1e" />
          </mesh>
          <mesh position={[0, 4.5, 0]} castShadow>
            <coneGeometry args={[1.2, 2.5, 5]} />
            <meshStandardMaterial color="#3a5f27" />
          </mesh>
        </group>
      );
    }
    return arr;
  }, []);

  useFrame(() => {
    const slopeAngle = 0.2;
    // Use the exact instantaneous gameStore distance to avoid the 1-frame camera lag on respawn
    const distance = useGameStore.getState().distance;
    const playerZ = -distance;

    treeRefs.current.forEach((tree) => {
      // If the tree is definitively behind the player (+20 units buffer)
      if (tree.position.z > playerZ + 40) {
        // Move it way ahead into the fog, maintaining roughly 550 units of tree spread
        tree.position.z -= 550;

        // Randomize the new X position so it doesn't look like the same tree
        tree.position.x = getTreeX();

        // Update Y height to match the new Z position on the slope
        tree.position.y = tree.position.z * Math.tan(slopeAngle);
      }
    });
  });

  return (
    <group>
      {/* Lighting and Scene Setup */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 50, -20]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-100, 100, 100, -100, 0.1, 200]} />
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
    </group>
  );
};
function getTreeX() {
  return (Math.random() * 10 + 10) * (Math.random() > 0.5 ? -1 : 1);
}

