import { create } from 'zustand';

type GameState = 'menu' | 'playing' | 'gameover' | 'finishing' | 'finished';

interface GameStore {
  gameState: GameState;
  score: number;
  speed: number;
  distance: number;
  runId: number;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  addScore: (points: number) => void;
  setSpeed: (speed: number) => void;
  setDistance: (distance: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: 'menu',
  score: 0,
  speed: 0,
  distance: 0,
  runId: 0,
  setGameState: (state) => set({ gameState: state }),
  setScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  setSpeed: (speed) => set({ speed }),
  setDistance: (distance) => set({ distance }),
  resetGame: () => set((state) => ({ gameState: 'menu', score: 0, speed: 0, distance: 0, runId: state.runId + 1 })),
}));
