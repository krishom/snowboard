import { create } from 'zustand';

type GameState = 'menu' | 'playing' | 'gameover' | 'finishing' | 'finished';

interface GameStore {
  gameState: GameState;
  score: number;
  speed: number;
  distance: number;
  runId: number;
  beansCollected: number;
  bestTrick: { name: string; score: number } | null;
  trickPopup: { text: string; score: number; id: number } | null;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  addScore: (points: number) => void;
  setSpeed: (speed: number) => void;
  setDistance: (distance: number) => void;
  incrementBeans: () => void;
  updateBestTrick: (name: string, score: number) => void;
  showTrickPopup: (text: string, score: number) => void;
  highScore: number;
  isNewHighScore: boolean;
  checkHighScore: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: 'menu',
  score: 0,
  speed: 0,
  distance: 0,
  runId: 0,
  beansCollected: 0,
  bestTrick: null,
  trickPopup: null,
  highScore: parseInt(localStorage.getItem('tse_highScore') || '0', 10) || 0,
  isNewHighScore: false,
  setGameState: (state) => set({ gameState: state }),
  setScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  setSpeed: (speed) => set({ speed }),
  setDistance: (distance) => set({ distance }),
  incrementBeans: () => set((state) => ({ beansCollected: state.beansCollected + 1 })),
  updateBestTrick: (name, score) => set((state) => {
    if (!state.bestTrick || score > state.bestTrick.score) {
      return { bestTrick: { name, score } };
    }
    return {};
  }),
  showTrickPopup: (text, score) => set({ trickPopup: { text, score, id: Date.now() } }),
  checkHighScore: () => set((state) => {
    if (state.score > state.highScore && state.score > 0) {
      localStorage.setItem('tse_highScore', state.score.toString());
      return { highScore: state.score, isNewHighScore: true };
    }
    return {};
  }),
  resetGame: () => set((state) => ({ gameState: 'menu', score: 0, speed: 0, distance: 0, trickPopup: null, beansCollected: 0, bestTrick: null, isNewHighScore: false, runId: state.runId + 1 })),
}));
