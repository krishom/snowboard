import React from 'react';
import { useGameStore } from '../store/gameStore';

export const UI: React.FC = () => {
  const { gameState, score, speed, distance, setGameState, resetGame } = useGameStore();

  return (
    <div className="ui-layer">
      {/* HUD - visible while playing or finishing */}
      {(gameState === 'playing' || gameState === 'finishing') && (
        <>
          <div className="hud-top">
            <div className="glass-panel hud-panel">
              <span className="hud-label">Score</span>
              <span className="hud-value-score">{Math.floor(score)}</span>
            </div>
            <div className="glass-panel hud-panel" style={{ textAlign: 'right' }}>
              <span className="hud-label">Speed</span>
              <span className="hud-value-speed">{Math.floor(speed * 100 / 216)} <span className="hud-unit">km/h</span></span>
            </div>
          </div>
          <div className="glass-panel hud-bottom">
            <span className="hud-distance">Distance: <span className="hud-distance-val">{Math.floor(distance)}m</span></span>
          </div>
        </>
      )}

      {/* Main Menu */}
      {gameState === 'menu' && (
        <div className="menu-overlay">
          <div className="glass-panel menu-panel">
            <h1 className="menu-title">
              TSE<br />Snowboarding<br />Extreme!
            </h1>
            <p className="menu-subtitle">
              Steer with your mouse.<br />Do you reckon you're ready to snowboard?
            </p>
            <button
              className="btn-start"
              onClick={() => setGameState('playing')}
            >
              I'm ready!
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="gameover-overlay">
          <div className="glass-panel gameover-panel">
            <h2 className="gameover-title">WIPEOUT!</h2>
            <div className="gameover-stats">
              <p className="gameover-stat">Final Score: <span className="gameover-val">{Math.floor(score)}</span></p>
              <p className="gameover-stat">Distance: <span className="gameover-val">{Math.floor(distance)}m</span></p>
            </div>
            <button
              className="btn-retry"
              onClick={() => {
                resetGame();
                setGameState('playing');
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Run Complete Screen */}
      {gameState === 'finished' && (
        <div className="finished-overlay">
          <div className="glass-panel finished-panel">
            <div className="finished-flag">🏁</div>
            <h2 className="finished-title">Nice run!</h2>
            <p className="finished-subtitle">Time for some coffee!</p>
            <div className="finished-stats">
              <p className="finished-stat">Final Score: <span className="finished-val">{Math.floor(score)}</span></p>
              <p className="finished-stat">Distance: <span className="finished-val">{Math.floor(distance).toLocaleString()}m</span></p>
              <p className="finished-stat">Top Speed: <span className="finished-val">{Math.floor(speed * 100 / 216)} km/h</span></p>
            </div>
            <div className="finished-buttons">
              <button
                className="btn-ride-again"
                onClick={() => {
                  resetGame();
                  setGameState('playing');
                }}
              >
                Ride Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
