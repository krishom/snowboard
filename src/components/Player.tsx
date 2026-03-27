import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';

const BOARD_WIDTH = 0.55; // deck width in metres
const FINISH_DISTANCE = 1000;

export const Player: React.FC = () => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  const armsGroupRef = useRef<THREE.Group>(null);
  const { camera, mouse } = useThree();
  const { gameState, setSpeed, setDistance, setGameState } = useGameStore();

  const [mouseActive, setMouseActive] = useState(false);

  // For the drone camera
  const cameraPosition = useRef(new THREE.Vector3(0, 10, 15));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Finish sequence tracking
  const finishTriggered = useRef(false);
  const finishTimer = useRef(0);
  const finishTargetYaw = useRef(-Math.PI / 2); // determined at crossing moment

  useEffect(() => {
    const handleMouseMove = () => setMouseActive(true);
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Reset finish state when game restarts
  useEffect(() => {
    finishTriggered.current = false;
    finishTimer.current = 0;
  }, [gameState]);

  useFrame((state, delta) => {
    if (!bodyRef.current) return;

    const pos = bodyRef.current.translation();
    const vel = bodyRef.current.linvel();

    if (gameState === 'playing') {
      const dist = Math.max(0, -pos.z);
      setDistance(dist);
      const speedKmh = Math.abs(vel.z) * 3.6;

      if (Math.round(state.clock.getElapsedTime() * 10) % 2 === 0) {
        setSpeed(speedKmh);
      }

      // Trigger finish when player crosses the finish line
      if (dist >= FINISH_DISTANCE && !finishTriggered.current) {
        finishTriggered.current = true;
        // Rotate toward whichever quarter-turn the board is already leaning into
        const currentYaw = meshRef.current ? meshRef.current.rotation.y : 0;
        finishTargetYaw.current = currentYaw >= 0 ? Math.PI / 2 : -Math.PI / 2;
        setGameState('finishing'); // decelerate/rotate first — dialog comes later
        return;
      }

      let bankAngle = 0;

      if (mouseActive) {
        bankAngle = mouse.x * Math.PI / 6;
      }

      // Update the visual rotation first so we can use its yaw for physics
      if (meshRef.current) {
        meshRef.current.rotation.z = THREE.MathUtils.damp(meshRef.current.rotation.z, -bankAngle, 6, delta);
        const turnRotation = mouse.x * 0.8;
        meshRef.current.rotation.y = THREE.MathUtils.damp(meshRef.current.rotation.y, -turnRotation, 6, delta);
      }

      if (armsGroupRef.current) {
        // Exaggerated twist for the arms to simulate balancing and carving effort
        const armTwist = mouse.x * Math.PI / 3;
        armsGroupRef.current.rotation.y = THREE.MathUtils.damp(armsGroupRef.current.rotation.y, -armTwist, 8, delta);
      }

      const yaw = meshRef.current ? meshRef.current.rotation.y : 0;

      // Calculate the board's true local axes
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);

      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      // Determine how fast the board is sliding sideways relative to its orientation
      const sideVelocity = vel.x * rightX + vel.z * rightZ;

      // Represents the friction of the snowboard edge cutting into the snow
      // A lower value creates lots of slippery drift, a high value is instantly on-rails
      const carveGrip = 6.0 * delta;

      // Base engine forward push
      const thrust = 40 * delta;

      // Impulse incorporates thrust in the new forward direction, PLUS the momentum-stopping
      // side grip logic that naturally pushes the board along the curve
      bodyRef.current.applyImpulse({
        x: forwardX * thrust - rightX * sideVelocity * carveGrip,
        y: -10 * delta,
        z: forwardZ * thrust - rightZ * sideVelocity * carveGrip
      }, true);

      // Speed limit
      const maxZVel = -60;
      if (vel.z < maxZVel) {
        bodyRef.current.setLinvel({ x: vel.x, y: vel.y, z: maxZVel }, true);
      }

      // Dynamic floor limit since the slope continues infinitely downward
      const floorY = pos.z * Math.tan(0.2);
      if (pos.y < floorY - 20 || Math.abs(pos.x) > 100) {
        setGameState('gameover');
      }

    } else if (gameState === 'finishing') {
      // -----------------------------------------------------------------------
      // Finishing sequence: decelerate and rotate to a toe-side stop,
      // then wait 1 extra second before showing the Run Complete dialog.
      // -----------------------------------------------------------------------
      finishTimer.current += delta;

      // Gentle braking — slow enough that rotation has time to animate
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      if (speed > 0.3) {
        // Ease-in: starts near-zero, ramps up to full strength over ~4 s
        const t = Math.min(finishTimer.current / 4.0, 1.0);
        const easedT = t * t; // quadratic ease-in
        const brakeStrength = easedT * 50 * delta;
        bodyRef.current.applyImpulse({
          x: -vel.x * brakeStrength,
          y: 0,
          z: -vel.z * brakeStrength,
        }, true);
      } else {
        // Fully stopped — wait 1 extra second then show dialog
        bodyRef.current.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
        if (finishTimer.current >= 1.0) {
          setGameState('finished');
        }
      }

      // Smoothly rotate the mesh to the nearest quarter-turn stop
      if (meshRef.current) {
        meshRef.current.rotation.y = THREE.MathUtils.damp(
          meshRef.current.rotation.y,
          finishTargetYaw.current,
          4,
          delta
        );
        // Level out the bank
        meshRef.current.rotation.z = THREE.MathUtils.damp(
          meshRef.current.rotation.z,
          0,
          6,
          delta
        );
      }

      // Arms settle naturally
      if (armsGroupRef.current) {
        armsGroupRef.current.rotation.y = THREE.MathUtils.damp(
          armsGroupRef.current.rotation.y,
          0,
          6,
          delta
        );
      }

    } else if (gameState === 'finished') {
      // Dialog is showing — hold perfectly still
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

    } else if (gameState === 'menu') {
      // Keep player stationary at start
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
    }

    // --- Drone Camera Logic ---
    // Aims precisely at a spot exactly one player height (~2.5 units) above the head
    // Head is roughly at y + 2.5, so the target spot is y + 5.
    const target = new THREE.Vector3(pos.x, pos.y + 4, pos.z);
    const desiredPos = new THREE.Vector3(pos.x * 0.8, pos.y + 8, pos.z + 3.5);

    // Zoom in when going faster
    const speedRatio = Math.min(1, Math.abs(vel.z) / 60);
    desiredPos.y -= speedRatio * 1.5;
    desiredPos.z += speedRatio * 2;

    cameraPosition.current.lerp(desiredPos, 5 * delta);
    camera.position.copy(cameraPosition.current);

    currentLookAt.current.lerp(target, 8 * delta);
    camera.lookAt(currentLookAt.current);
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders="cuboid"
      position={[0, 5, 0]}
      friction={0.05}
      restitution={0.1}
      enabledRotations={[false, false, false]}
    >
      <group ref={meshRef}>
        {/* Body group rotated so character faces +X (sideways snowboarder stance) */}
        <group rotation={[0, -Math.PI / 2, 0]}>
          {/* Body (Black Clothes) */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.8, 1.5, 0.8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>

          {/* Arms Group for twisting */}
          <group ref={armsGroupRef} position={[0, 1.8, 0]}>
            {/* Left Arm structure */}
            <group position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
              {/* Upper arm */}
              <mesh position={[-0.25, 0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.3, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
              </mesh>
              {/* Forearm angled forward and slightly down */}
              <group position={[-0.35, 0, 0]} rotation={[0, -Math.PI / 6, Math.PI / 12]}>
                <mesh position={[-0.25, 0, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.3, 0.3]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
              </group>
            </group>

            {/* Right Arm structure */}
            <group position={[0.3, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
              {/* Upper arm */}
              <mesh position={[0.25, 0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.3, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
              </mesh>
              {/* Forearm angled forward and slightly down */}
              <group position={[0.35, 0, 0]} rotation={[0, Math.PI / 6, -Math.PI / 12]}>
                <mesh position={[0.25, 0, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.3, 0.3]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
              </group>
            </group>
          </group>

          {/* Head */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#ffe4c4" />
          </mesh>

          {/* Goggles - face forward (-X in body local = world -Z) */}
          <mesh position={[-0.31, 2.5, 0]} castShadow>
            <boxGeometry args={[0.2, 0.2, 0.61]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.1} />
          </mesh>

          {/* Black Baseball Cap */}
          <group position={[0, 2.8, 0]}>
            {/* Cap dome */}
            <mesh castShadow position={[0, 0.05, 0]}>
              <boxGeometry args={[0.62, 0.2, 0.62]} />
              <meshStandardMaterial color="#111111" roughness={0.9} />
            </mesh>
            {/* Cap brim - faces forward (-X in body local = world -Z) */}
            <mesh castShadow position={[-0.35, -0.02, 0]}>
              <boxGeometry args={[0.4, 0.05, 0.62]} />
              <meshStandardMaterial color="#111111" roughness={0.9} />
            </mesh>
          </group>
        </group>

        {/* The Snowboard with rounded tips */}
        <group position={[0, 0.75, 0]}>
          {/* Main deck */}
          <mesh castShadow>
            <boxGeometry args={[BOARD_WIDTH, 0.05, 2.0]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
          {/* Front tip - half circle curving toward -Z */}
          <mesh castShadow position={[0, 0, -1.0]}>
            <cylinderGeometry args={[BOARD_WIDTH / 2, BOARD_WIDTH / 2, 0.05, 16, 1, false, Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
          {/* Tail tip - half circle curving toward +Z */}
          <mesh castShadow position={[0, 0, 1.0]}>
            <cylinderGeometry args={[BOARD_WIDTH / 2, BOARD_WIDTH / 2, 0.05, 16, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
        </group>

        {/* The Trail Emitter (behind the board) */}
        <Trail width={4} length={12} color={'#b3e5fc'} attenuation={(t) => t * t}>
          {/* Pos Z = 1.25 puts it right at the tail edge of the snowboard */}
          <group position={[0, 0.75, 1.25]} />
        </Trail>
      </group>
    </RigidBody>
  );
};
