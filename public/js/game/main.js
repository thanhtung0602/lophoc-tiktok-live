/**
 * PHASER 3 GAME BOOTSTRAPPER & RESPONSIVE LAYOUT CONTROLLER
 */

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const layout = urlParams.get('layout') || '9:16'; // '9:16' (TikTok LIVE) hoặc '16:9'
  const isOverlay = urlParams.get('overlay') === 'true';

  let gameWidth = 720;
  let gameHeight = 1280;

  if (layout === '16:9') {
    document.body.classList.add('layout-16-9');
    gameWidth = 1280;
    gameHeight = 720;
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: gameWidth,
    height: gameHeight,
    backgroundColor: isOverlay ? 'transparent' : '#fbf6e2',
    transparent: isOverlay,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [ClassroomScene]
  };

  const game = new Phaser.Game(config);
  window.phaserGame = game;

  // Tự động kích hoạt âm thanh Web Audio & TTS
  const triggerAudio = () => {
    if (window.soundManager) {
      window.soundManager.ensureContext();
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  };
  ['click', 'touchstart', 'mousedown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, triggerAudio, { once: true, passive: true });
  });
});
