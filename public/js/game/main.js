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

  // Xử lý bật âm thanh sau lần click chuột đầu tiên (yêu cầu của trình duyệt Chrome/Edge/OBS)
  const enableAudioOverlay = document.getElementById('audio-unlock-overlay');
  const enableAudio = () => {
    if (window.soundManager) {
      window.soundManager.ensureContext();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    }
    if (enableAudioOverlay) {
      enableAudioOverlay.style.display = 'none';
    }
    document.removeEventListener('click', enableAudio);
  };
  document.addEventListener('click', enableAudio);

  // Lắng nghe sự kiện click nút bật âm thanh
  const btnUnlock = document.getElementById('btn-unlock-audio');
  if (btnUnlock) {
    btnUnlock.addEventListener('click', enableAudio);
  }
});
