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

  // Cấu hình đồ họa siêu sắc nét Full HD / 2x Retina
  const dpr = Math.max(window.devicePixelRatio || 1, 2);

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: gameWidth,
    height: gameHeight,
    resolution: dpr, // Tăng mật độ điểm ảnh lên 2x giúp đồ họa, bảng và chữ nét căng trên điện thoại
    backgroundColor: isOverlay ? 'transparent' : '#fbf6e2',
    transparent: isOverlay,
    roundPixels: true,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: true,
      pixelArt: false,
      powerPreference: 'high-performance'
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: gameWidth,
      height: gameHeight
    },
    scene: [ClassroomScene]
  };

  const game = new Phaser.Game(config);
  window.phaserGame = game;

  // Xóa bỏ triệt để bất kỳ khung bật âm thanh nào nếu còn sót lại do cache
  const staleOverlay = document.getElementById('audio-unlock-overlay');
  if (staleOverlay) staleOverlay.remove();
  const staleBtn = document.getElementById('btn-unlock-audio');
  if (staleBtn) staleBtn.remove();

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
