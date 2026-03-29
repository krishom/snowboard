import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

function useScoreTween(targetScore: number, duration = 800) {
  const [displayedScore, setDisplayedScore] = useState(targetScore);

  useEffect(() => {
    let frame: number;
    let startVal = displayedScore;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplayedScore(startVal + (targetScore - startVal) * ease);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetScore]); // eslint-disable-line react-hooks/exhaustive-deps

  return Math.floor(displayedScore);
}

export const UI: React.FC = () => {
  const { gameState, score, speed, distance, trickPopup, beansCollected, bestTrick, highScore, isNewHighScore, setGameState, resetGame } = useGameStore();
  const animatedScore = useScoreTween(score);

  const bestTrickDisplay = bestTrick ? `${bestTrick.name} (+${bestTrick.score.toLocaleString()})` : "Surviving";

  return (
    <div className="ui-layer">
      {/* Trick Popup */}
      {trickPopup && (
        <div key={trickPopup.id} className="trick-popup">
          <div className="trick-popup-name">{trickPopup.text}</div>
          <div className="trick-popup-score">+{trickPopup.score.toLocaleString()}</div>
        </div>
      )}

      {/* HUD - visible while playing or finishing */}
      {(gameState === 'playing' || gameState === 'finishing') && (
        <>
          <div className="hud-top">
            <div className="glass-panel hud-panel">
              <span className="hud-label">Score</span>
              <span className="hud-value-score">{animatedScore}</span>
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
              Steer with your mouse.<br />
              Collect golden coffee beans.<br />
              Do tricks in the air.<br />
              <br />
              Do you reckon you're ready to snowboard?
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
              <p className="gameover-stat">Golden Coffee Beans: <span className="gameover-val">{beansCollected}</span></p>
              <p className="gameover-stat">Best Trick: <span className="gameover-val">{bestTrickDisplay}</span></p>
              <p className="gameover-stat">Final Score: <span className="gameover-val">{animatedScore}</span></p>
              {isNewHighScore && <p className="gameover-stat new-high-score">NEW HIGH SCORE!</p>}
              {!isNewHighScore && <p className="gameover-stat">High Score: <span className="gameover-val">{highScore}</span></p>}
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
              <p className="finished-stat">Golden Coffee Beans: <span className="finished-val">{beansCollected}</span></p>
              <p className="finished-stat">Best Trick: <span className="finished-val">{bestTrickDisplay}</span></p>
              <p className="finished-stat">Final Score: <span className="finished-val">{animatedScore}</span></p>
              {isNewHighScore && <p className="finished-stat new-high-score">NEW HIGH SCORE!</p>}
              {!isNewHighScore && <p className="finished-stat">High Score: <span className="finished-val">{highScore}</span></p>}
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
