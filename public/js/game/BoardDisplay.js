/**
 * BẢNG ĐEN VÀ KHU VỰC HIỂN THỊ CÂU HỎI TRUNG TÂM (BOARD DISPLAY)
 * Thiết kế bảng phấn học đường sinh động, hiển thị câu hỏi, 4 phương án, đồng hồ đếm ngược
 */

class BoardDisplay extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, height) {
    super(scene, x, y);
    this.scene = scene;
    this.boardWidth = width || 580;
    this.boardHeight = height || 260;
    this.optionCards = [];

    this.initBoardGraphics();
    this.initTextElements();

    scene.add.existing(this);
  }

  initBoardGraphics() {
    this.graphics = this.scene.add.graphics();
    this.add(this.graphics);

    const w = this.boardWidth;
    const h = this.boardHeight;
    const hw = w / 2;
    const hh = h / 2;

    // 1. Khung gỗ bảng đen (Màu gỗ ấm)
    this.graphics.fillStyle(0x795548, 1);
    this.graphics.fillRoundedRect(-hw - 8, -hh - 8, w + 16, h + 16, 12);
    this.graphics.fillStyle(0x5d4037, 1);
    this.graphics.fillRoundedRect(-hw - 4, -hh - 4, w + 8, h + 8, 8);

    // 2. Mặt bảng đen xanh rêu trường học
    this.graphics.fillStyle(0x1e3f20, 1);
    this.graphics.fillRoundedRect(-hw, -hh, w, h, 6);

    // 3. Khay để phấn và giẻ lau bên dưới
    this.graphics.fillStyle(0x8d6e63, 1);
    this.graphics.fillRoundedRect(-hw + 20, hh + 4, w - 40, 8, 3);
    // Vài viên phấn trắng và vàng
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillRect(-30, hh + 4, 15, 4);
    this.graphics.fillStyle(0xffeb3b, 1);
    this.graphics.fillRect(-10, hh + 4, 15, 4);
    // Giẻ lau bảng
    this.graphics.fillStyle(0x424242, 1);
    this.graphics.fillRoundedRect(30, hh + 2, 25, 7, 2);
  }

  initTextElements() {
    const hw = this.boardWidth / 2;
    const hh = this.boardHeight / 2;

    // 1. Huy hiệu môn học phía trên bảng
    this.subjectBadge = this.scene.add.container(0, -hh + 18);
    this.add(this.subjectBadge);

    this.subjectBadgeBg = this.scene.add.graphics();
    this.subjectBadgeBg.fillStyle(0x3498db, 1);
    this.subjectBadgeBg.fillRoundedRect(-90, -12, 180, 24, 12);
    this.subjectBadge.add(this.subjectBadgeBg);

    this.subjectText = this.scene.add.text(0, 0, '📐 TOÁN HỌC', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.subjectBadge.add(this.subjectText);

    // 2. Nội dung câu hỏi trên bảng
    this.questionText = this.scene.add.text(0, -hh + 58, 'Chào mừng các em đến với lớp học!\nHãy bình luận VÀO LỚP để nhận chỗ ngồi.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#f1f2f6',
      align: 'center',
      wordWrap: { width: this.boardWidth - 40 }
    }).setOrigin(0.5, 0);
    this.add(this.questionText);

    // 3. Container cho các ô đáp án
    this.optionsContainer = this.scene.add.container(0, 20);
    this.add(this.optionsContainer);

    // 4. Thanh đếm ngược thời gian
    this.timerBarBg = this.scene.add.graphics();
    this.timerBarBg.fillStyle(0x000000, 0.4);
    this.timerBarBg.fillRoundedRect(-hw + 20, hh - 18, this.boardWidth - 40, 8, 4);
    this.add(this.timerBarBg);

    this.timerBar = this.scene.add.graphics();
    this.add(this.timerBar);

    this.timerText = this.scene.add.text(0, hh - 14, '⏱️ 20s', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd700'
    }).setOrigin(0.5);
    this.add(this.timerText);

    // Hướng dẫn tương tác viết phấn dưới chân bảng
    this.boardInstructionText = this.scene.add.text(0, hh - 2, '💬 Bình luận A, B, C, D trên TikTok để trả lời & ghi điểm', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#a7f3d0'
    }).setOrigin(0.5);
    this.add(this.boardInstructionText);
  }

  setSubject(subject) {
    if (!subject) return;
    this.subjectText.setText(`${subject.icon || '📚'} ${subject.name.toUpperCase()}`);
    const colorHex = subject.color ? parseInt(subject.color.replace('#', '0x')) : 0x3498db;
    this.subjectBadgeBg.clear();
    this.subjectBadgeBg.fillStyle(colorHex, 1);
    this.subjectBadgeBg.fillRoundedRect(-100, -12, 200, 24, 12);
  }

  showWelcome(subject) {
    if (subject) this.setSubject(subject);
    this.questionText.setText(`Chào mừng các em đến với tiết học môn ${subject ? subject.name : ''}!\nHãy chuẩn bị cho câu hỏi số 1 nhé.`);
    this.optionsContainer.removeAll(true);
    this.optionCards = [];
    this.timerText.setText('⏱️ Chuẩn bị...');
    this.timerBar.clear();
    if (this.boardInstructionText) {
      this.boardInstructionText.setText('💬 Bình luận JOIN hoặc VÀO LỚP để nhận chỗ ngồi & Avatar!');
    }
  }

  showQuestion(question, questionNumber) {
    this.currentQuestion = question;
    const qNum = questionNumber ? `Câu ${questionNumber}: ` : '';
    this.questionText.setText(`${qNum}${question.content}`);
    if (this.boardInstructionText) {
      this.boardInstructionText.setText('💬 Bình luận A, B, C, D trên TikTok để trả lời & ghi điểm');
    }

    // Xóa các ô đáp án cũ
    this.optionsContainer.removeAll(true);
    this.optionCards = [];

    const options = question.options || [];
    const colors = [0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71]; // Đỏ, Xanh dương, Cam, Xanh lá
    const cardW = (this.boardWidth - 50) / 2;
    const cardH = 38;

    if (options && options.length > 0) {
      options.forEach((opt, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = -this.boardWidth / 2 + 20 + col * (cardW + 10) + cardW / 2;
        const cardY = row * (cardH + 8);

        const card = this.scene.add.container(cardX, cardY);
        const cardBg = this.scene.add.graphics();
        cardBg.fillStyle(0x000000, 0.4);
        cardBg.lineStyle(2, colors[idx % colors.length], 1);
        cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
        cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);

        // Huy hiệu ký tự A, B, C, D
        const badge = this.scene.add.graphics();
        badge.fillStyle(colors[idx % colors.length], 1);
        badge.fillRoundedRect(-cardW / 2 + 5, -cardH / 2 + 5, 28, 28, 6);

        const badgeText = this.scene.add.text(-cardW / 2 + 19, 0, opt.key, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff'
        }).setOrigin(0.5);

        // Nội dung đáp án
        const optText = this.scene.add.text(-cardW / 2 + 40, 0, opt.text, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          wordWrap: { width: cardW - 50 }
        }).setOrigin(0, 0.5);

        card.add(cardBg);
        card.add(badge);
        card.add(badgeText);
        card.add(optText);

        card.optionKey = opt.key;
        card.cardBg = cardBg;
        card.cardW = cardW;
        card.cardH = cardH;

        this.optionsContainer.add(card);
        this.optionCards.push(card);
      });
    } else {
      // Dạng tự luận / điền từ
      const guideText = this.scene.add.text(0, 15, '💬 Các em hãy bình luận đáp án chính xác!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffd700'
      }).setOrigin(0.5);
      this.optionsContainer.add(guideText);
    }
  }

  updateTimer(timeRemaining, totalTime = 35) {
    this.timerText.setText(`⏱️ ${timeRemaining}s`);
    const ratio = Math.max(0, timeRemaining / totalTime);
    const maxW = this.boardWidth - 40;
    const currentW = maxW * ratio;
    const hw = this.boardWidth / 2;
    const hh = this.boardHeight / 2;

    this.timerBar.clear();
    // Đổi màu thanh đếm ngược: Xanh -> Vàng -> Đỏ khi gần hết giờ
    let barColor = 0x2ecc71;
    if (ratio < 0.25) barColor = 0xe74c3c;
    else if (ratio < 0.5) barColor = 0xf39c12;

    this.timerBar.fillStyle(barColor, 1);
    this.timerBar.fillRoundedRect(-hw + 20, hh - 18, currentW, 8, 4);
  }

  revealAnswer(correctAnswer, explanation) {
    const normCorrect = String(correctAnswer).trim().toUpperCase();

    this.optionCards.forEach(card => {
      if (String(card.optionKey).toUpperCase() === normCorrect) {
        // Làm nổi bật rực rỡ phương án đúng
        card.cardBg.clear();
        card.cardBg.fillStyle(0x27ae60, 0.95);
        card.cardBg.lineStyle(3, 0xffeb3b, 1);
        card.cardBg.fillRoundedRect(-card.cardW / 2, -card.cardH / 2, card.cardW, card.cardH, 8);
        card.cardBg.strokeRoundedRect(-card.cardW / 2, -card.cardH / 2, card.cardW, card.cardH, 8);

        // Hiệu ứng nảy ăn mừng
        this.scene.tweens.add({
          targets: card,
          scale: 1.08,
          duration: 250,
          yoyo: true,
          repeat: 3
        });
      } else {
        // Làm mờ các phương án sai
        card.alpha = 0.35;
      }
    });

    if (explanation) {
      this.timerText.setText(`💡 ${explanation}`);
    }
    if (this.boardInstructionText) {
      this.boardInstructionText.setText(`🔔 Đáp án đúng: [${normCorrect}]. Chúc mừng các bạn đúng!`);
    }
  }
}

window.BoardDisplay = BoardDisplay;
