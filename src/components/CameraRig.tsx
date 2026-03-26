import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';

export const CameraRig: React.FC = () => {
  const { gameState } = useGameStore();
  const vec = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    // If we're not playing yet, slowly orbit or stand still 
    // But since the physics engine and player are in the scene, let's just grab the player's position
    // if possible. But the camera rig runs separately.
    // A better approach: we can just find the child object named "Player" or track the player via global store.
    // Wait, the easiest way to follow the player is to just make a ref in App, or track player pos.
    // However, we can just track the rigid body in Player, but we can't easily access it from here unless we lift state.
    // Instead of doing it this way, let's just attach the camera to the Player directly in Player.tsx, 
    // OR we inject the camera rig inside Player.tsx. Let me refine this.
  });

  return null;
};
