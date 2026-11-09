/**
 * NHÂN VẬT GIÁO VIÊN HOẠT HÌNH 2D (TEACHER SPRITE)
 * Vẽ trực quan bằng Phaser Vector Graphics & Container, hỗ trợ các hoạt ảnh mượt mà
 */

class TeacherSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.scene = scene;
    this.isSpeaking = false;
    this.currentState = 'idle';

    this.initGraphics();
    this.initAnimations();

    scene.add.existing(this);
  }

  initGraphics() {
    // 1. Bóng dưới chân
    this.shadow = this.scene.add.ellipse(0, 75, 50, 16, 0x000000, 0.25);
    this.add(this.shadow);

    // 2. Thân người (Váy / Áo vest giáo viên)
    this.bodyGraphics = this.scene.add.graphics();
    // Váy xanh đậm
    this.bodyGraphics.fillStyle(0x2c3e50, 1);
    this.bodyGraphics.fillRoundedRect(-18, 15, 36, 50, 6);
    // Áo sơ mi trắng bên trong
    this.bodyGraphics.fillStyle(0xffffff, 1);
    this.bodyGraphics.fillTriangle(0, 15, -8, 30, 8, 30);
    // Cà vạt / Nơ đỏ
    this.bodyGraphics.fillStyle(0xe74c3c, 1);
    this.bodyGraphics.fillTriangle(0, 20, -5, 27, 5, 27);
    this.bodyGraphics.fillTriangle(0, 32, -4, 26, 4, 26);
    this.add(this.bodyGraphics);

    // 3. Đầu và Khuôn mặt
    this.headContainer = this.scene.add.container(0, -5);
    this.add(this.headContainer);

    this.headGraphics = this.scene.add.graphics();
    // Tóc sau
    this.headGraphics.fillStyle(0x4a2c11, 1);
    this.headGraphics.fillCircle(0, -10, 26);
    // Khuôn mặt (Màu da sáng)
    this.headGraphics.fillStyle(0xffdbac, 1);
    this.headGraphics.fillCircle(0, 0, 22);

    // Mái tóc trước
    this.headGraphics.fillStyle(0x4a2c11, 1);
    this.headGraphics.fillRoundedRect(-22, -22, 44, 15, 5);
    // Búi tóc trên đỉnh
    this.headGraphics.fillCircle(0, -28, 12);

    // Đôi mắt
    this.headGraphics.fillStyle(0x2c3e50, 1);
    this.eyeLeft = this.scene.add.ellipse(-7, -2, 4, 6, 0x2c3e50);
    this.eyeRight = this.scene.add.ellipse(7, -2, 4, 6, 0x2c3e50);
    this.headContainer.add(this.headGraphics);
    this.headContainer.add(this.eyeLeft);
    this.headContainer.add(this.eyeRight);

    // Kính mắt tri thức
    this.glasses = this.scene.add.graphics();
    this.glasses.lineStyle(2, 0xe67e22, 1);
    this.glasses.strokeCircle(-7, -2, 7);
    this.glasses.strokeCircle(7, -2, 7);
    this.glasses.lineBetween(-1, -2, 1, -2);
    this.headContainer.add(this.glasses);

    // Má hồng dễ thương
    this.blush = this.scene.add.graphics();
    this.blush.fillStyle(0xff8a80, 0.4);
    this.blush.fillCircle(-13, 6, 4);
    this.blush.fillCircle(13, 6, 4);
    this.headContainer.add(this.blush);

    // Khuôn miệng (Có thể chuyển động khi nói)
    this.mouth = this.scene.add.graphics();
    this.drawMouth('smile');
    this.headContainer.add(this.mouth);

    // 4. Tay phải cầm thước chỉ bảng
    this.armRight = this.scene.add.container(18, 20);
    this.add(this.armRight);

    this.armGraphics = this.scene.add.graphics();
    this.armGraphics.fillStyle(0x2c3e50, 1);
    this.armGraphics.fillRoundedRect(-4, 0, 8, 24, 3);
    // Bàn tay
    this.armGraphics.fillStyle(0xffdbac, 1);
    this.armGraphics.fillCircle(0, 25, 4);
    // Cây thước chỉ bảng (Màu gỗ vàng)
    this.armGraphics.lineStyle(3, 0xf39c12, 1);
    this.armGraphics.lineBetween(0, 25, 35, -20);
    this.armGraphics.fillStyle(0xe74c3c, 1);
    this.armGraphics.fillCircle(35, -20, 3); // Đầu thước đỏ
    this.armRight.add(this.armGraphics);

    // 5. Tay trái cầm cặp giáo trình
    this.armLeft = this.scene.add.container(-18, 20);
    this.add(this.armLeft);

    this.armLeftGraphics = this.scene.add.graphics();
    this.armLeftGraphics.fillStyle(0x2c3e50, 1);
    this.armLeftGraphics.fillRoundedRect(-4, 0, 8, 20, 3);
    // Cuốn sách giáo khoa trên tay
    this.armLeftGraphics.fillStyle(0x3498db, 1);
    this.armLeftGraphics.fillRoundedRect(-14, 15, 16, 20, 2);
    this.armLeftGraphics.fillStyle(0xffffff, 1);
    this.armLeftGraphics.fillRect(-12, 17, 12, 16);
    this.armLeft.add(this.armLeftGraphics);

    // 6. Huy hiệu tên "Giáo viên"
    this.nametag = this.scene.add.container(0, -45);
    const bgName = this.scene.add.graphics();
    bgName.fillStyle(0x000000, 0.65);
    bgName.fillRoundedRect(-42, -12, 84, 22, 11);
    const textName = this.scene.add.text(0, -1, 'Giáo viên', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd700',
      resolution: 2
    }).setOrigin(0.5);
    this.nametag.add(bgName);
    this.nametag.add(textName);
    this.add(this.nametag);

    // 7. Bong bóng thoại lời giảng (Speech Bubble Subtitles)
    this.speechBubble = this.scene.add.container(48, -48);
    this.speechBubble.setVisible(false);

    this.bubbleBg = this.scene.add.graphics();
    this.bubbleText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#1e293b',
      align: 'center',
      wordWrap: { width: 140 },
      resolution: 2
    }).setOrigin(0.5);

    this.speechBubble.add(this.bubbleBg);
    this.speechBubble.add(this.bubbleText);
    this.add(this.speechBubble);
  }

  drawMouth(type) {
    this.mouth.clear();
    if (type === 'smile') {
      this.mouth.lineStyle(2, 0x8d6e63, 1);
      this.mouth.beginPath();
      this.mouth.arc(0, 7, 5, 0.1 * Math.PI, 0.9 * Math.PI, false);
      this.mouth.strokePath();
    } else if (type === 'open') {
      this.mouth.fillStyle(0x8d6e63, 1);
      this.mouth.fillEllipse(0, 9, 6, 5);
      this.mouth.fillStyle(0xffcdd2, 1);
      this.mouth.fillEllipse(0, 10, 4, 3);
    } else if (type === 'o') {
      this.mouth.fillStyle(0x8d6e63, 1);
      this.mouth.fillCircle(0, 9, 4);
    }
  }

  initAnimations() {
    // 1. Hoạt ảnh thở nhẹ nhàng (Idle breathing)
    this.scene.tweens.add({
      targets: this.headContainer,
      y: -7,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. Hoạt ảnh nhịp nhịp cánh tay chỉ bảng
    this.pointerTween = this.scene.tweens.add({
      targets: this.armRight,
      angle: { from: -5, to: 10 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
    if (speaking) {
      if (!this.mouthTimer) {
        let toggle = false;
        this.mouthTimer = this.scene.time.addEvent({
          delay: 150,
          loop: true,
          callback: () => {
            if (this.isSpeaking) {
              toggle = !toggle;
              this.drawMouth(toggle ? 'open' : 'smile');
            } else {
              this.drawMouth('smile');
              if (this.mouthTimer) {
                this.mouthTimer.destroy();
                this.mouthTimer = null;
              }
            }
          }
        });
      }
    } else {
      if (this.mouthTimer) {
        this.mouthTimer.destroy();
        this.mouthTimer = null;
      }
      this.drawMouth('smile');
    }
  }

  playPraiseAnimation() {
    this.drawMouth('open');
    // Nhảy vui vẻ vỗ tay
    this.scene.tweens.add({
      targets: this,
      y: this.y - 15,
      duration: 200,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.drawMouth('smile');
      }
    });

    // Tạo các ngôi sao lấp lánh xung quanh cô giáo
    for (let i = 0; i < 5; i++) {
      const star = this.scene.add.text(
        this.x + Phaser.Math.Between(-30, 30),
        this.y - 40 + Phaser.Math.Between(-20, 20),
        '⭐',
        { fontSize: '18px' }
      ).setOrigin(0.5);

      this.scene.tweens.add({
        targets: star,
        y: star.y - 40,
        alpha: 0,
        scale: { from: 0.5, to: 1.5 },
        duration: 900,
        onComplete: () => star.destroy()
      });
    }
  }

  showSpeech(text, autoHideMs = 4000) {
    if (!text || !this.speechBubble) return;

    const shortText = text.length > 55 ? text.substring(0, 52) + '…' : text;
    this.bubbleText.setText(shortText);

    // Tính kích thước bong bóng
    const bounds = this.bubbleText.getBounds();
    const padX = 14;
    const padY = 10;
    const bw = Math.max(80, bounds.width + padX * 2);
    const bh = Math.max(34, bounds.height + padY * 2);

    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(0xffffff, 0.95);
    this.bubbleBg.lineStyle(2, 0x38bdf8, 1);
    this.bubbleBg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    this.bubbleBg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);

    // Mũi nhọn bong bóng chỉ vào cô giáo
    this.bubbleBg.fillTriangle(-bw / 4, bh / 2, -bw / 4 - 8, bh / 2 + 8, -bw / 4 + 4, bh / 2);

    this.speechBubble.setVisible(true);
    this.speechBubble.setScale(0.8);
    this.scene.tweens.add({
      targets: this.speechBubble,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    if (this.speechTimer) {
      this.speechTimer.destroy();
      this.speechTimer = null;
    }

    if (autoHideMs > 0) {
      this.speechTimer = this.scene.time.delayedCall(autoHideMs, () => {
        this.hideSpeech();
      });
    }
  }

  hideSpeech() {
    if (!this.speechBubble || !this.speechBubble.visible) return;
    this.scene.tweens.add({
      targets: this.speechBubble,
      scale: 0.8,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.speechBubble.setVisible(false);
        this.speechBubble.alpha = 1;
      }
    });
  }

  playSurpriseAnimation() {
    this.drawMouth('o');
    // Nhấc bổng biểu cảm dấu chấm than
    const mark = this.scene.add.text(this.x, this.y - 65, '❗', { fontSize: '24px' }).setOrigin(0.5);
    this.scene.tweens.add({
      targets: mark,
      y: mark.y - 20,
      alpha: 0,
      duration: 1000,
      onComplete: () => mark.destroy()
    });
  }
}

window.TeacherSprite = TeacherSprite;
