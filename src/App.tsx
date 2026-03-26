import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { UI } from './components/UI';
import { useGameStore } from './store/gameStore';
import { Environment } from './components/Environment';
import { Player } from './components/Player';

function App() {
  const { gameState, runId } = useGameStore();

  return (
    <div className="app-container">
      <UI />
      
      <Canvas shadows>
        {/* PS1 Style Fog and Environment Color */}
        <color attach="background" args={['#a2c1de']} />
        <fog attach="fog" args={['#a2c1de', 20, 150]} />
        
        <Suspense fallback={null}>
          <Physics key={runId}>
            <Environment />
            <Player />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
