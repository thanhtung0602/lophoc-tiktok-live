const EventEmitter = require('events');
const db = require('../database/db');
const scoreService = require('./scoreService');
const ttsService = require('./ttsService');
const aiQuestionService = require('./aiQuestionService');
const config = require('../config/config');

const SAMPLE_BOT_NAMES = [
  'nguyen_van_an', 'mai_anh_cute', 'minh_khoi_pro', 'hoang_long_99',
  'thu_thao_hn', 'quang_huy_top1', 'lan_huong_2k', 'duc_thang_vip',
  'bao_chau_dn', 'tuan_kiet_sg', 'phuong_thao_hp', 'hai_dang_vn',
  'thanh_hang_vt', 'viet_anh_nb', 'thuy_tien_ct', 'xuan_bac_hn',
  'diep_anh_sg', 'hong_phuc_hue', 'gia_huy_dalat', 'cam_tu_qn',
  'khanh_linh_nt', 'bao_nam_bd', 'thanh_truc_ag', 'quoc_bao_la',
  'ngoc_huyen_hd', 'tien_dung_tb', 'kim_ngan_qn', 'huu_thang_na',
  'my_duyen_bt', 'trong_nghia_ld', 'anh_thu_cm', 'hoang_nam_pt',
  'tra_my_gl', 'duc_anh_qb', 'yen_nhi_qt', 'phuc_thinh_py',
  'quynh_chi_tn', 'tuan_anh_vp', 'minh_thu_bn', 'huy_hoang_bg',
  'nhat_minh_ls', 'thanh_huong_cb', 'quang_minh_bk', 'van_hau_hg',
  'ha_my_hn', 'quoc_tuan_sg', 'thanh_tung_dn', 'bich_ngoc_hp',
  'quang_hai_vn', 'tien_linh_bd', 'van_toan_hd', 'cong_phuong_gl',
  'bao_anh_dna', 'phuong_ly_hn', 'hoang_bach_sg', 'minh_chau_vt'
];

class GameEngine extends EventEmitter {
  constructor() {
    super();
    this.io = null;
    this.state = 'WAITING'; // 'WAITING', 'QUESTION_ACTIVE', 'REVEAL', 'PERIOD_SUMMARY', 'RECESS', 'PAUSED'
    this.currentSession = null;
    this.currentSubject = null;
    this.allSubjects = [];
    this.currentSubjectIndex = 0;

    this.questionsQueue = [];
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.timeRemaining = 0;
    this.timerInterval = null;
    this.questionStartTime = 0;

    // Quản lý bàn học trong lớp (30 học sinh trên màn hình 2D)
    this.maxDesks = config.game.maxClassCapacity || 30;
    this.desks = new Array(this.maxDesks).fill(null); // index -> student object
    this.students = new Map(); // username -> student object
    this.waitingQueue = []; // Người chơi xếp hàng khi lớp đầy

    // Lịch sử trả lời của câu hỏi hiện tại
    this.currentQuestionAnswers = new Map(); // playerId -> { answer, time, isCorrect }

    // Quản lý đếm giờ trả lời tự động của bot
    this.botAnswerTimers = [];

    // Ngăn chặn lặp lại câu hỏi: theo dõi câu hỏi đã được hỏi theo từng môn học
    // key: subjectId, value: Set<questionId>
    this.usedQuestionIds = new Map();

    // Chế độ Tự Động Hoàn Toàn (Autopilot / Treo LIVE)
    this.autopilot = config.game.autopilot !== false; // true mặc định
    this.periodDuration = config.game.periodDuration || 600; // 10 phút = 600 giây
    this.recessDuration = config.game.recessDuration || 20;  // 20 giây giải lao
    this.revealDelay = config.game.revealDelay || 12;        // 12 giây công bố và đọc trọn vẹn Top 3 trước khi tự chuyển câu
    this.periodTimeRemaining = this.periodDuration;
    this.recessTimeRemaining = 0;
    this.periodEnded = false;

    // Tự động phát hiện người xem lướt sang video khác (AFK / Không tương tác)
    this.autoKickOnSwipe = config.game.autoKickOnSwipe !== false;
    this.maxInactiveQuestions = config.game.maxInactiveQuestions || 1;

    this.periodTimerInterval = null;
    this.recessTimerInterval = null;
    this.autoNextTimeout = null;

    // Đảm bảo ngữ cảnh 'this' luôn chính xác
    this.handlePlayerJoin = this.handlePlayerJoin.bind(this);
    this.handlePlayerAnswer = this.handlePlayerAnswer.bind(this);
    this.kickPlayer = this.kickPlayer.bind(this);
    this.kickRandomPlayer = this.kickRandomPlayer.bind(this);
    this.clearOnlyBots = this.clearOnlyBots.bind(this);
    this.scheduleBotAnswers = this.scheduleBotAnswers.bind(this);
    this.clearBotAnswerTimers = this.clearBotAnswerTimers.bind(this);
    this.recordUserActivity = this.recordUserActivity.bind(this);
    this.emitToUser = this.emitToUser.bind(this);
    this.broadcastTTS = this.broadcastTTS.bind(this);
    this.broadcastState = this.broadcastState.bind(this);
  }

  setSocketIO(io) {
    this.io = io;
  }

  // Thuật toán xáo trộn Fisher-Yates không thiên vị (Unbiased Shuffle)
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Quản lý hàng đợi câu hỏi: Đảo lộn thứ tự ngẫu nhiên & Đảm bảo KHÔNG BỊ LẶP LẠI
  getNonRepeatingShuffledQuestions(subjectId, allQuestions) {
    if (!allQuestions || allQuestions.length === 0) return [];

    if (!this.usedQuestionIds.has(subjectId)) {
      this.usedQuestionIds.set(subjectId, new Set());
    }
    const usedSet = this.usedQuestionIds.get(subjectId);

    // Lọc ra các câu hỏi chưa từng được hỏi trong chu kỳ ngân hàng câu hỏi môn này
    let available = allQuestions.filter(q => !usedSet.has(q.id));

    // Nếu đã dùng hết toàn bộ ngân hàng câu hỏi (ví dụ hỏi hết trọn bộ 100 câu), tự động làm mới chu kỳ
    if (available.length === 0) {
      console.log(`[GameEngine] 🔁 Đã dùng hết toàn bộ ${allQuestions.length} câu hỏi môn #${subjectId}! Tự động làm mới chu kỳ câu hỏi.`);
      usedSet.clear();
      available = [...allQuestions];
    }

    // Xáo trộn ngẫu nhiên thứ tự câu hỏi bằng thuật toán Fisher-Yates
    return this.shuffleArray(available);
  }

  // Đặt lại lịch sử câu hỏi nếu cần
  resetQuestionHistory(subjectId = null) {
    if (subjectId) {
      if (this.usedQuestionIds.has(subjectId)) {
        this.usedQuestionIds.get(subjectId).clear();
      }
    } else {
      this.usedQuestionIds.clear();
    }
    console.log(`[GameEngine] Đã đặt lại lịch sử câu hỏi không lặp lại (Môn: ${subjectId || 'Tất cả'}).`);
  }

  async startNewSession(subjectId = null, title = 'Lớp Học Vui Nhộn TikTok LIVE') {
    this.allSubjects = await db.getSubjects();
    if (this.allSubjects.length === 0) {
      await db.initialize();
      this.allSubjects = await db.getSubjects();
    }

    if (subjectId) {
      const idx = this.allSubjects.findIndex(s => s.id === parseInt(subjectId, 10));
      this.currentSubjectIndex = idx !== -1 ? idx : 0;
    }
    this.currentSubject = this.allSubjects[this.currentSubjectIndex];

    this.currentSession = await db.createSession(title, this.currentSubject.id);

    // Nạp câu hỏi theo môn học: Xáo trộn Fisher-Yates & Không lặp lại
    const questions = await db.getQuestionsBySubject(this.currentSubject.id);
    this.questionsQueue = this.getNonRepeatingShuffledQuestions(this.currentSubject.id, questions);
    this.currentQuestionIndex = 0;
    this.state = 'WAITING';

    // Đặt lại đồng hồ tiết học 10 phút
    this.periodTimeRemaining = this.periodDuration;
    this.periodEnded = false;
    this.startPeriodTimer();

    console.log(`[GameEngine] Bắt đầu phiên học mới #${this.currentSession.id} môn ${this.currentSubject.name} (Thời lượng: ${this.periodDuration}s, Tự động: ${this.autopilot})`);

    this.broadcastState();

    // Giáo viên đọc lời chào mở đầu
    const welcomeText = ttsService.generateWelcomeScript(this.currentSubject.name);
    this.broadcastTTS(welcomeText, 'welcome');

    // Nếu ở chế độ Autopilot, tự động bắt đầu câu hỏi đầu tiên sau 4.8 giây (chờ cô giáo chào xong)
    if (this.autopilot) {
      if (this.autoNextTimeout) clearTimeout(this.autoNextTimeout);
      this.autoNextTimeout = setTimeout(() => {
        this.startNextQuestion();
      }, 4800);
    }

    return this.currentSession;
  }

  // Đồng hồ đếm 10 phút của một tiết học
  startPeriodTimer() {
    if (this.periodTimerInterval) clearInterval(this.periodTimerInterval);
    this.periodTimerInterval = setInterval(async () => {
      if (this.state === 'PAUSED' || this.state === 'RECESS' || this.state === 'PERIOD_SUMMARY') return;

      if (this.periodTimeRemaining > 0) {
        this.periodTimeRemaining -= 1;
        if (this.io) {
          this.io.emit('period:timer', {
            periodTimeRemaining: this.periodTimeRemaining,
            periodDuration: this.periodDuration
          });
        }
      } else {
        // Hết 10 phút tiết học!
        this.periodEnded = true;
        // Nếu không có câu hỏi đang trả lời dở, chuyển sang bế mạc và giải lao ngay
        if (this.state !== 'QUESTION_ACTIVE') {
          await this.endPeriodAndCelebrate();
        }
      }
    }, 1000);
  }

  broadcastState() {
    if (!this.io) return;
    const payload = {
      state: this.state,
      session: this.currentSession,
      subject: this.currentSubject,
      questionIndex: this.currentQuestionIndex,
      totalQuestions: this.questionsQueue.length,
      currentQuestion: this.currentQuestion ? {
        id: this.currentQuestion.id,
        questionType: this.currentQuestion.questionType,
        difficulty: this.currentQuestion.difficulty,
        content: this.currentQuestion.content,
        timeLimit: this.currentQuestion.timeLimit,
        options: this.currentQuestion.options ? this.currentQuestion.options.map(o => ({ key: o.key, text: o.text })) : []
      } : null,
      timeRemaining: this.timeRemaining,
      periodTimeRemaining: this.periodTimeRemaining,
      periodDuration: this.periodDuration,
      recessTimeRemaining: this.recessTimeRemaining,
      autopilot: this.autopilot,
      totalStudents: this.students.size,
      activeDesksCount: this.desks.filter(d => d !== null).length,
      queueCount: this.waitingQueue.length,
      maxClassCapacity: this.maxDesks,
      autoKickOnSwipe: this.autoKickOnSwipe,
      maxInactiveQuestions: this.maxInactiveQuestions,
      answersCount: this.currentQuestionAnswers.size,
      students: Array.from(this.students.values()).map(s => ({
        username: s.username,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        avatarStyle: s.avatarStyle,
        deskIndex: s.deskIndex,
        score: s.score || 0,
        currentScore: s.score || 0,
        cumulativeScore: s.score || 0
      }))
    };
    this.io.emit('game:state', payload);
  }

  broadcastTTS(text, type = 'speech') {
    if (!this.io) return;
    const speech = ttsService.getSpeechPayload(text, type);
    this.io.emit('tts:speak', speech);
  }

  // Phát sự kiện Socket.IO có thông tin người dùng
  emitToUser(username, event, payload = {}) {
    try {
      if (!this.io) return;
      this.io.emit(event, { username, ...payload });
    } catch (e) {
      console.error('[GameEngine] Lỗi emitToUser:', e.message);
    }
  }

  // Người xem tham gia vào lớp học
  async handlePlayerJoin(userData) {
    try {
      const { username, displayName, userId, avatarUrl } = userData;
      if (!username) return;

      // Kiểm tra xem đã trong lớp chưa (tránh lỗi lặp lại khi người xem bình luận JOIN nhiều lần)
      if (this.students.has(username)) {
        const existing = this.students.get(username);
        const statusMsg = existing.deskIndex !== -1
          ? 'Em đã có chỗ ngồi trong lớp rồi nhé!'
          : `Em đang ở hàng chờ vị trí #${this.waitingQueue.findIndex(s => s.username === username) + 1} nhé!`;
        this.emitToUser(username, 'join:status', { message: statusMsg, deskIndex: existing.deskIndex });
        if (this.io) {
          this.io.emit('classroom:join_status', {
            username,
            message: statusMsg,
            deskIndex: existing.deskIndex
          });
          // Nếu học sinh đã có bàn, phát lại classroom:student_joined để client chắc chắn hiển thị animation/vị trí bàn
          if (existing.deskIndex !== -1) {
            this.io.emit('classroom:student_joined', {
              student: existing,
              message: `Chào mừng ${existing.displayName} vào lớp học!`
            });
          }
        }
        return;
      }

      const safeAvatarUrl = avatarUrl || userData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username)}&background=random&color=fff&size=128&bold=true`;
      const playerRecord = await db.findOrCreatePlayer(userId || username, username, displayName, null, safeAvatarUrl);

      // Tìm bàn trống đầu tiên trong 30 bàn
      let assignedDesk = -1;
      for (let i = 0; i < this.maxDesks; i++) {
        if (this.desks[i] === null) {
          assignedDesk = i;
          break;
        }
      }

      let isBot = false;
      if (userData.isBot === true) {
        isBot = true;
      } else if (userData.isBot === false) {
        isBot = false;
      } else if (userId && String(userId).startsWith('sim_')) {
        isBot = true;
      } else if (username && (username.startsWith('bot_') || username.startsWith('hoc_sinh_') || SAMPLE_BOT_NAMES.includes(username))) {
        isBot = true;
      }

      const studentObj = {
        playerId: playerRecord.id,
        userId: playerRecord.tiktokUserId,
        username: playerRecord.tiktokUsername,
        displayName: playerRecord.displayName,
        avatarStyle: playerRecord.avatarStyle || playerRecord.AvatarStyleJson,
        avatarUrl: safeAvatarUrl,
        deskIndex: assignedDesk,
        score: 0,
        streak: 0,
        status: 'idle',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        missedQuestions: 0,
        joinedQuestionIndex: this.currentQuestionIndex,
        joinedTimeRemaining: this.state === 'QUESTION_ACTIVE' ? this.timeRemaining : 999,
        isBot
      };

      if (assignedDesk !== -1) {
        this.desks[assignedDesk] = studentObj;
        this.students.set(username, studentObj);

        console.log(`[GameEngine] Học sinh @${username} đã vào bàn số ${assignedDesk + 1}!`);

        if (this.io) {
          this.io.emit('classroom:student_joined', {
            student: studentObj,
            message: `Chào mừng ${studentObj.displayName} vào lớp học!`
          });
        }
      } else {
        // Lớp đã đầy 30 bạn, đưa vào hàng chờ
        this.waitingQueue.push(studentObj);
        this.students.set(username, studentObj);
        console.log(`[GameEngine] Lớp đã đầy ${this.maxDesks} bạn. @${username} đang ở hàng chờ vị trí #${this.waitingQueue.length}`);

        if (this.io) {
          this.io.emit('classroom:student_queued', {
            student: studentObj,
            queuePosition: this.waitingQueue.length
          });
        }
      }

      this.broadcastState();
    } catch (err) {
      console.error('[GameEngine] Lỗi xử lý handlePlayerJoin:', err.message);
    }
  }

  // Bắt đầu một câu hỏi mới
  async startNextQuestion() {
    if (this.state === 'RECESS' || this.state === 'PERIOD_SUMMARY') return false;

    // Nếu hết câu hỏi, tự động bổ sung liên tục để không bao giờ bị dừng
    if (this.questionsQueue.length === 0 || this.currentQuestionIndex >= this.questionsQueue.length) {
      console.log(`[GameEngine] Tự động nạp thêm câu hỏi cho môn ${this.currentSubject ? this.currentSubject.name : ''}...`);
      const more = await db.getQuestionsBySubject(this.currentSubject ? this.currentSubject.id : null);
      if (more.length > 0) {
        this.questionsQueue = this.getNonRepeatingShuffledQuestions(this.currentSubject ? this.currentSubject.id : null, more);
        this.currentQuestionIndex = 0;
      }
    }

    if (this.questionsQueue.length === 0) {
      console.log('[GameEngine] Chưa có câu hỏi nào trong hệ thống!');
      return false;
    }

    this.currentQuestion = this.questionsQueue[this.currentQuestionIndex];
    this.currentQuestionIndex += 1;
    this.currentQuestionAnswers.clear();

    // Đánh dấu câu hỏi này đã sử dụng để không bị lặp lại trong chu kỳ
    if (this.currentSubject && this.currentQuestion && this.currentQuestion.id) {
      if (!this.usedQuestionIds.has(this.currentSubject.id)) {
        this.usedQuestionIds.set(this.currentSubject.id, new Set());
      }
      this.usedQuestionIds.get(this.currentSubject.id).add(this.currentQuestion.id);
    }
    const defaultDuration = config.game.defaultQuestionDuration || 35;
    this.timeRemaining = Math.max(defaultDuration, this.currentQuestion.timeLimit || defaultDuration);
    this.questionStartTime = Date.now();
    this.state = 'QUESTION_ACTIVE';

    // Đặt lại trạng thái giơ tay của học sinh
    this.desks.forEach(s => {
      if (s) s.status = 'idle';
    });

    console.log(`[GameEngine] [TỰ ĐỘNG] CÂU HỎI #${this.currentQuestionIndex}: ${this.currentQuestion.content}`);

    // Phát âm thanh chuông vào câu hỏi
    if (this.io) {
      this.io.emit('sound:bell');
      this.io.emit('question:started', {
        questionNumber: this.currentQuestionIndex,
        question: {
          id: this.currentQuestion.id,
          questionType: this.currentQuestion.questionType,
          difficulty: this.currentQuestion.difficulty,
          content: this.currentQuestion.content,
          options: this.currentQuestion.options,
          timeLimit: this.timeRemaining
        }
      });
    }

    // Giáo viên AI đọc câu hỏi
    const speech = ttsService.generateQuestionScript(this.currentQuestion, this.currentQuestionIndex);
    this.broadcastTTS(speech.fullScript, 'question');

    this.broadcastState();

    // Tự động lên lịch cho tất cả học sinh ảo trong lớp trả lời ngẫu nhiên rải rác
    this.scheduleBotAnswers();

    // Bắt đầu đồng hồ đếm ngược từng giây
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state !== 'QUESTION_ACTIVE') return;

      this.timeRemaining -= 1;

      // Cảnh báo 5 giây cuối
      if (this.timeRemaining === 5) {
        if (this.io) this.io.emit('sound:tick_fast');
        const warningSpeech = ttsService.generateWarning5sScript();
        this.broadcastTTS(warningSpeech, 'warning');
      }

      if (this.io) {
        this.io.emit('question:timer', { timeRemaining: this.timeRemaining });
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.resolveQuestion();
      }
    }, 1000);

    return true;
  }

  // Xử lý câu trả lời từ người xem
  async handlePlayerAnswer(userData) {
    try {
      if (this.state !== 'QUESTION_ACTIVE' || !this.currentQuestion) return;

      const { username, answer } = userData;
      if (!username || answer === undefined) return;
      let student = this.students.get(username);
      // Nếu người xem chưa gõ JOIN mà trả lời ngay A, B, C, D -> tự động cho vào lớp luôn
      if (!student) {
        await this.handlePlayerJoin(userData);
        student = this.students.get(username);
      }
      if (!student) return;

      if (this.currentQuestionAnswers.has(student.playerId)) {
        if (!config.game.scoring.allowChangeAnswer) {
          return;
        }
      }

      const responseTime = Math.max(0.5, (Date.now() - this.questionStartTime) / 1000);
      const normalizedAns = String(answer).trim().toUpperCase();
      const correctAns = String(this.currentQuestion.correctAnswer).trim().toUpperCase();
      const isCorrect = normalizedAns === correctAns;

      this.currentQuestionAnswers.set(student.playerId, {
        student,
        answer: normalizedAns,
        responseTime,
        isCorrect
      });

      student.status = 'hand_raised';
      student.lastActiveAt = Date.now();
      student.missedQuestions = 0;

      if (this.io) {
        this.io.emit('classroom:student_answered', {
          deskIndex: student.deskIndex,
          username: student.username,
          answer: normalizedAns,
          answersCount: this.currentQuestionAnswers.size
        });
      }
    } catch (err) {
      console.error('[GameEngine] Lỗi handlePlayerAnswer:', err.message);
    }
  }

  // Ghi nhận tương tác từ người xem (chat, like, gift) để không bị tính là lướt live
  recordUserActivity(username) {
    if (!username) return;
    const student = this.students.get(username);
    if (student) {
      student.lastActiveAt = Date.now();
      student.missedQuestions = 0;
    }
  }

  // Tự động kiểm tra và cho rời lớp đối với những người chơi đã lướt sang video khác (AFK / Không trả lời)
  async checkInactiveStudents() {
    const inactiveUsernames = [];

    for (let i = 0; i < this.maxDesks; i++) {
      const student = this.desks[i];
      if (!student) continue;

      // Nếu học sinh vừa vào lớp ở đúng câu hỏi hiện tại:
      // Chỉ cho qua nếu khi vào lớp câu hỏi chỉ còn dưới 10 giây (để kịp làm quen)
      if (student.joinedQuestionIndex === this.currentQuestionIndex) {
        const remaining = student.joinedTimeRemaining !== undefined ? student.joinedTimeRemaining : 0;
        if (remaining < 10) {
          continue;
        }
      }

      // Kiểm tra xem học sinh có trả lời câu hỏi hiện tại hoặc có tương tác sau khi câu hỏi bắt đầu không
      const hasAnswered = this.currentQuestionAnswers.has(student.playerId);
      const activityBaseline = Math.max(this.questionStartTime || 0, student.joinedAt || 0);
      const hasRecentActivity = (student.lastActiveAt || 0) > activityBaseline;

      if (hasAnswered || hasRecentActivity) {
        student.missedQuestions = 0;
      } else {
        student.missedQuestions = (student.missedQuestions || 0) + 1;
        if (student.missedQuestions >= this.maxInactiveQuestions) {
          inactiveUsernames.push(student.username);
        }
      }
    }

    if (inactiveUsernames.length > 0) {
      console.log(`[GameEngine] 📱 Tự động phát hiện ${inactiveUsernames.length} bạn lướt sang video khác/không trả lời -> Tự động cho rời lớp:`, inactiveUsernames.join(', '));
      for (const uname of inactiveUsernames) {
        await this.kickPlayer(uname);
      }
    }
  }

  // Hết giờ câu hỏi: Công bố đáp án, TÍCH LŨY CỘNG DỒN ĐIỂM SỐ, và TỰ ĐỘNG CHUYỂN CÂU
  async resolveQuestion() {
    this.clearBotAnswerTimers();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.state = 'REVEAL';
    console.log(`[GameEngine] HẾT GIỜ! Đáp án: ${this.currentQuestion.correctAnswer}`);

    const correctStudents = [];
    const sessionId = this.currentSession ? this.currentSession.id : 1;

    for (const [playerId, ansData] of this.currentQuestionAnswers.entries()) {
      const { student, answer, responseTime, isCorrect } = ansData;

      const scoreResult = scoreService.calculateScore(
        isCorrect,
        responseTime,
        this.currentQuestion.timeLimit,
        student.streak
      );

      // CỘNG DỒN TỔNG ĐIỂM NGƯỜI CHƠI (Tích lũy suốt cả tiết học 10 phút)
      student.score += scoreResult.totalPoints;
      student.streak = scoreResult.newStreak;
      student.status = isCorrect ? 'correct' : 'wrong';

      if (isCorrect) {
        correctStudents.push({
          username: student.username,
          displayName: student.displayName,
          deskIndex: student.deskIndex,
          pointsAwarded: scoreResult.totalPoints,
          cumulativeScore: student.score,
          speedBonus: scoreResult.speedBonus,
          streak: student.streak
        });
      }

      await db.recordPlayerAnswer(
        sessionId,
        this.currentQuestion.id,
        playerId,
        answer,
        isCorrect,
        responseTime,
        scoreResult.totalPoints
      );

      await db.updateLeaderboard(
        sessionId,
        playerId,
        scoreResult.totalPoints,
        isCorrect,
        responseTime
      );
    }

    // 2. TỰ ĐỘNG PHÁT HIỆN NGƯỜI CHƠI LƯỚT SANG VIDEO KHÁC (AFK / KHÔNG TRẢ LỜI CÂU HỎI)
    if (this.autoKickOnSwipe) {
      await this.checkInactiveStudents();
    }

    // 3. Bảng xếp hạng Top 10 tích lũy suốt môn học (chỉ bao gồm những bạn đang có mặt)
    const topLeaderboard = await db.getTopLeaderboard(sessionId, 10);

    if (this.io) {
      this.io.emit('sound:reveal');
      this.io.emit('question:revealed', {
        questionId: this.currentQuestion.id,
        correctAnswer: this.currentQuestion.correctAnswer,
        explanation: this.currentQuestion.explanation,
        correctStudents,
        topLeaderboard
      });
    }

    const revealSpeech = ttsService.generateRevealScript(this.currentQuestion, correctStudents, topLeaderboard);
    this.broadcastTTS(revealSpeech, 'reveal');

    this.broadcastState();

    // CHẾ ĐỘ AUTOPILOT (TREO LIVE): Tự động đếm đủ thời gian để AI đọc trọn vẹn toàn bộ đáp án và Top 3 rồi mới tự chuyển câu
    const estimatedSpeechTime = Math.ceil(revealSpeech.length / 12) + 3; // ~12 ký tự/giây + 3 giây đệm an toàn
    const delaySeconds = Math.max(this.revealDelay || 12, Math.min(22, estimatedSpeechTime));

    if (this.autopilot) {
      if (this.autoNextTimeout) clearTimeout(this.autoNextTimeout);
      this.autoNextTimeout = setTimeout(async () => {
        if (this.state !== 'REVEAL') return;

        // Nếu đã hết thời gian tiết học 10 phút -> bế mạc môn và giải lao 20s
        if (this.periodTimeRemaining <= 0 || this.periodEnded) {
          await this.endPeriodAndCelebrate();
        } else {
          // Ngược lại, tự động vào câu hỏi tiếp theo
          this.startNextQuestion();
        }
      }, delaySeconds * 1000);
    }
  }

  // KẾT THÚC 10 PHÚT TIẾT HỌC: VINH DANH TOP 3 XUẤT SẮC NHẤT & BẮT ĐẦU 20S GIẢI LAO
  async endPeriodAndCelebrate() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.autoNextTimeout) clearTimeout(this.autoNextTimeout);

    this.state = 'PERIOD_SUMMARY';
    const sessionId = this.currentSession ? this.currentSession.id : 1;

    // Lấy 3 người chơi có tổng điểm cao nhất môn học
    const top3 = await db.getTopLeaderboard(sessionId, 3);
    console.log(`[GameEngine] 🏆 KẾT THÚC TIẾT HỌC MÔN ${this.currentSubject.name}! TOP 3:`, top3.map(t => `#${t.rank} ${t.displayName}: ${t.totalScore}đ`).join(' | '));

    // Chuông bế mạc và nhạc chiến thắng
    if (this.io) {
      this.io.emit('sound:bell');
      this.io.emit('sound:victory');
      this.io.emit('period:summary', {
        subject: this.currentSubject,
        top3,
        recessDuration: this.recessDuration
      });
    }

    // Cô giáo AI xướng danh chúc mừng Top 3 và thông báo 20 giây giải lao
    const summarySpeech = ttsService.generatePeriodSummaryScript(this.currentSubject.name, top3);
    this.broadcastTTS(summarySpeech, 'period_summary');

    this.broadcastState();

    // Bắt đầu đếm ngược 20 giây giải lao (RECESS)
    this.state = 'RECESS';
    this.recessTimeRemaining = this.recessDuration;

    if (this.recessTimerInterval) clearInterval(this.recessTimerInterval);
    this.recessTimerInterval = setInterval(async () => {
      this.recessTimeRemaining -= 1;

      if (this.io) {
        this.io.emit('recess:timer', { recessTimeRemaining: this.recessTimeRemaining });
      }

      if (this.recessTimeRemaining <= 0) {
        clearInterval(this.recessTimerInterval);
        this.recessTimerInterval = null;
        // Hết 20s giải lao: Tự động chuyển sang môn học tiếp theo và RESET ĐIỂM
        await this.rotateToNextSubject();
      }
    }, 1000);
  }

  // CHUYỂN SANG MÔN HỌC MỚI & RESET ĐIỂM SỐ BẮT ĐẦU VÒNG ĐUA MỚI
  async rotateToNextSubject() {
    if (this.allSubjects.length === 0) {
      this.allSubjects = await db.getSubjects();
    }

    // Chuyển sang môn tiếp theo trong danh sách 15 môn
    this.currentSubjectIndex = (this.currentSubjectIndex + 1) % this.allSubjects.length;
    this.currentSubject = this.allSubjects[this.currentSubjectIndex];

    console.log(`[GameEngine] 🔄 CHUYỂN TIẾT HỌC MỚI: Môn ${this.currentSubject.name}. Đặt lại điểm số các học sinh về 0!`);

    // RESET ĐIỂM SỐ CỦA TẤT CẢ HỌC SINH VỀ 0 ĐỂ BẮT ĐẦU MÔN HỌC MỚI
    this.desks.forEach(student => {
      if (student) {
        student.score = 0;
        student.streak = 0;
        student.status = 'idle';
      }
    });

    // Tạo phiên học mới cho môn này trong DB
    this.currentSession = await db.createSession(`Tiết ${this.currentSubject.name}`, this.currentSubject.id);

    // Nạp câu hỏi môn mới: Xáo trộn Fisher-Yates & Không lặp lại
    const questions = await db.getQuestionsBySubject(this.currentSubject.id);
    this.questionsQueue = this.getNonRepeatingShuffledQuestions(this.currentSubject.id, questions);
    this.currentQuestionIndex = 0;

    // Đặt lại thời gian tiết học 10 phút
    this.periodTimeRemaining = this.periodDuration;
    this.periodEnded = false;
    this.state = 'WAITING';
    this.startPeriodTimer();

    // Thông báo mở màn tiết mới
    if (this.io) {
      this.io.emit('sound:bell');
      this.io.emit('period:started', { subject: this.currentSubject });
    }

    const nextWelcome = ttsService.generateRecessEndScript(this.currentSubject.name);
    this.broadcastTTS(nextWelcome, 'welcome');

    this.broadcastState();

    // Sau 4.8 giây, tự động vào câu hỏi đầu tiên của môn mới sau khi cô giáo thông báo xong
    if (this.autopilot) {
      if (this.autoNextTimeout) clearTimeout(this.autoNextTimeout);
      this.autoNextTimeout = setTimeout(() => {
        this.startNextQuestion();
      }, 4800);
    }
  }

  // Bật / tắt chế độ Autopilot
  setAutopilot(enabled) {
    this.autopilot = !!enabled;
    console.log(`[GameEngine] Chế độ Treo Live Tự Động (Autopilot): ${this.autopilot ? 'BẬT' : 'TẮT'}`);
    this.broadcastState();
    if (this.autopilot && this.state === 'REVEAL') {
      this.startNextQuestion();
    }
  }

  pause() {
    if (this.state === 'QUESTION_ACTIVE') {
      this.clearBotAnswerTimers();
      this.state = 'PAUSED';
      this.broadcastState();
    }
  }

  resume() {
    if (this.state === 'PAUSED') {
      this.state = 'QUESTION_ACTIVE';
      this.broadcastState();
      this.scheduleBotAnswers();
    }
  }

  skipQuestion() {
    this.clearBotAnswerTimers();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoNextTimeout) clearTimeout(this.autoNextTimeout);
    this.startNextQuestion();
  }

  revealEarly() {
    if (this.state === 'QUESTION_ACTIVE') {
      this.resolveQuestion();
    }
  }

  repeatTTS() {
    if (this.currentQuestion && this.state === 'QUESTION_ACTIVE') {
      const speech = ttsService.generateQuestionScript(this.currentQuestion, this.currentQuestionIndex);
      this.broadcastTTS(speech.fullScript, 'question');
    }
  }

  // Kích hoặc cho người chơi rời lớp học (người xem lướt hoặc thoát phiên live)
  async kickPlayer(username) {
    const student = this.students.get(username);
    if (!student) return false;

    const freedDeskIndex = student.deskIndex;
    const playerId = student.playerId;
    this.students.delete(username);

    // 1. XÓA NGƯỜI CHƠI KHỎI BẢNG XẾP HẠNG KHI LƯỚT / THOÁT PHIÊN LIVE
    const sessionId = this.currentSession ? this.currentSession.id : 1;
    if (playerId) {
      await db.removePlayerFromLeaderboard(sessionId, playerId);
    }

    let nextStudent = null;
    if (freedDeskIndex !== -1) {
      this.desks[freedDeskIndex] = null;

      // NẾU CÓ HỌC SINH TRONG HÀNG CHỜ -> LẬP TỨC THAY THẾ VÀO BÀN TRỐNG NÀY!
      if (this.waitingQueue.length > 0) {
        nextStudent = this.waitingQueue.shift();
        nextStudent.deskIndex = freedDeskIndex;
        this.desks[freedDeskIndex] = nextStudent;
        this.students.set(nextStudent.username, nextStudent);
        console.log(`[GameEngine] 🔄 Hàng chờ: Học sinh @${nextStudent.username} lập tức được vào thế chỗ bàn #${freedDeskIndex + 1}!`);
      }
    } else {
      // Học sinh bị xóa khi đang ở hàng chờ
      this.waitingQueue = this.waitingQueue.filter(s => s.username !== username);
    }

    if (this.io) {
      // Báo cho client người cũ đã rời lớp (chạy animation bước ra cửa)
      this.io.emit('classroom:student_kicked', { username, deskIndex: freedDeskIndex });

      // Cập nhật lại Bảng xếp hạng tức thì đến toàn bộ người xem
      const updatedLeaderboard = await db.getTopLeaderboard(sessionId, 10);
      this.io.emit('leaderboard:updated', { topLeaderboard: updatedLeaderboard });

      // NẾU CÓ HỌC SINH TỪ HÀNG CHỜ VÀO THAY -> PHÁT SỰ KIỆN ĐỂ CLIENT CHẠY ANIMATION BƯỚC VÀO LỚP!
      if (nextStudent) {
        // Delay nhẹ 350ms để người cũ kịp đứng dậy bước ra trước khi người mới bước vào
        setTimeout(() => {
          if (this.io) {
            this.io.emit('classroom:student_joined', {
              student: nextStudent,
              message: `Chào mừng ${nextStudent.displayName} từ hàng chờ đã bước vào lớp!`
            });
          }
        }, 350);
      }
    }

    this.broadcastState();
    return true;
  }

  // Cho 1 học sinh ngẫu nhiên đang ngồi trong lớp rời đi (để test người từ hàng chờ vào thay)
  async kickRandomPlayer() {
    const occupiedDesks = this.desks
      .map((st, idx) => ({ st, idx }))
      .filter(item => item.st !== null);
    if (occupiedDesks.length === 0) return null;
    const picked = occupiedDesks[Math.floor(Math.random() * occupiedDesks.length)];
    await this.kickPlayer(picked.st.username);
    return picked.st.username;
  }

  // Dọn dẹp các bộ đếm trả lời tự động của bot
  clearBotAnswerTimers() {
    if (this.botAnswerTimers && this.botAnswerTimers.length > 0) {
      this.botAnswerTimers.forEach(id => clearTimeout(id));
      this.botAnswerTimers = [];
    }
  }

  // TỰ ĐỘNG CHO HỌC SINH GIẢ LẬP TRẢ LỜI CÂU HỎI MỖI KHI CÂU MỚI BẮT ĐẦU
  scheduleBotAnswers() {
    this.clearBotAnswerTimers();
    if (this.state !== 'QUESTION_ACTIVE' || !this.currentQuestion) return;

    // Lọc ra các học sinh ảo đang ngồi tại bàn
    const botStudents = this.desks.filter(s => s !== null && s.isBot === true);
    if (botStudents.length === 0) return;

    const availableOptions = (this.currentQuestion.options && this.currentQuestion.options.length > 0)
      ? this.currentQuestion.options.map(o => o.key)
      : ['A', 'B', 'C', 'D'];
    const correctAns = String(this.currentQuestion.correctAnswer).trim().toUpperCase();

    // Giới hạn thời gian trả lời rải rác từ 2s đến tối đa 12s (hoặc timeRemaining - 3s)
    const maxDelaySec = Math.max(3, Math.min(12, this.timeRemaining - 3));

    botStudents.forEach((bot) => {
      // 85% xác suất bot sẽ trả lời câu hỏi này (15% để tự nhiên như học sinh thật)
      if (Math.random() > 0.85) return;

      // Đã trả lời rồi thì không trả lời lại
      if (this.currentQuestionAnswers.has(bot.playerId)) return;

      // Thời gian trễ ngẫu nhiên từ 1.8s đến maxDelaySec * 1000 ms
      const delayMs = Math.floor(1800 + Math.random() * ((maxDelaySec - 1.8) * 1000));

      const timerId = setTimeout(() => {
        // Kiểm tra câu hỏi vẫn đang mở và bot vẫn còn ngồi bàn
        if (this.state !== 'QUESTION_ACTIVE' || !this.currentQuestion) return;
        const currentDeskStudent = this.desks[bot.deskIndex];
        if (!currentDeskStudent || currentDeskStudent.username !== bot.username) return;
        if (this.currentQuestionAnswers.has(bot.playerId)) return;

        // 65% xác suất chọn đúng, 35% chọn sai ngẫu nhiên
        let chosenAnswer;
        if (Math.random() < 0.65) {
          chosenAnswer = correctAns;
        } else {
          const wrongOptions = availableOptions.filter(opt => opt !== correctAns);
          chosenAnswer = wrongOptions.length > 0
            ? wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
            : correctAns;
        }

        this.handlePlayerAnswer({
          username: bot.username,
          answer: chosenAnswer
        });
      }, delayMs);

      this.botAnswerTimers.push(timerId);
    });
  }

  // Tự động sinh hàng loạt học sinh ảo kèm avatar độc nhất (tự động lấp đầy bàn và cộng vào hàng chờ nếu > 30)
  async spawnBots(count = 10) {
    let spawned = 0;
    let attempt = 0;
    while (spawned < count && attempt < 300) {
      attempt++;
      let uname;
      if (attempt <= SAMPLE_BOT_NAMES.length) {
        uname = SAMPLE_BOT_NAMES[attempt - 1];
      } else {
        uname = `hoc_sinh_${attempt}`;
      }

      // Đảm bảo không trùng với bất kỳ học sinh nào đang trong lớp hoặc đang ở hàng chờ
      if (this.students.has(uname)) {
        continue;
      }

      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=random&color=fff&size=128&bold=true`;
      await this.handlePlayerJoin({
        username: uname,
        displayName: uname,
        userId: `sim_${uname}`,
        avatarUrl,
        isBot: true
      });
      spawned++;
    }

    // Nếu câu hỏi đang diễn ra, tự động lên lịch cho các bot mới trả lời ngay
    if (this.state === 'QUESTION_ACTIVE') {
      this.scheduleBotAnswers();
    }

    return spawned;
  }

  // CHỈ XÓA TOÀN BỘ HỌC SINH GIẢ LẬP / BOTS (GIỮ NGUYÊN 100% NGƯỜI XEM THẬT TRÊN TIKTOK)
  async clearOnlyBots() {
    this.clearBotAnswerTimers();
    let removedCount = 0;
    const sessionId = this.currentSession ? this.currentSession.id : 1;

    // 1. Loại bỏ các bot đang ngồi tại 30 bàn học
    for (let i = 0; i < this.maxDesks; i++) {
      const student = this.desks[i];
      if (student !== null && student.isBot === true) {
        this.desks[i] = null;
        this.students.delete(student.username);
        if (student.playerId) {
          await db.removePlayerFromLeaderboard(sessionId, student.playerId);
        }
        removedCount++;

        if (this.io) {
          this.io.emit('classroom:student_kicked', {
            username: student.username,
            deskIndex: i,
            reason: 'bot_cleared'
          });
        }
      }
    }

    // 2. Loại bỏ các bot đang ở hàng chờ
    const remainingQueue = [];
    for (const qStudent of this.waitingQueue) {
      if (qStudent.isBot === true) {
        this.students.delete(qStudent.username);
        if (qStudent.playerId) {
          await db.removePlayerFromLeaderboard(sessionId, qStudent.playerId);
        }
        removedCount++;
      } else {
        remainingQueue.push(qStudent);
      }
    }
    this.waitingQueue = remainingQueue;

    // 3. Nếu còn bàn trống và trong hàng chờ có người xem thật trên TikTok, đưa người thật vào bàn ngay!
    for (let i = 0; i < this.maxDesks; i++) {
      if (this.desks[i] === null && this.waitingQueue.length > 0) {
        const nextReal = this.waitingQueue.shift();
        nextReal.deskIndex = i;
        nextReal.joinedAt = Date.now();
        nextReal.lastActiveAt = Date.now();
        nextReal.missedQuestions = 0;
        nextReal.joinedQuestionIndex = this.currentQuestionIndex;
        this.desks[i] = nextReal;
        this.students.set(nextReal.username, nextReal);

        console.log(`[GameEngine] 🔄 Người xem thật @${nextReal.username} từ hàng chờ được chuyển vào bàn #${i + 1}`);
        if (this.io) {
          this.io.emit('classroom:student_joined', {
            student: nextReal,
            message: `Chào mừng @${nextReal.displayName || nextReal.username} vào lớp học!`
          });
        }
      }
    }

    // 4. Cập nhật Bảng xếp hạng và đồng bộ trạng thái
    const updatedLeaderboard = await db.getTopLeaderboard(sessionId, 10);
    if (this.io) {
      this.io.emit('leaderboard:updated', { topLeaderboard: updatedLeaderboard });
    }
    this.broadcastState();

    console.log(`[GameEngine] 🤖🧹 Đã xóa ${removedCount} học sinh ảo. Toàn bộ người xem thật trên TikTok được giữ nguyên 100%!`);
    return removedCount;
  }

  // Làm trống / Đặt lại toàn bộ học sinh và bảng xếp hạng
  async clearAllStudents() {
    this.clearBotAnswerTimers();
    this.desks = new Array(this.maxDesks).fill(null);
    this.students.clear();
    this.waitingQueue = [];
    const sessionId = this.currentSession ? this.currentSession.id : 1;
    await db.clearLeaderboard(sessionId);
    if (this.io) {
      this.io.emit('classroom:reset_all_students');
      this.io.emit('leaderboard:updated', { topLeaderboard: [] });
    }
    this.broadcastState();
    console.log('[GameEngine] 🧹 Đã làm sạch toàn bộ học sinh và bảng xếp hạng!');
  }
}

module.exports = new GameEngine();
