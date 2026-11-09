/**
 * PHASER 3 CLASSROOM SCENE - KHÔNG GIAN LỚP HỌC 2D HOẠT HÌNH TOÀN DIỆN
 * Tích hợp socket.io thời gian thực, quản lý giáo viên, 24 bàn học sinh, bảng đen và bảng xếp hạng
 */

class ClassroomScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ClassroomScene' });
    this.studentSprites = new Map(); // username -> StudentSprite
    this.deskPositions = [];
    this.totalDesks = 30; // 30 học sinh (kích thước lớn, nhìn rõ ràng)
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const isPortrait = height > width;

    // 1. Vẽ phông nền lớp học (Tường, sàn gỗ, cửa sổ, trang trí)
    this.drawClassroomBackground(width, height, isPortrait);

    // 2. Tạo Bảng Đen: Căn giữa chính diện (x = 360, width = 660), không bị che khuất
    const boardW = isPortrait ? 660 : width * 0.58;
    const boardH = isPortrait ? 250 : 250;
    const boardX = isPortrait ? width / 2 : width * 0.58;
    const boardY = isPortrait ? 215 : 160;

    this.board = new BoardDisplay(this, boardX, boardY, boardW, boardH);

    // 3. Tạo Nhân vật Giáo viên 2D: Đứng trên bục giảng bên trái bảng, cạnh bảng xếp hạng
    const teacherX = isPortrait ? 135 : 140;
    const teacherY = isPortrait ? 415 : 200;
    this.teacher = new TeacherSprite(this, teacherX, teacherY);
    if (isPortrait) this.teacher.setScale(0.9);

    // Bàn giáo viên
    this.drawTeacherDesk(teacherX, teacherY + 45);

    // Đồng hồ treo tường
    this.drawWallClock(isPortrait ? width - 50 : width * 0.92, isPortrait ? 60 : 55);

    // 4. Tính toán tọa độ 40 bàn học sinh & Tạo sẵn các dãy bàn
    this.calculateDeskPositions(width, height, isPortrait);
    this.drawPreRenderedDesks(isPortrait);

    // 5. Kết nối Socket.IO
    this.initSocketConnection();

    // 6. Liên kết âm thanh và giáo viên nói
    if (window.soundManager) {
      window.soundManager.onTeacherSpeakingChange = (speaking) => {
        this.teacher.setSpeaking(speaking);
      };
    }

    // Xử lý resize layout
    this.scale.on('resize', this.handleResize, this);
  }

  drawClassroomBackground(width, height, isPortrait) {
    this.bgGraphics = this.add.graphics();

    const wallHeight = isPortrait ? 515 : height * 0.48;

    // Tường lớp học màu vàng nhạt ấm áp
    this.bgGraphics.fillStyle(0xfbf6e2, 1);
    this.bgGraphics.fillRect(0, 0, width, wallHeight);

    // Len tường gỗ
    this.bgGraphics.fillStyle(0xd4a373, 1);
    this.bgGraphics.fillRect(0, wallHeight - 12, width, 12);

    // Sàn nhà lát gỗ ấm
    this.bgGraphics.fillStyle(0xc88e58, 1);
    this.bgGraphics.fillRect(0, wallHeight, width, height - wallHeight);

    // Các đường vân kẻ sàn gỗ
    this.bgGraphics.lineStyle(1, 0xb07542, 0.6);
    for (let y = wallHeight + 25; y < height; y += 35) {
      this.bgGraphics.lineBetween(0, y, width, y);
    }

    // Khung cửa sổ đón ánh nắng (góc trên bên trái lớp học)
    const winX = isPortrait ? 55 : 90;
    const winY = isPortrait ? 60 : 75;
    this.bgGraphics.fillStyle(0x87ceeb, 1); // Bầu trời xanh
    this.bgGraphics.fillRoundedRect(winX - 25, winY - 25, 50, 50, 8);
    this.bgGraphics.fillStyle(0xffffff, 0.85); // Đám mây
    this.bgGraphics.fillCircle(winX - 6, winY - 6, 8);
    this.bgGraphics.fillCircle(winX + 5, winY - 6, 10);
    // Khung gỗ cửa sổ
    this.bgGraphics.lineStyle(3, 0x5d4037, 1);
    this.bgGraphics.strokeRoundedRect(winX - 25, winY - 25, 50, 50, 8);
    this.bgGraphics.lineBetween(winX, winY - 25, winX, winY + 25);
    this.bgGraphics.lineBetween(winX - 25, winY, winX + 25, winY);

    // Băng rôn khẩu hiệu trên tường: "HỌC TẬP THẬT TỐT - RÈN LUYỆN THẬT TỐT" (Căn giữa ngay trên bảng đen)
    const bannerX = width / 2;
    const bannerY = isPortrait ? 60 : 26;
    const banner = this.add.container(bannerX, bannerY);
    const bBg = this.add.graphics();
    bBg.fillStyle(0xc0392b, 1);
    bBg.fillRoundedRect(-140, -11, 280, 22, 6);
    bBg.lineStyle(2, 0xf1c40f, 1);
    bBg.strokeRoundedRect(-140, -11, 280, 22, 6);
    const bText = this.add.text(0, 0, '⭐ HỌC TẬP THẬT TỐT - RÈN LUYỆN THẬT TỐT ⭐', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    banner.add(bBg);
    banner.add(bText);

    // Cửa ra vào lớp học (Entrance Door) ở góc trái tường lớp học
    const doorW = isPortrait ? 46 : 56;
    const doorH = isPortrait ? 115 : 125;
    const doorX = isPortrait ? 32 : 42;
    const doorY = wallHeight - doorH / 2;

    // Khung cửa gỗ đậm
    this.bgGraphics.fillStyle(0x5d4037, 1);
    this.bgGraphics.fillRoundedRect(doorX - doorW / 2 - 4, doorY - doorH / 2 - 4, doorW + 8, doorH + 6, 4);

    // Cánh cửa gỗ màu nâu cánh gián
    this.bgGraphics.fillStyle(0x8d5524, 1);
    this.bgGraphics.fillRect(doorX - doorW / 2, doorY - doorH / 2, doorW, doorH);

    // Ô kính lấy sáng trên cánh cửa
    this.bgGraphics.fillStyle(0xa5d6a7, 0.85);
    this.bgGraphics.fillRoundedRect(doorX - doorW / 2 + 8, doorY - doorH / 2 + 10, doorW - 16, 30, 3);
    this.bgGraphics.lineStyle(2, 0x4e342e, 1);
    this.bgGraphics.strokeRoundedRect(doorX - doorW / 2 + 8, doorY - doorH / 2 + 10, doorW - 16, 30, 3);

    // Tay nắm cửa bằng đồng vàng sáng
    this.bgGraphics.fillStyle(0xf1c40f, 1);
    this.bgGraphics.fillCircle(doorX + doorW / 2 - 8, doorY + 12, 4);

    // Thảm chùi chân trước cửa
    this.bgGraphics.fillStyle(0x3e2723, 0.85);
    this.bgGraphics.fillRoundedRect(doorX - doorW / 2 - 4, wallHeight + 2, doorW + 8, 14, 3);
    this.bgGraphics.lineStyle(1, 0xd7ccc8, 0.4);
    this.bgGraphics.strokeRoundedRect(doorX - doorW / 2 - 4, wallHeight + 2, doorW + 8, 14, 3);

    // Biển hiệu "VÀO LỚP" phía trên cửa
    const doorSign = this.add.container(doorX, doorY - doorH / 2 - 14);
    const signBg = this.add.graphics();
    signBg.fillStyle(0x0f172a, 0.9);
    signBg.fillRoundedRect(-34, -9, 68, 18, 4);
    signBg.lineStyle(1.5, 0x38bdf8, 1);
    signBg.strokeRoundedRect(-34, -9, 68, 18, 4);
    const signText = this.add.text(0, 0, '🚪 VÀO LỚP', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#38bdf8'
    }).setOrigin(0.5);
    doorSign.add(signBg);
    doorSign.add(signText);

    // Dòng chữ hướng dẫn cú pháp chat ngay dưới thảm cửa
    this.add.text(doorX, wallHeight + 20, 'Chat: JOIN', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
  }

  drawTeacherDesk(x, y) {
    const tDesk = this.add.graphics();
    // Bàn làm việc bằng gỗ
    tDesk.fillStyle(0x6d4c41, 1);
    tDesk.fillRoundedRect(x - 28, y - 10, 56, 25, 4);
    // Chân bàn
    tDesk.fillStyle(0x4e342e, 1);
    tDesk.fillRect(x - 24, y + 15, 5, 25);
    tDesk.fillRect(x + 19, y + 15, 5, 25);
    // Chuông đồng để bàn
    tDesk.fillStyle(0xf1c40f, 1);
    tDesk.fillCircle(x + 14, y - 5, 4);
    // Chồng giáo án
    tDesk.fillStyle(0x3498db, 1);
    tDesk.fillRect(x - 18, y - 8, 14, 6);
    tDesk.fillStyle(0xe74c3c, 1);
    tDesk.fillRect(x - 16, y - 13, 12, 5);
  }

  drawWallClock(x, y) {
    const clock = this.add.graphics();
    clock.fillStyle(0xffffff, 1);
    clock.fillCircle(x, y, 18);
    clock.lineStyle(3, 0x2c3e50, 1);
    clock.strokeCircle(x, y, 18);
    // Kim đồng hồ
    clock.lineStyle(2, 0xe74c3c, 1);
    clock.lineBetween(x, y, x, y - 11);
    clock.lineStyle(2, 0x2c3e50, 1);
    clock.lineBetween(x, y, x + 7, y);
  }

  calculateDeskPositions(width, height, isPortrait) {
    this.deskPositions = [];
    // 30 bàn học sinh chia thành lưới đều đặn với kích thước lớn rõ nét:
    // Dọc (9:16): 6 hàng x 5 cột = 30 bàn
    // Ngang (16:9): 5 hàng x 6 cột = 30 bàn
    const rows = isPortrait ? 6 : 5;
    const cols = isPortrait ? 5 : 6;
    // Bắt đầu từ y = 540px, kết thúc ở 1040px (dành 240px phía dưới cho khung bình luận TikTok LIVE)
    const startY = isPortrait ? 540 : height * 0.48;
    const endY = isPortrait ? 1040 : height - 42;
    const ySpacing = (endY - startY) / (rows - 1);

    const marginX = isPortrait ? 65 : 70;
    const xSpacing = (width - marginX * 2) / (cols - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * xSpacing;
        const y = startY + r * ySpacing;
        this.deskPositions.push({ x, y, row: r, col: c });
      }
    }
  }

  initSocketConnection() {
    this.socket = io();

    // 1. Nhận cập nhật trạng thái lớp học
    this.socket.on('game:state', (data) => {
      if (data.subject) this.board.setSubject(data.subject);
      if (data.currentQuestion && data.state === 'QUESTION_ACTIVE') {
        this.board.showQuestion(data.currentQuestion, data.questionIndex);
      }
      this.board.updateTimer(data.timeRemaining, data.currentQuestion ? data.currentQuestion.timeLimit : 35);

      // Đồng bộ danh sách học sinh hiện có (không cần animation đi bộ nếu đã ở trong lớp)
      if (data.students && Array.isArray(data.students)) {
        data.students.forEach(st => {
          if (!this.studentSprites.has(st.username) && st.deskIndex !== -1) {
            this.addStudentToDesk(st, false);
          }
        });
      }
    });

    // 2. Bắt đầu câu hỏi mới
    this.socket.on('question:started', (data) => {
      this.board.showQuestion(data.question, data.questionNumber);
      // Đặt lại các học sinh về trạng thái ban đầu
      this.studentSprites.forEach(sprite => sprite.resetState());
    });

    // 3. Đếm ngược
    this.socket.on('question:timer', (data) => {
      this.board.updateTimer(data.timeRemaining);
    });

    // 4. Học sinh mới vào lớp (Chạy hoạt ảnh bước đi từ cửa vào bàn)
    this.socket.on('classroom:student_joined', (data) => {
      this.addStudentToDesk(data.student, true);
    });

    // 5. Học sinh trả lời câu hỏi
    this.socket.on('classroom:student_answered', (data) => {
      const sprite = this.studentSprites.get(data.username);
      if (sprite) {
        sprite.setHandRaised(data.answer);
      }
    });

    // 6. Công bố kết quả và đáp án
    this.socket.on('question:revealed', (data) => {
      this.board.revealAnswer(data.correctAnswer, data.explanation);
      
      // Cho học sinh đúng ăn mừng và cập nhật điểm tích lũy
      if (data.correctStudents) {
        data.correctStudents.forEach(item => {
          const sprite = this.studentSprites.get(item.username);
          if (sprite) {
            sprite.setCorrect(item.pointsAwarded, item.cumulativeScore);
          }
        });
      }

      // Đánh dấu sai cho các học sinh trả lời khác
      this.studentSprites.forEach((sprite, uname) => {
        const answered = data.correctStudents.find(c => c.username === uname);
        if (!answered && sprite.raisedArm.visible) {
          sprite.setWrong();
        }
      });

      // Cập nhật huy hiệu Top 1, 2, 3
      if (data.topLeaderboard) {
        this.updatePodiumCrowns(data.topLeaderboard);
      }

      // Khen thưởng từ cô giáo
      this.teacher.playPraiseAnimation();

      // Hiệu ứng pháo hoa giấy rực rỡ (Confetti) khi có người trả lời đúng
      if (data.correctStudents && data.correctStudents.length > 0) {
        this.triggerCelebrationConfetti();
      }
    });

    // 6.1. BẾ MẠC TIẾT HỌC 10 PHÚT & TUYÊN DƯƠNG TOP 3
    this.socket.on('period:summary', (data) => {
      this.showPeriodSummaryModal(data.subject, data.top3);
      this.triggerCelebrationConfetti();
      this.teacher.playPraiseAnimation();
    });

    // 6.2. ĐẾM NGƯỢC 20S GIẢI LAO
    this.socket.on('recess:timer', (data) => {
      if (this.recessText) {
        this.recessText.setText(`🏖️ GIẢI LAO THƯ GIÃN: ${data.recessTimeRemaining}s (Chuẩn bị tiết mới)`);
      }
    });

    // 6.3. BẮT ĐẦU MÔN HỌC MỚI VÀ RESET ĐIỂM
    this.socket.on('period:started', (data) => {
      this.hidePeriodSummaryModal();
      if (data.subject) this.board.showWelcome(data.subject);
      // Đặt lại điểm số trên bàn học sinh về 0 cho môn mới
      this.studentSprites.forEach(sprite => sprite.resetScore());
    });

    // 7. Học sinh rời lớp / bị kích khỏi lớp (hoạt ảnh đứng dậy bước ra cửa)
    this.socket.on('classroom:student_kicked', (data) => {
      const sprite = this.studentSprites.get(data.username);
      if (sprite) {
        const deskIdx = sprite.deskIndex;
        // Xóa khỏi danh sách quản lý ngay để nếu có học sinh mới vào thay bàn sẽ không xung đột
        this.studentSprites.delete(data.username);

        const isPortrait = this.scale.height > this.scale.width;
        const doorX = isPortrait ? 32 : 42;
        const wallHeight = isPortrait ? 515 : this.scale.height * 0.48;
        const doorY = wallHeight + 5;

        // Bàn này tạm thời đánh dấu không có người ngồi
        if (deskIdx !== undefined && this.emptyDeskVisuals && this.emptyDeskVisuals[deskIdx]) {
          this.emptyDeskVisuals[deskIdx].occupied = false;
        }

        if (typeof sprite.playWalkExit === 'function') {
          sprite.playWalkExit(doorX, doorY, () => {
            // Khi đã ra tới cửa, nếu bàn này vẫn chưa có ai ngồi vào thì hiện lại số bàn #X
            if (deskIdx !== undefined && this.emptyDeskVisuals && this.emptyDeskVisuals[deskIdx]) {
              if (!this.emptyDeskVisuals[deskIdx].occupied) {
                this.emptyDeskVisuals[deskIdx].badgeContainer.setVisible(true);
              }
            }
            sprite.destroy();
          });
        } else {
          if (deskIdx !== undefined && this.emptyDeskVisuals && this.emptyDeskVisuals[deskIdx]) {
            this.emptyDeskVisuals[deskIdx].badgeContainer.setVisible(true);
          }
          sprite.destroy();
        }
      }
    });

    // 7.0. Cập nhật Bảng xếp hạng tức thì (khi có người rời hoặc bị kick)
    this.socket.on('leaderboard:updated', (data) => {
      if (data.topLeaderboard) {
        this.updatePodiumCrowns(data.topLeaderboard);
      }
    });

    // 7.1. Làm sạch toàn bộ học sinh
    this.socket.on('classroom:reset_all_students', () => {
      this.studentSprites.forEach(sprite => sprite.destroy());
      this.studentSprites.clear();
      if (this.emptyDeskVisuals) {
        this.emptyDeskVisuals.forEach(v => {
          v.badgeContainer.setVisible(true);
          v.occupied = false;
        });
      }
    });

    // 8. Đọc giọng nói AI (Web Speech API) & Hiển thị bong bóng thoại phụ đề
    this.socket.on('tts:speak', (payload) => {
      if (this.teacher && payload.text) {
        this.teacher.showSpeech(payload.text, 5000);
      }
      if (window.soundManager) {
        window.soundManager.speak(payload.text, payload.speed, payload.pitch, payload.type);
      }
    });

    // 9. Âm thanh hiệu ứng
    this.socket.on('sound:bell', () => {
      if (window.soundManager) window.soundManager.playSchoolBell();
    });

    this.socket.on('sound:tick_fast', () => {
      if (window.soundManager) window.soundManager.playTick(true);
      this.teacher.playSurpriseAnimation();
    });

    this.socket.on('sound:reveal', () => {
      if (window.soundManager) window.soundManager.playCorrectChime();
    });

    this.socket.on('sound:victory', () => {
      if (window.soundManager) window.soundManager.playVictoryFanfare();
    });
  }

  showPeriodSummaryModal(subject, top3 = []) {
    if (this.periodSummaryModal) this.periodSummaryModal.destroy();

    const width = this.scale.width;
    const height = this.scale.height;
    const modalW = Math.min(540, width - 36);
    const modalH = 310;

    this.periodSummaryModal = this.add.container(width / 2, height * 0.38);
    this.periodSummaryModal.setDepth(100);

    // 1. Phông nền mờ
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.95);
    bg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    bg.lineStyle(3, 0xf1c40f, 1);
    bg.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    this.periodSummaryModal.add(bg);

    // 2. Tiêu đề
    const titleText = this.add.text(0, -modalH / 2 + 25, `🏆 BẾ MẠC TIẾT HỌC: ${subject ? subject.name.toUpperCase() : 'MÔN HỌC'} 🏆`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd700'
    }).setOrigin(0.5);
    this.periodSummaryModal.add(titleText);

    const subTitle = this.add.text(0, -modalH / 2 + 46, 'VINH DANH 3 HỌC SINH XUẤT SẮC NHẤT TIẾT HỌC', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#94a3b8'
    }).setOrigin(0.5);
    this.periodSummaryModal.add(subTitle);

    // 3. Bục vinh danh Podium (Top 2: Trái, Top 1: Giữa cao nhất, Top 3: Phải)
    const podiumY = 10;
    const podiumConfigs = [
      { rank: 2, label: '🥈 Á QUÂN', x: -modalW * 0.3, color: 0xbdc3c7, height: 110, item: top3[1] },
      { rank: 1, label: '👑 QUÁN QUÂN', x: 0, color: 0xf1c40f, height: 135, item: top3[0] },
      { rank: 3, label: '🥉 QUÝ QUÂN', x: modalW * 0.3, color: 0xe67e22, height: 95, item: top3[2] }
    ];

    podiumConfigs.forEach(cfg => {
      const col = this.add.container(cfg.x, podiumY);
      
      const pBox = this.add.graphics();
      pBox.fillStyle(0x1e293b, 0.9);
      pBox.lineStyle(2, cfg.color, 1);
      pBox.fillRoundedRect(-55, -cfg.height / 2, 110, cfg.height, 10);
      pBox.strokeRoundedRect(-55, -cfg.height / 2, 110, cfg.height, 10);
      col.add(pBox);

      const rTag = this.add.text(0, -cfg.height / 2 + 14, cfg.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: cfg.rank === 1 ? '#f1c40f' : (cfg.rank === 2 ? '#bdc3c7' : '#e67e22')
      }).setOrigin(0.5);
      col.add(rTag);

      const nameStr = cfg.item ? (cfg.item.displayName || cfg.item.username) : 'Trống';
      const cleanName = nameStr.length > 9 ? nameStr.substring(0, 8) + '…' : nameStr;
      const nText = this.add.text(0, 0, cleanName, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);
      col.add(nText);

      const pts = cfg.item ? `${cfg.item.totalScore}đ` : '0đ';
      const sText = this.add.text(0, 24, pts, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#2ecc71'
      }).setOrigin(0.5);
      col.add(sText);

      this.periodSummaryModal.add(col);
    });

    // 4. Dải đếm ngược giải lao 20s
    this.recessText = this.add.text(0, modalH / 2 - 25, '🏖️ GIẢI LAO THƯ GIÃN: 20s (Chuẩn bị tiết mới)', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#38bdf8'
    }).setOrigin(0.5);
    this.periodSummaryModal.add(this.recessText);

    // Hoạt ảnh bật nảy vào khung nhìn
    this.periodSummaryModal.setScale(0.5);
    this.periodSummaryModal.alpha = 0;
    this.tweens.add({
      targets: this.periodSummaryModal,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });
  }

  hidePeriodSummaryModal() {
    if (!this.periodSummaryModal) return;
    this.tweens.add({
      targets: this.periodSummaryModal,
      scale: 0.6,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (this.periodSummaryModal) {
          this.periodSummaryModal.destroy();
          this.periodSummaryModal = null;
        }
      }
    });
  }

  triggerCelebrationConfetti() {
    const colors = [0xf1c40f, 0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xe67e22];
    const width = this.scale.width;
    const height = this.scale.height;

    for (let i = 0; i < 35; i++) {
      const x = Phaser.Math.Between(width * 0.1, width * 0.9);
      const startY = height * 0.35 + Phaser.Math.Between(0, 80);
      const color = colors[i % colors.length];

      const conf = this.add.rectangle(x, startY, Phaser.Math.Between(6, 12), Phaser.Math.Between(6, 14), color);
      conf.angle = Phaser.Math.Between(0, 360);

      this.tweens.add({
        targets: conf,
        y: conf.y + Phaser.Math.Between(150, 450),
        x: conf.x + Phaser.Math.Between(-60, 60),
        angle: conf.angle + Phaser.Math.Between(180, 720),
        alpha: { from: 1, to: 0 },
        duration: Phaser.Math.Between(1400, 2400),
        ease: 'Quad.easeOut',
        onComplete: () => conf.destroy()
      });
    }
  }

  /**
   * Tạo sẵn các dãy bàn học (30 bàn) chia đều trong lớp học ngay từ khi mở game
   */
  drawPreRenderedDesks(isPortrait) {
    this.emptyDeskVisuals = [];
    const deskScale = isPortrait ? 0.98 : 1.02;

    this.deskPositions.forEach((pos, idx) => {
      const deskContainer = this.add.container(pos.x, pos.y);
      deskContainer.setScale(deskScale);
      deskContainer.setDepth(5 + Math.floor(pos.y * 0.01));

      const g = this.add.graphics();

      // 1. Tựa ghế ngồi phía sau bàn
      g.fillStyle(0x8d5524, 1);
      g.fillRoundedRect(-16, -14, 32, 12, 3);
      g.fillStyle(0x6d3c14, 1);
      g.fillRect(-14, -2, 4, 12);
      g.fillRect(10, -2, 4, 12);

      // 2. Chân bàn bằng kim loại xám
      g.fillStyle(0x7f8c8d, 1);
      g.fillRect(-30, 20, 4, 18);
      g.fillRect(26, 20, 4, 18);

      // 3. Mặt bàn gỗ bóng
      g.fillStyle(0xba7c44, 1);
      g.fillRoundedRect(-34, 10, 68, 14, 3);
      // Viền cạnh bàn
      g.fillStyle(0x8d5524, 1);
      g.fillRect(-34, 22, 68, 3);

      // 4. Cuốn vở học sinh trên bàn
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-20, 12, 16, 10, 1);
      g.fillStyle(0x3498db, 1);
      g.fillRect(-20, 12, 4, 10);

      // 5. Cốc đựng bút / bình nước
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(18, 16, 4);

      deskContainer.add(g);

      // 6. Huy hiệu số thứ tự bàn học: #1 ... #30
      const badgeContainer = this.add.container(0, 0);
      const bBg = this.add.graphics();
      bBg.fillStyle(0x000000, 0.4);
      bBg.fillRoundedRect(-18, 11, 36, 12, 4);

      const bText = this.add.text(0, 17, `#${idx + 1}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#ffd700'
      }).setOrigin(0.5);

      badgeContainer.add(bBg);
      badgeContainer.add(bText);
      deskContainer.add(badgeContainer);

      this.emptyDeskVisuals.push({
        container: deskContainer,
        badgeContainer: badgeContainer,
        occupied: false
      });
    });
  }

  /**
   * Hiệu ứng ngôi sao lấp lánh chào đón học sinh vào chỗ ngồi
   */
  createArrivalEffect(x, y) {
    const symbols = ['✨', '⭐', '🎉', '🌟'];
    for (let i = 0; i < 4; i++) {
      const offsetX = Phaser.Math.Between(-18, 18);
      const offsetY = Phaser.Math.Between(-15, 10);
      const star = this.add.text(x + offsetX, y + offsetY, symbols[i % symbols.length], {
        fontSize: '14px'
      }).setOrigin(0.5);
      star.setDepth(2000);

      this.tweens.add({
        targets: star,
        y: star.y - Phaser.Math.Between(25, 45),
        x: star.x + Phaser.Math.Between(-15, 15),
        alpha: 0,
        scale: 1.4,
        duration: 650,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      });
    }
  }

  addStudentToDesk(student, animate = true) {
    if (!student || !student.username) return;

    // Nếu học sinh đã có trên màn hình nhưng được đổi bàn (ví dụ từ hàng chờ vào bàn trống)
    if (this.studentSprites.has(student.username)) {
      const oldSprite = this.studentSprites.get(student.username);
      if (oldSprite && oldSprite.deskIndex === student.deskIndex) return;
      if (oldSprite) oldSprite.destroy();
      this.studentSprites.delete(student.username);
    }

    const deskIdx = student.deskIndex;
    if (deskIdx === undefined || deskIdx === -1 || deskIdx >= this.deskPositions.length) return;

    const pos = this.deskPositions[deskIdx];
    const isPortrait = this.scale.height > this.scale.width;
    const deskScale = isPortrait ? 0.98 : 1.02;

    const doorX = isPortrait ? 32 : 42;
    const wallHeight = isPortrait ? 515 : this.scale.height * 0.48;
    const doorY = wallHeight + 5;

    // Ẩn số thứ tự bàn học #X khi bàn này đã có học sinh ngồi
    if (this.emptyDeskVisuals && this.emptyDeskVisuals[deskIdx]) {
      this.emptyDeskVisuals[deskIdx].badgeContainer.setVisible(false);
      this.emptyDeskVisuals[deskIdx].occupied = true;
    }

    if (animate) {
      // 1. Tạo nhân vật học sinh tại Cửa lớp
      const sprite = new StudentSprite(this, doorX, doorY, student);
      sprite.setScale(deskScale);
      this.studentSprites.set(student.username, sprite);

      // Chạy hoạt ảnh bước đi nhún nhảy từ cửa vào bàn đã phân
      sprite.playWalkEntrance(doorX, doorY, pos.x, pos.y);
    } else {
      // 2. Đặt ngay vào vị trí bàn (khi đồng bộ ban đầu hoặc tải lại trang)
      const sprite = new StudentSprite(this, pos.x, pos.y, student);
      sprite.setScale(deskScale);
      sprite.setDepth(10 + Math.floor(pos.y));
      this.studentSprites.set(student.username, sprite);
    }
  }

  updatePodiumCrowns(topLeaderboard) {
    // Đặt lại huy hiệu cho tất cả học sinh
    this.studentSprites.forEach(sprite => sprite.setTopRank(0));

    topLeaderboard.forEach(entry => {
      const sprite = this.studentSprites.get(entry.username);
      if (sprite) {
        sprite.setTopRank(entry.rank);
      }
    });
  }

  handleResize(gameSize) {
    // Tự động căn chỉnh khi kích thước thay đổi
  }
}

window.ClassroomScene = ClassroomScene;
