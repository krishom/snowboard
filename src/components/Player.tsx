import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';

const BOARD_WIDTH = 0.55; // deck width in metres
const FINISH_DISTANCE = 3000;

export const Player: React.FC = () => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  const armsGroupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const boardRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Group>(null);
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

  // Stance tracking
  const wasAirborne = useRef(false);
  const stanceCenter = useRef(0); // 0 = regular (facing +X), ±π = switch (facing -X)
  const airborneRotation = useRef(0); // tracks accumulated rotation while airborne
  const grabDegreesNose = useRef<number[]>([]);
  const grabDegreesTail = useRef<number[]>([]);
  const isNosegrabbing = useRef(false);
  const isTailgrabbing = useRef(false);

  useEffect(() => {
    const handleMouseMove = () => setMouseActive(true);
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isNosegrabbing.current = true;
      if (e.button === 2) isTailgrabbing.current = true;
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isNosegrabbing.current = false;
      if (e.button === 2) isTailgrabbing.current = false;
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.targetTouches.length > 1) {
        isNosegrabbing.current = true;
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (e.targetTouches.length <= 1) {
        isNosegrabbing.current = false;
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Reset finish + stance state when game restarts
  useEffect(() => {
    finishTriggered.current = false;
    finishTimer.current = 0;
    wasAirborne.current = false;
    stanceCenter.current = 0;
    airborneRotation.current = 0;
    grabDegreesNose.current = [];
    grabDegreesTail.current = [];
    isNosegrabbing.current = false;
    isTailgrabbing.current = false;
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
        // Rotate toward whichever quarter-turn the board is already leaning into,
        // measured relative to stanceCenter so switch stance is handled correctly.
        const currentYaw = meshRef.current ? meshRef.current.rotation.y : 0;
        const deviation = currentYaw - stanceCenter.current;
        finishTargetYaw.current = stanceCenter.current + (deviation >= 0 ? Math.PI / 2 : -Math.PI / 2);
        setGameState('finishing'); // decelerate/rotate first — dialog comes later
        return;
      }

      // Detect airborne: player is more than 1 unit above the expected slope surface
      const floorY = pos.z * Math.tan(0.2);
      const isAirborne = pos.y > floorY + 1.0;

      if (isAirborne) {
        // -----------------------------------------------------------------------
        // Aerial: spin with mouse X, no steering impulse
        // -----------------------------------------------------------------------
        if (meshRef.current && mouseActive) {
          // Additive spin — up to ~1.5 full rotations per second at full mouse deflection
          const spinDelta = -mouse.x * Math.PI * 1.5 * delta;
          
          const prevTotalDeg = Math.abs(airborneRotation.current) * (180 / Math.PI);
          meshRef.current.rotation.y += spinDelta;
          airborneRotation.current += spinDelta;
          const currentTotalDeg = Math.abs(airborneRotation.current) * (180 / Math.PI);
          
          const actualDelta = currentTotalDeg - prevTotalDeg;
          if (actualDelta > 0) {
            const currentChunk = Math.floor(prevTotalDeg / 180);
            if (!grabDegreesNose.current[currentChunk]) grabDegreesNose.current[currentChunk] = 0;
            if (!grabDegreesTail.current[currentChunk]) grabDegreesTail.current[currentChunk] = 0;
            
            if (isNosegrabbing.current) grabDegreesNose.current[currentChunk] += actualDelta;
            if (isTailgrabbing.current) grabDegreesTail.current[currentChunk] += actualDelta;
          }
          
          // Slight body tilt matching spin direction for style
          meshRef.current.rotation.z = THREE.MathUtils.damp(
            meshRef.current.rotation.z, -mouse.x * 0.35, 4, delta
          );
        }
        // Arms rise up during tricks
        if (armsGroupRef.current) {
          armsGroupRef.current.rotation.y = THREE.MathUtils.damp(
            armsGroupRef.current.rotation.y, 0, 4, delta
          );
        }
        // Only gravity — preserve horizontal momentum
        bodyRef.current.applyImpulse({ x: 0, y: -10 * delta, z: 0 }, true);

      }

      // Landing detection: runs every frame, fires only on the transition airborne→grounded
      if (wasAirborne.current && !isAirborne && meshRef.current) {
        
        // Calculate trick if we rotated enough
        const totalDeg = Math.abs(airborneRotation.current) * (180 / Math.PI);
        const halfSpins = Math.floor(totalDeg / 180);
        const trickDeg = halfSpins * 180;
        
        if (trickDeg >= 180) {
          const trickNames: string[] = [];
          
          for (let i = 0; i < halfSpins; i++) {
             const n = grabDegreesNose.current[i] || 0;
             const t = grabDegreesTail.current[i] || 0;
             let trickName = "";
             if (n > t && n >= 90) {
               trickName = "Nosegrab";
             } else if (t > n && t >= 90) {
               trickName = "Tailgrab";
             }
             if (trickName && (trickNames.length === 0 || trickNames[trickNames.length - 1] !== trickName)) {
               trickNames.push(trickName);
             }
          }
          
          let multiplier = 1;
          if (trickNames.length > 0) {
            multiplier = Math.pow(2, trickNames.length);
          }
          
          const finalTrickName = trickNames.length > 0 
            ? `${trickNames.join(" + ")} ${trickDeg}°!`
            : `${trickDeg}°!`;
            
          const trickScore = Math.pow(halfSpins, 2) * 500 * multiplier;
          useGameStore.getState().showTrickPopup(finalTrickName, trickScore);
          useGameStore.getState().addScore(trickScore);
          useGameStore.getState().updateBestTrick(finalTrickName.replace('!', ''), trickScore);
        }
        airborneRotation.current = 0;
        grabDegreesNose.current = [];
        grabDegreesTail.current = [];

        const raw = meshRef.current.rotation.y;
        // Normalise to [-π, π]
        const norm = ((raw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        // If facing roughly toward -X, adopt switch stance
        stanceCenter.current = Math.abs(norm) > Math.PI / 2
          ? Math.sign(norm) * Math.PI
          : 0;
        // Snap rotation to normalised value so damp has no large jump to cross
        meshRef.current.rotation.y = norm;
      }
      wasAirborne.current = isAirborne;

      if (!isAirborne) {
        // -----------------------------------------------------------------------
        // Grounded: normal carve steering
        // -----------------------------------------------------------------------
        let bankAngle = 0;
        if (mouseActive) {
          bankAngle = mouse.x * Math.PI / 6;
        }

        // Update the visual rotation first so we can use its yaw for physics
        if (meshRef.current) {
          const leanSign = stanceCenter.current === 0 ? 1 : -1;
          meshRef.current.rotation.z = THREE.MathUtils.damp(meshRef.current.rotation.z, leanSign * -bankAngle, 6, delta);
          const turnRotation = mouse.x * 0.8;
          // Steer around the current stance centre (0 = regular, ±π = switch)
          meshRef.current.rotation.y = THREE.MathUtils.damp(meshRef.current.rotation.y, stanceCenter.current - turnRotation, 6, delta);
        }

        if (armsGroupRef.current) {
          // Exaggerated twist for the arms to simulate balancing and carving effort
          const armTwist = mouse.x * Math.PI / 3;
          armsGroupRef.current.rotation.y = THREE.MathUtils.damp(armsGroupRef.current.rotation.y, -armTwist, 8, delta);
        }

        const yaw = meshRef.current ? meshRef.current.rotation.y : 0;

        // Raw board axes from yaw
        const rawFwdX = -Math.sin(yaw);
        const rawFwdZ = -Math.cos(yaw);

        // In switch stance rawFwdZ > 0 (uphill) — flip all direction vectors so
        // both thrust AND carve grip always operate in the downhill frame.
        const dirSign = rawFwdZ <= 0 ? 1 : -1;
        const forwardX = dirSign * rawFwdX;
        const forwardZ = dirSign * rawFwdZ;          // guaranteed <= 0 (downhill)
        const rightX   = dirSign *  Math.cos(yaw);
        const rightZ   = dirSign * -Math.sin(yaw);

        // Lateral slip relative to the corrected board axes
        const sideVelocity = vel.x * rightX + vel.z * rightZ;

        const carveGrip = 6.0 * delta;
        const thrust = 40 * delta;

        bodyRef.current.applyImpulse({
          x: forwardX * thrust - rightX * sideVelocity * carveGrip,
          y: -10 * delta,
          z: forwardZ * thrust - rightZ * sideVelocity * carveGrip
        }, true);
      }

      // Speed limit (always)
      const maxZVel = -60;
      if (vel.z < maxZVel) {
        bodyRef.current.setLinvel({ x: vel.x, y: vel.y, z: maxZVel }, true);
      }

      // Dynamic floor limit since the slope continues infinitely downward
      if (pos.y < floorY - 20 || Math.abs(pos.x) > 100) {
        useGameStore.getState().checkHighScore();
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
          useGameStore.getState().checkHighScore();
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

    // --- Post-Physics Animations & State Overrides ---
    if (leftArmRef.current && rightArmRef.current) {
      if (gameState === 'menu') {
        leftArmRef.current.rotation.z = Math.PI / 4;
        rightArmRef.current.rotation.z = -Math.PI / 4;
      } else {
        const isFinishing = gameState === 'finishing' || gameState === 'finished';
        // -Math.PI / 2.5 is an outwardly raised V-shape for the left arm
        // Math.PI / 4 is the normal slightly-down carrying pose
        let targetLeftZ = isFinishing ? -Math.PI / 2.5 : Math.PI / 4;
        let targetRightZ = isFinishing ? Math.PI / 2.5 : -Math.PI / 4;
        
        const doNosegrab = gameState === 'playing' && wasAirborne.current && isNosegrabbing.current;
        const doTailgrab = gameState === 'playing' && wasAirborne.current && isTailgrabbing.current;

        if (doNosegrab) {
          targetLeftZ = 0; // Rotate up so it's level to the ground
        }
        if (doTailgrab) {
          targetRightZ = 0; // Rotate up so it's level to the ground
        }

        leftArmRef.current.rotation.z = THREE.MathUtils.damp(
          leftArmRef.current.rotation.z, targetLeftZ, 8, delta
        );
        rightArmRef.current.rotation.z = THREE.MathUtils.damp(
          rightArmRef.current.rotation.z, targetRightZ, 8, delta
        );

        if (leftForearmRef.current) {
          const targetForearmY = doNosegrab ? 0 : -Math.PI / 6;
          const targetForearmZ = doNosegrab ? 0 : Math.PI / 12;

          leftForearmRef.current.rotation.y = THREE.MathUtils.damp(
            leftForearmRef.current.rotation.y, targetForearmY, 8, delta
          );
          leftForearmRef.current.rotation.z = THREE.MathUtils.damp(
            leftForearmRef.current.rotation.z, targetForearmZ, 8, delta
          );
        }

        if (rightForearmRef.current) {
          const targetForearmY = doTailgrab ? 0 : Math.PI / 6;
          const targetForearmZ = doTailgrab ? 0 : -Math.PI / 12;

          rightForearmRef.current.rotation.y = THREE.MathUtils.damp(
            rightForearmRef.current.rotation.y, targetForearmY, 8, delta
          );
          rightForearmRef.current.rotation.z = THREE.MathUtils.damp(
            rightForearmRef.current.rotation.z, targetForearmZ, 8, delta
          );
        }
      }
    }

    if (boardRef.current) {
      let targetBoardX = 0;
      if (gameState === 'playing' && wasAirborne.current) {
        if (isNosegrabbing.current) targetBoardX = Math.PI / 5;
        else if (isTailgrabbing.current) targetBoardX = -Math.PI / 5;
      }
      boardRef.current.rotation.x = THREE.MathUtils.damp(
        boardRef.current.rotation.x, targetBoardX, 8, delta
      );
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

    // Smoothly rotate the head to face downhill, staying on the same body side.
    // While stopping, look 90° toward the chest (both stances land at −π/2 = +X world).
    if (headRef.current) {
      const stanceBase = stanceCenter.current === 0 ? 0 : -Math.PI;
      const isStopping = gameState === 'finishing' || gameState === 'finished';
      const headTarget = isStopping ? -Math.PI / 2 : stanceBase;
      headRef.current.rotation.y = THREE.MathUtils.damp(
        headRef.current.rotation.y, headTarget, 3, delta
      );
    }

    // Move trail emitter to whichever end of the board is trailing downhill
    if (trailRef.current) {
      const isFinishing = gameState === 'finishing' || gameState === 'finished';
      const targetTrailZ = isFinishing ? 0 : (stanceCenter.current === 0 ? 1.25 : -1.25);
      trailRef.current.position.z = THREE.MathUtils.damp(
        trailRef.current.position.z,
        targetTrailZ,
        4,
        delta
      );
    }

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
            <group ref={leftArmRef} position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
              {/* Upper arm */}
              <mesh position={[-0.25, 0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.3, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
              </mesh>
              {/* Forearm angled forward and slightly down */}
              <group ref={leftForearmRef} position={[-0.35, 0, 0]} rotation={[0, -Math.PI / 6, Math.PI / 12]}>
                <mesh position={[-0.25, 0, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.3, 0.3]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
              </group>
            </group>

            {/* Right Arm structure */}
            <group ref={rightArmRef} position={[0.3, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
              {/* Upper arm */}
              <mesh position={[0.25, 0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.3, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
              </mesh>
              {/* Forearm angled forward and slightly down */}
              <group ref={rightForearmRef} position={[0.35, 0, 0]} rotation={[0, Math.PI / 6, -Math.PI / 12]}>
                <mesh position={[0.25, 0, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.3, 0.3]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
              </group>
            </group>
          </group>

          {/* Head group — rotates to face downhill on stance switch */}
          <group ref={headRef} position={[0, 2.5, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color="#ffe4c4" />
            </mesh>

            {/* Goggles - face forward (-X in body local) */}
            <mesh position={[-0.31, 0, 0]} castShadow>
              <boxGeometry args={[0.2, 0.2, 0.61]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.1} />
            </mesh>

            {/* Black Baseball Cap */}
            <group position={[0, 0.3, 0]}>
              {/* Cap dome */}
              <mesh castShadow position={[0, 0.05, 0]}>
                <boxGeometry args={[0.62, 0.2, 0.62]} />
                <meshStandardMaterial color="#111111" roughness={0.9} />
              </mesh>
              {/* Cap brim - faces forward (-X in body local) */}
              <mesh castShadow position={[-0.35, -0.02, 0]}>
                <boxGeometry args={[0.4, 0.05, 0.62]} />
                <meshStandardMaterial color="#111111" roughness={0.9} />
              </mesh>
            </group>
          </group>
        </group>

        {/* The Snowboard with rounded tips */}
        <group ref={boardRef} position={[0, 0.75, 0]}>
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
          {/* Trail emitter — position updated each frame to follow the trailing tip */}
          <group ref={trailRef} position={[0, 0.75, 1.25]} />
        </Trail>
      </group>
    </RigidBody>
  );
};
