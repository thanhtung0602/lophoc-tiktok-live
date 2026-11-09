/**
 * NHÂN VẬT HỌC SINH 2D TỰ ĐỘNG SINH HÌNH ẢNH (STUDENT SPRITE)
 * Hỗ trợ 40 học sinh: Đa dạng kiểu tóc, màu sắc, bàn ghế, huy hiệu và ẢNH ĐẠI DIỆN TRÒN (AVATAR)
 */

class StudentSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, studentData) {
    super(scene, x, y);
    this.scene = scene;
    this.studentData = studentData || {};
    let av = this.studentData.avatarStyle;
    if (typeof av === 'string') {
      try { av = JSON.parse(av); } catch (e) { av = {}; }
    }
    this.avatar = av || {};
    this.deskIndex = studentData.deskIndex || 0;
    this.currentAnswer = null;

    this.initDesk();
    this.initStudent();
    this.initAvatarPhoto();
    this.initBadge();
    this.initAnswerBubble();

    this.updateScore(studentData.score || studentData.cumulativeScore || 0);

    scene.add.existing(this);
  }

  initDesk() {
    // 1. Mặt bàn học bằng gỗ
    this.deskGraphics = this.scene.add.graphics();
    // Chân bàn
    this.deskGraphics.fillStyle(0x7f8c8d, 1);
    this.deskGraphics.fillRect(-30, 20, 4, 18);
    this.deskGraphics.fillRect(26, 20, 4, 18);

    // Mặt bàn gỗ bóng
    this.deskGraphics.fillStyle(0xba7c44, 1);
    this.deskGraphics.fillRoundedRect(-34, 10, 68, 14, 3);
    // Viền cạnh bàn
    this.deskGraphics.fillStyle(0x8d5524, 1);
    this.deskGraphics.fillRect(-34, 22, 68, 3);

    // Cuốn vở trên bàn
    this.deskGraphics.fillStyle(0xffffff, 1);
    this.deskGraphics.fillRoundedRect(-20, 12, 16, 10, 1);
    this.deskGraphics.fillStyle(0x3498db, 1);
    this.deskGraphics.fillRect(-20, 12, 4, 10);

    // Cốc đựng bút / bình nước
    this.deskGraphics.fillStyle(0xe74c3c, 1);
    this.deskGraphics.fillCircle(18, 16, 4);

    this.add(this.deskGraphics);
  }

  initStudent() {
    this.bodyContainer = this.scene.add.container(0, 0);
    this.add(this.bodyContainer);

    // Màu sắc
    const hairColorHex = this.avatar.hairColor ? parseInt(this.avatar.hairColor.replace('#', '0x')) : 0x2c3e50;
    const shirtColorHex = this.avatar.shirtColor ? parseInt(this.avatar.shirtColor.replace('#', '0x')) : 0x3498db;
    const skinColorHex = this.avatar.skinColor ? parseInt(this.avatar.skinColor.replace('#', '0x')) : 0xffdbac;

    // 0. Chân và giày học sinh (nhìn thấy rõ khi bước đi vào lớp)
    this.legs = this.scene.add.graphics();
    this.legs.fillStyle(0x1e293b, 1);
    this.legs.fillRect(-7, 15, 5, 12);
    this.legs.fillRect(2, 15, 5, 12);
    this.legs.fillStyle(0x0f172a, 1);
    this.legs.fillRoundedRect(-9, 24, 7, 5, 2);
    this.legs.fillRoundedRect(2, 24, 7, 5, 2);
    this.bodyContainer.add(this.legs);

    // 1. Áo đồng phục học sinh
    this.shirt = this.scene.add.graphics();
    this.shirt.fillStyle(shirtColorHex, 1);
    this.shirt.fillRoundedRect(-13, -2, 26, 20, 4);
    // Cổ áo trắng
    this.shirt.fillStyle(0xffffff, 1);
    this.shirt.fillTriangle(0, -2, -6, 7, 6, 7);
    this.bodyContainer.add(this.shirt);

    // 2. Đầu và khuôn mặt
    this.head = this.scene.add.container(0, -17);
    this.bodyContainer.add(this.head);

    this.faceGraphics = this.scene.add.graphics();
    // Tóc phía sau
    this.faceGraphics.fillStyle(hairColorHex, 1);
    this.faceGraphics.fillCircle(0, -5, 17);

    // Mặt
    this.faceGraphics.fillStyle(skinColorHex, 1);
    this.faceGraphics.fillCircle(0, 0, 14);

    // Kiểu tóc phía trước
    const hairStyle = this.avatar.hairStyle || 0;
    this.faceGraphics.fillStyle(hairColorHex, 1);
    if (hairStyle === 0) {
      this.faceGraphics.fillRoundedRect(-14, -14, 28, 8, 3);
    } else if (hairStyle === 1) {
      this.faceGraphics.fillTriangle(-14, -14, 0, -4, -14, 0);
      this.faceGraphics.fillTriangle(14, -14, 0, -4, 14, 0);
    } else if (hairStyle === 2) {
      this.faceGraphics.fillRoundedRect(-14, -14, 28, 7, 3);
      this.faceGraphics.fillCircle(0, -18, 7);
    } else {
      this.faceGraphics.fillRoundedRect(-15, -15, 30, 9, 3);
    }

    // Đôi mắt
    this.faceGraphics.fillStyle(0x2c3e50, 1);
    this.faceGraphics.fillCircle(-5, -1, 2);
    this.faceGraphics.fillCircle(5, -1, 2);

    // Nụ cười
    this.faceGraphics.lineStyle(1.5, 0x8d6e63, 1);
    this.faceGraphics.beginPath();
    this.faceGraphics.arc(0, 4, 3, 0.1 * Math.PI, 0.9 * Math.PI, false);
    this.faceGraphics.strokePath();

    this.head.add(this.faceGraphics);

    // 3. Tay giơ lên khi trả lời
    this.raisedArm = this.scene.add.container(13, -2);
    this.raisedArm.setVisible(false);

    const armG = this.scene.add.graphics();
    armG.fillStyle(shirtColorHex, 1);
    armG.fillRoundedRect(-3, -16, 6, 16, 2);
    armG.fillStyle(skinColorHex, 1);
    armG.fillCircle(0, -18, 4);
    this.raisedArm.add(armG);
    this.bodyContainer.add(this.raisedArm);
  }

  /**
   * ẢNH ĐẠI DIỆN TRÒN (AVATAR PHOTO) CỦA NGƯỜI CHƠI
   * Hiển thị avatar tròn sắc nét kèm viền nổi bật để người xem livestream nhận ra mình ngay lập tức
   */
  initAvatarPhoto() {
    this.avatarContainer = this.scene.add.container(0, -56);
    this.add(this.avatarContainer);

    // 1. Viền ngoài avatar
    this.avatarBorder = this.scene.add.graphics();
    this.avatarBorder.fillStyle(0xffffff, 1);
    this.avatarBorder.fillCircle(0, 0, 16);
    this.avatarBorder.lineStyle(2, 0x38bdf8, 1);
    this.avatarBorder.strokeCircle(0, 0, 16);
    this.avatarContainer.add(this.avatarBorder);

    // 2. Nền avatar mặc định
    this.avatarDisk = this.scene.add.graphics();
    const diskColor = this.avatar.shirtColor ? parseInt(this.avatar.shirtColor.replace('#', '0x')) : 0x0284c7;
    this.avatarDisk.fillStyle(diskColor, 1);
    this.avatarDisk.fillCircle(0, 0, 14);
    this.avatarContainer.add(this.avatarDisk);

    // 3. Chữ cái đại diện viết tắt hoặc emoji
    const nameStr = this.studentData.displayName || this.studentData.username || 'U';
    const initials = nameStr.substring(0, 2).toUpperCase();
    this.avatarInitial = this.scene.add.text(0, 0, initials, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.avatarContainer.add(this.avatarInitial);

    // 4. Tải ảnh đại diện thật từ URL (nếu có)
    const avatarUrl = this.studentData.avatarUrl;
    if (avatarUrl) {
      const textureKey = `av_${this.studentData.username}`;
      if (this.scene.textures.exists(textureKey)) {
        this.renderAvatarImage(textureKey);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (this.scene && this.scene.textures && !this.scene.textures.exists(textureKey)) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            // Cắt bo tròn ảnh đại diện
            ctx.beginPath();
            ctx.arc(32, 32, 30, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 0, 0, 64, 64);

            this.scene.textures.addCanvas(textureKey, canvas);
            if (this.active) this.renderAvatarImage(textureKey);
          }
        };
        img.src = avatarUrl;
      }
    }
  }

  renderAvatarImage(textureKey) {
    if (!this.avatarContainer || !this.active) return;
    if (this.avatarImageObj) this.avatarImageObj.destroy();
    if (this.avatarInitial) this.avatarInitial.setVisible(false);

    this.avatarImageObj = this.scene.add.image(0, 0, textureKey);
    this.avatarImageObj.setDisplaySize(28, 28);
    this.avatarContainer.add(this.avatarImageObj);
  }

  initBadge() {
    // Huy hiệu tên TikTok dưới chân avatar
    this.badge = this.scene.add.container(0, -38);
    this.add(this.badge);

    const nameStr = this.studentData.displayName || this.studentData.username || 'Học sinh';
    const cleanName = nameStr.length > 9 ? nameStr.substring(0, 8) + '…' : nameStr;

    this.badgeBg = this.scene.add.graphics();
    this.badgeBg.fillStyle(0x000000, 0.7);
    this.badgeBg.fillRoundedRect(-30, -8, 60, 16, 5);

    this.nameText = this.scene.add.text(0, 0, cleanName, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Vương miện cho TOP 1, 2, 3
    this.crownText = this.scene.add.text(0, -36, '👑', {
      fontSize: '15px'
    }).setOrigin(0.5).setVisible(false);

    this.badge.add(this.badgeBg);
    this.badge.add(this.nameText);
    this.badge.add(this.crownText);

    // Điểm số tích lũy hiển thị ngay trên bàn học
    this.scorePill = this.scene.add.text(0, 31, '⭐ 0đ', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.add(this.scorePill);
  }

  /**
   * KHUNG CHAT BONG BÓNG TRẢ LỜI ĐÁP ÁN (ANSWER BUBBLE)
   * Kích thước lớn, màu sắc rực rỡ theo đáp án A/B/C/D, chữ to bản, có bóng đổ và đuôi thoại
   */
  initAnswerBubble() {
    this.answerBubble = this.scene.add.container(26, -42);
    this.answerBubble.setVisible(false);

    this.bubbleGraphics = this.scene.add.graphics();
    this.answerBubble.add(this.bubbleGraphics);

    this.answerText = this.scene.add.text(0, -2, 'A', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.answerBubble.add(this.answerText);

    this.add(this.answerBubble);
  }

  drawAnswerBubble(answer) {
    const raw = String(answer || 'A').trim();
    const upper = raw.toUpperCase();

    // Màu sắc rực rỡ khớp chuẩn với màu các ô đáp án trên bảng
    let bgHex = 0x0284c7; // Mặc định xanh dương
    if (upper === 'A') bgHex = 0xe11d48;      // Đỏ tươi rực rỡ
    else if (upper === 'B') bgHex = 0x0284c7; // Xanh dương
    else if (upper === 'C') bgHex = 0xd97706; // Cam đậm
    else if (upper === 'D') bgHex = 0x16a34a; // Xanh lá
    else if (upper === '👋') bgHex = 0x475569; // Tạm biệt

    const isShort = upper.length <= 2;
    const w = isShort ? 48 : Math.max(54, upper.length * 11 + 22);
    const h = 36;
    const r = 10;

    this.bubbleGraphics.clear();

    // 1. Bóng đổ đậm bên dưới bong bóng
    this.bubbleGraphics.fillStyle(0x000000, 0.45);
    this.bubbleGraphics.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, r);

    // 2. Nền bong bóng thoại rực rỡ
    this.bubbleGraphics.fillStyle(bgHex, 1);
    this.bubbleGraphics.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // 3. Đuôi nhọn trỏ về phía học sinh
    this.bubbleGraphics.fillStyle(bgHex, 1);
    this.bubbleGraphics.fillTriangle(-12, h / 2 - 2, 0, h / 2 - 2, -14, h / 2 + 9);

    // 4. Viền trắng nổi bật tạo độ tương phản cao trên livestream
    this.bubbleGraphics.lineStyle(2.5, 0xffffff, 1);
    this.bubbleGraphics.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bubbleGraphics.strokeTriangle(-12, h / 2 - 2, 0, h / 2 - 2, -14, h / 2 + 9);

    // 5. Cập nhật font size và chữ
    this.answerText.setFontSize(isShort ? '22px' : '15px');
    this.answerText.setText(upper);
  }

  updateScore(score) {
    if (this.scorePill) {
      this.scorePill.setText(`⭐ ${score || 0}đ`);
    }
  }

  setHandRaised(answer) {
    this.currentAnswer = answer;
    this.raisedArm.setVisible(true);

    this.drawAnswerBubble(answer);
    this.answerBubble.setVisible(true);

    // Hiệu ứng bật nảy cực kỳ bắt mắt khi có câu trả lời mới
    this.answerBubble.setScale(0.2);
    this.scene.tweens.add({
      targets: this.answerBubble,
      scale: 1.18,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.answerBubble,
          scale: 1.0,
          duration: 90
        });
      }
    });

    // Hoạt ảnh vẫy tay hồi hộp
    this.scene.tweens.add({
      targets: this.raisedArm,
      angle: { from: -10, to: 10 },
      duration: 250,
      yoyo: true,
      repeat: 3
    });
  }

  setCorrect(points, cumulativeScore) {
    this.answerBubble.setVisible(false);
    this.raisedArm.setVisible(false);
    if (cumulativeScore !== undefined) {
      this.updateScore(cumulativeScore);
    }

    // Hoạt ảnh học sinh nhảy lên vui sướng
    this.scene.tweens.add({
      targets: this.bodyContainer,
      y: -12,
      duration: 180,
      yoyo: true,
      repeat: 3,
      ease: 'Back.easeOut'
    });

    // Hiện text + điểm bay lên
    const popup = this.scene.add.text(this.x, this.y - 45, `+${points || 10} ⭐`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 30,
      alpha: 0,
      duration: 1200,
      onComplete: () => popup.destroy()
    });
  }

  setWrong() {
    this.answerBubble.setVisible(false);
    this.raisedArm.setVisible(false);

    // Icon giọt mồ hôi bối rối
    const sweat = this.scene.add.text(this.x + 10, this.y - 30, '💧', {
      fontSize: '13px'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: sweat,
      y: sweat.y - 15,
      alpha: 0,
      duration: 900,
      onComplete: () => sweat.destroy()
    });
  }

  setTopRank(rank) {
    if (rank === 1) {
      this.crownText.setText('👑').setVisible(true);
      this.badgeBg.clear();
      this.badgeBg.fillStyle(0xf1c40f, 0.95); // Hoàng kim
      this.badgeBg.fillRoundedRect(-28, -7, 56, 15, 5);
      this.nameText.setColor('#2c3e50');

      // Viền vàng lấp lánh quanh avatar
      this.avatarBorder.clear();
      this.avatarBorder.fillStyle(0xfff9c4, 1);
      this.avatarBorder.fillCircle(0, 0, 16);
      this.avatarBorder.lineStyle(3, 0xf1c40f, 1);
      this.avatarBorder.strokeCircle(0, 0, 16);
    } else if (rank === 2) {
      this.crownText.setText('🥈').setVisible(true);
      this.badgeBg.clear();
      this.badgeBg.fillStyle(0xbdc3c7, 0.95);
      this.badgeBg.fillRoundedRect(-28, -7, 56, 15, 5);
      this.nameText.setColor('#2c3e50');

      this.avatarBorder.clear();
      this.avatarBorder.fillStyle(0xffffff, 1);
      this.avatarBorder.fillCircle(0, 0, 15);
      this.avatarBorder.lineStyle(2, 0xbdc3c7, 1);
      this.avatarBorder.strokeCircle(0, 0, 15);
    } else if (rank === 3) {
      this.crownText.setText('🥉').setVisible(true);
      this.badgeBg.clear();
      this.badgeBg.fillStyle(0xe67e22, 0.95);
      this.badgeBg.fillRoundedRect(-28, -7, 56, 15, 5);
      this.nameText.setColor('#ffffff');

      this.avatarBorder.clear();
      this.avatarBorder.fillStyle(0xffffff, 1);
      this.avatarBorder.fillCircle(0, 0, 15);
      this.avatarBorder.lineStyle(2, 0xe67e22, 1);
      this.avatarBorder.strokeCircle(0, 0, 15);
    } else {
      this.crownText.setVisible(false);
      this.badgeBg.clear();
      this.badgeBg.fillStyle(0x000000, 0.7);
      this.badgeBg.fillRoundedRect(-28, -7, 56, 15, 5);
      this.nameText.setColor('#ffffff');

      this.avatarBorder.clear();
      this.avatarBorder.fillStyle(0xffffff, 1);
      this.avatarBorder.fillCircle(0, 0, 14);
      this.avatarBorder.lineStyle(1.5, 0x38bdf8, 1);
      this.avatarBorder.strokeCircle(0, 0, 14);
    }
  }

  resetScore() {
    this.updateScore(0);
    this.setTopRank(0);
    this.resetState();
  }

  resetState() {
    this.raisedArm.setVisible(false);
    this.answerBubble.setVisible(false);
    if (!this.isWalking) {
      this.bodyContainer.y = 0;
      this.bodyContainer.angle = 0;
    }
  }

  /**
   * Hoạt ảnh đi bộ / chạy nhảy từ cửa lớp vào bàn học
   * @param {number} spawnX - Tọa độ X cửa lớp
   * @param {number} spawnY - Tọa độ Y cửa lớp
   * @param {number} targetX - Tọa độ X bàn học
   * @param {number} targetY - Tọa độ Y bàn học
   * @param {Function} onComplete - Callback khi đã ngồi vào chỗ
   */
  playWalkEntrance(spawnX, spawnY, targetX, targetY, onComplete) {
    this.isWalking = true;
    this.setPosition(spawnX, spawnY);
    this.setDepth(20 + Math.floor(spawnY));

    // Ẩn bàn và điểm số trong lúc đang di chuyển vào lớp
    if (this.deskGraphics) {
      if (typeof this.deskGraphics.setVisible === 'function') this.deskGraphics.setVisible(false);
      this.deskGraphics.visible = false;
    }
    if (this.scorePill) {
      if (typeof this.scorePill.setVisible === 'function') this.scorePill.setVisible(false);
      this.scorePill.visible = false;
    }
    if (this.answerBubble) {
      this.answerBubble.setVisible(false);
    }

    // Hướng nhìn nhân vật theo hướng di chuyển
    if (targetX < spawnX) {
      this.bodyContainer.scaleX = -1;
    } else {
      this.bodyContainer.scaleX = 1;
    }

    // Hoạt ảnh bước chân nhịp nhàng: nhún nhảy và nghiêng người nhẹ khi đi
    const hopTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      y: -7,
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut'
    });

    const angleTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      angle: { from: -4, to: 4 },
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Tính toán thời gian di chuyển mượt mà dựa theo quãng đường
    const dist = Phaser.Math.Distance.Between(spawnX, spawnY, targetX, targetY);
    const duration = Math.min(1600, Math.max(900, Math.floor(dist * 2.2)));

    // Tween di chuyển từ cửa tới bàn học
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Power2.easeOut',
      onUpdate: () => {
        // Cập nhật độ sâu theo trục Y (y-sorting) để đi đúng phía trước/sau các bàn khác
        this.setDepth(20 + Math.floor(this.y));
      },
      onComplete: () => {
        hopTween.stop();
        angleTween.stop();
        this.bodyContainer.y = 0;
        this.bodyContainer.angle = 0;
        this.bodyContainer.scaleX = 1;
        this.isWalking = false;
        this.setDepth(10 + Math.floor(targetY));

        // Hiện bàn và điểm số khi đã ngồi vào chỗ
        if (this.deskGraphics) {
          if (typeof this.deskGraphics.setVisible === 'function') this.deskGraphics.setVisible(true);
          this.deskGraphics.visible = true;
        }
        if (this.scorePill) {
          if (typeof this.scorePill.setVisible === 'function') this.scorePill.setVisible(true);
          this.scorePill.visible = true;
        }

        // Hoạt ảnh bật nảy vui mừng khi an tọa
        this.scene.tweens.add({
          targets: [this.bodyContainer, this.avatarContainer, this.badge],
          scaleX: 1.18,
          scaleY: 1.18,
          duration: 180,
          yoyo: true,
          ease: 'Back.easeOut'
        });

        // Hiệu ứng ngôi sao lấp lánh chào đón tại bàn
        if (this.scene && typeof this.scene.createArrivalEffect === 'function') {
          this.scene.createArrivalEffect(targetX, targetY);
        }

        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    });
  }

  /**
   * HOẠT ẢNH BƯỚC ĐI RỜI KHỎI LỚP HỌC (EXIT ANIMATION)
   * Học sinh đứng dậy rời bàn học, hiện bong bóng vẫy tay 👋, bước nhịp nhàng về phía cửa lớp rồi mờ dần
   * @param {number} doorX - Tọa độ X cửa lớp
   * @param {number} doorY - Tọa độ Y cửa lớp
   * @param {Function} onComplete - Callback khi đã ra tới cửa
   */
  playWalkExit(doorX, doorY, onComplete) {
    this.isWalking = true;

    // 1. Ẩn mặt bàn học và điểm số để nhân vật đứng dậy rời bàn
    if (this.deskGraphics) {
      if (typeof this.deskGraphics.setVisible === 'function') this.deskGraphics.setVisible(false);
      this.deskGraphics.visible = false;
    }
    if (this.scorePill) {
      if (typeof this.scorePill.setVisible === 'function') this.scorePill.setVisible(false);
      this.scorePill.visible = false;
    }

    // 2. Hiện bong bóng vẫy tay tạm biệt 👋
    if (this.answerBubble) {
      this.drawAnswerBubble('👋');
      this.answerBubble.setVisible(true);
      this.answerBubble.setScale(0);
      this.scene.tweens.add({
        targets: this.answerBubble,
        scale: 1,
        duration: 180,
        ease: 'Back.easeOut'
      });
    }

    // 3. Hướng nhìn nhân vật về phía cửa lớp
    if (doorX < this.x) {
      this.bodyContainer.scaleX = -1;
    } else {
      this.bodyContainer.scaleX = 1;
    }

    // 4. Hoạt ảnh bước chân nhịp nhàng: nhún nhảy và nghiêng người nhẹ khi đi
    const hopTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      y: -7,
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut'
    });

    const angleTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      angle: { from: -4, to: 4 },
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 5. Tính toán thời gian di chuyển mượt mà dựa theo quãng đường
    const dist = Phaser.Math.Distance.Between(this.x, this.y, doorX, doorY);
    const duration = Math.min(1500, Math.max(800, Math.floor(dist * 2.0)));

    // Hiệu ứng mờ dần (fade out) khi gần chạm cửa
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: Math.max(0, duration - 350),
      duration: 350
    });

    // 6. Tween di chuyển từ bàn về cửa ra
    this.scene.tweens.add({
      targets: this,
      x: doorX,
      y: doorY,
      duration: duration,
      ease: 'Power2.easeIn',
      onUpdate: () => {
        // Cập nhật độ sâu theo trục Y (y-sorting)
        this.setDepth(20 + Math.floor(this.y));
      },
      onComplete: () => {
        hopTween.stop();
        angleTween.stop();
        this.isWalking = false;
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    });
  }
}

window.StudentSprite = StudentSprite;
