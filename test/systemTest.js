/**
 * TEST TOÀN DIỆN HỆ THỐNG GAME 2D LỚP HỌC TIKTOK LIVE (PHASE 9)
 */

const assert = require('assert');
const db = require('../src/database/db');
const scoreService = require('../src/services/scoreService');
const ttsService = require('../src/services/ttsService');
const aiQuestionService = require('../src/services/aiQuestionService');
const tiktokConnector = require('../src/services/tiktokConnector');
const gameEngine = require('../src/services/gameEngine');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN BỘ HỆ THỐNG CLASSROOM 2D LIVE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Kiểm thử Cơ sở dữ liệu và 15 môn học
  await test('1. Khởi tạo Cơ sở dữ liệu & Nạp đủ 15 môn học', async () => {
    await db.initialize();
    const subjects = await db.getSubjects();
    assert.strictEqual(subjects.length, 15, `Phải có 15 môn học, hiện có ${subjects.length}`);
    const math = subjects.find(s => s.code === 'MATH');
    assert.ok(math, 'Phải có môn Toán học (MATH)');
  });

  // 2. Kiểm thử Ngân hàng câu hỏi
  await test('2. Ngân hàng câu hỏi mẫu cho 15 môn học', async () => {
    const allQuestions = await db.getAllQuestions();
    assert.ok(allQuestions.length >= 15, `Phải có ít nhất 15 câu hỏi mẫu, hiện có ${allQuestions.length}`);
    const q1 = allQuestions[0];
    assert.ok(q1.content && q1.correctAnswer, 'Câu hỏi phải có nội dung và đáp án đúng');
  });

  // 3. Kiểm thử Hệ thống Tính điểm & Thưởng tốc độ, Chuỗi thắng
  await test('3. Tính toán điểm số chuẩn xác (Base, Tốc độ, Chuỗi thắng)', () => {
    // Trả lời sai
    const wrong = scoreService.calculateScore(false, 5, 20, 2);
    assert.strictEqual(wrong.totalPoints, 0, 'Sai phải nhận 0 điểm');
    assert.strictEqual(wrong.newStreak, 0, 'Sai phải reset streak về 0');

    // Trả lời đúng tức thì (thưởng tốc độ tối đa)
    const fastCorrect = scoreService.calculateScore(true, 1, 20, 0);
    assert.ok(fastCorrect.totalPoints >= 14, 'Đúng nhanh phải nhận điểm base 10 + thưởng tốc độ 4-5');

    // Chuỗi thắng 3 câu liên tiếp
    const streak3 = scoreService.calculateScore(true, 10, 20, 2);
    assert.strictEqual(streak3.streakBonus, 3, 'Chuỗi 3 câu phải được thưởng thêm 3 điểm');

    // Chuỗi thắng 5 câu liên tiếp
    const streak5 = scoreService.calculateScore(true, 10, 20, 4);
    assert.strictEqual(streak5.streakBonus, 5, 'Chuỗi 5 câu phải được thưởng thêm 5 điểm');
  });

  // 4. Kiểm thử Kịch bản AI Text-to-Speech (TTS)
  await test('4. Kịch bản phát âm AI Giáo viên tiếng Việt', () => {
    const sampleQ = {
      content: '12 x 8 bằng bao nhiêu?',
      questionType: 'MULTIPLE_CHOICE',
      correctAnswer: 'B',
      explanation: '12 x 8 = 96.',
      options: [
        { key: 'A', text: '86' },
        { key: 'B', text: '96' }
      ]
    };

    const speech = ttsService.generateQuestionScript(sampleQ, 1);
    assert.ok(speech.fullScript.includes('Câu hỏi số 1: 12 x 8 bằng bao nhiêu?'), 'Script phải chứa số câu và nội dung');
    assert.ok(speech.fullScript.includes('Đáp án B: 96'), 'Script phải chứa các lựa chọn');

    const reveal = ttsService.generateRevealScript(sampleQ, [{ displayName: 'Minh' }]);
    assert.ok(reveal.includes('Đáp án chính xác là B'), 'Phải công bố đáp án đúng');
    assert.ok(reveal.includes('Minh'), 'Phải khen ngợi bạn trả lời đúng');

    const revealWithTop = ttsService.generateRevealScript(
      sampleQ,
      [{ displayName: 'Minh' }],
      [
        { displayName: 'Tuấn Kiệt', totalScore: 25 },
        { displayName: 'Mai Anh', totalScore: 20 },
        { displayName: 'Bảo Châu', totalScore: 15 }
      ]
    );
    assert.ok(revealWithTop.includes('Top ba dẫn đầu hiện tại: Top một Tuấn Kiệt 25 điểm, Top hai Mai Anh 20 điểm, Top ba Bảo Châu 15 điểm'), 'Phải đọc chuẩn Top 3 dẫn đầu');
  });

  // 5. Kiểm thử Bộ sinh câu hỏi AI (Smart Fallback & Parser)
  await test('5. Sinh câu hỏi tự động bằng AI', async () => {
    const questions = await aiQuestionService.generateQuestions('Toán học', 'Phép nhân', 'EASY', 2);
    assert.strictEqual(questions.length, 2, 'Phải sinh đúng số lượng câu hỏi yêu cầu');
    assert.ok(questions[0].options.length === 4, 'Trắc nghiệm phải có 4 lựa chọn');
    assert.ok(questions[0].correctAnswer, 'Phải có đáp án đúng');
  });

  // 6. Kiểm thử Module TikTok LIVE Connector & Phân loại bình luận
  await test('6. Phân loại bình luận TikTok LIVE (JOIN, ABCD, Đúng/Sai)', (done) => {
    let joinReceived = false;
    let answerReceived = false;

    tiktokConnector.once('player:join', (data) => {
      assert.strictEqual(data.username, 'test_user_1');
      joinReceived = true;
      if (joinReceived && answerReceived) done();
    });

    tiktokConnector.once('player:answer', (data) => {
      assert.strictEqual(data.answer, 'B');
      answerReceived = true;
      if (joinReceived && answerReceived) done();
    });

    // Giả lập bình luận
    tiktokConnector.simulateComment('test_user_1', 'VÀO LỚP');
    setTimeout(() => {
      tiktokConnector.simulateComment('test_user_1', 'CHỌN B');
    }, 50);
  });

  // 7. Kiểm thử Chu trình Game Engine & Bàn học 30 chỗ kèm Avatar
  await test('7. Game Engine xếp bàn học 30 chỗ, xử lý avatar, chống trùng điểm, bảng xếp hạng', async () => {
    assert.strictEqual(gameEngine.maxDesks, 30, 'Lớp học phải chứa tối đa 30 học sinh');
    await gameEngine.startNewSession(1, 'Tiết học thử nghiệm');

    // 2 học sinh vào lớp kèm avatar
    await gameEngine.handlePlayerJoin({
      username: 'hocsinh_a',
      displayName: 'Học Sinh A',
      avatarUrl: 'https://ui-avatars.com/api/?name=A'
    });
    await gameEngine.handlePlayerJoin({
      username: 'hocsinh_b',
      displayName: 'Học Sinh B',
      avatarUrl: 'https://ui-avatars.com/api/?name=B'
    });

    assert.strictEqual(gameEngine.students.size, 2, 'Phải có 2 học sinh trong lớp');
    assert.strictEqual(gameEngine.desks[0].username, 'hocsinh_a', 'Học sinh A ngồi bàn 1');
    assert.ok(gameEngine.desks[0].avatarUrl, 'Học sinh A phải có link ảnh đại diện');
    assert.strictEqual(gameEngine.desks[1].username, 'hocsinh_b', 'Học sinh B ngồi bàn 2');

    // Bắt đầu câu hỏi
    gameEngine.startNextQuestion();
    assert.strictEqual(gameEngine.state, 'QUESTION_ACTIVE', 'Trạng thái phải là QUESTION_ACTIVE');

    // Trả lời câu hỏi
    const correctAns = gameEngine.currentQuestion.correctAnswer;
    await gameEngine.handlePlayerAnswer({ username: 'hocsinh_a', answer: correctAns });
    await gameEngine.handlePlayerAnswer({ username: 'hocsinh_b', answer: 'Z' }); // Trả lời sai

    // Công bố đáp án
    await gameEngine.resolveQuestion();
    assert.strictEqual(gameEngine.state, 'REVEAL', 'Trạng thái phải là REVEAL');

    // Kiểm tra điểm số
    const studentA = gameEngine.students.get('hocsinh_a');
    const studentB = gameEngine.students.get('hocsinh_b');
    assert.ok(studentA.score > 0, 'Học sinh A đúng phải có điểm > 0');
    assert.strictEqual(studentB.score, 0, 'Học sinh B sai phải có 0 điểm');

    // Kiểm tra Bảng xếp hạng
    const top = await db.getTopLeaderboard(gameEngine.currentSession.id, 5);
    assert.ok(top.length >= 1, 'Bảng xếp hạng phải có người dẫn đầu');
    assert.strictEqual(top[0].username, 'hocsinh_a', 'Học sinh A phải ở TOP 1');
  });

  // 8. Kiểm thử Tích lũy điểm, Tự động chuyển câu & Tổng kết Top 3 cuối môn + Reset điểm môn mới
  await test('8. Tích lũy điểm nhiều câu, kết thúc môn vinh danh Top 3 & reset điểm môn mới', async () => {
    // Câu hỏi số 2: Trả lời tiếp để kiểm tra cộng dồn điểm số
    gameEngine.startNextQuestion();
    const q2Correct = gameEngine.currentQuestion.correctAnswer;
    const scoreBefore = gameEngine.students.get('hocsinh_a').score;

    await gameEngine.handlePlayerAnswer({ username: 'hocsinh_a', answer: q2Correct });
    await gameEngine.resolveQuestion();

    const scoreAfter = gameEngine.students.get('hocsinh_a').score;
    assert.ok(scoreAfter > scoreBefore, 'Điểm số phải được cộng dồn tích lũy qua các câu hỏi');

    // Kết thúc tiết học và kiểm tra vinh danh Top 3
    await gameEngine.endPeriodAndCelebrate();
    assert.strictEqual(gameEngine.state, 'RECESS', 'Sau khi bế mạc môn phải chuyển sang trạng thái giải lao RECESS');

    // Chuyển sang môn mới và kiểm tra reset điểm số về 0
    await gameEngine.rotateToNextSubject();
    assert.strictEqual(gameEngine.students.get('hocsinh_a').score, 0, 'Điểm số phải được reset về 0 cho môn học mới');
    assert.strictEqual(gameEngine.desks[0].username, 'hocsinh_a', 'Học sinh vẫn giữ nguyên vị trí bàn học');
  });

  // 9. Kiểm thử Hàng chờ khi lớp đủ 30 người & Tự động thay thế khi có học sinh rời lớp
  await test('9. Kiểm thử Hàng chờ khi đủ 30 người & Tự động đưa người từ hàng chờ vào thế chỗ', async () => {
    // Làm sạch để test hàng chờ chuẩn xác
    gameEngine.clearAllStudents();
    assert.strictEqual(gameEngine.students.size, 0, 'Lớp học ban đầu trống');

    // Thêm đủ 30 học sinh kín 30 bàn
    for (let i = 0; i < 30; i++) {
      await gameEngine.handlePlayerJoin({
        username: `bot_${i}`,
        displayName: `Bot ${i}`,
        avatarUrl: `https://ui-avatars.com/api/?name=B${i}`
      });
    }
    assert.strictEqual(gameEngine.desks.filter(d => d !== null).length, 30, 'Phải có đúng 30 học sinh ngồi kín 30 bàn');
    assert.strictEqual(gameEngine.waitingQueue.length, 0, 'Hàng chờ ban đầu bằng 0');

    // Học sinh thứ 31 tham gia -> Bị đưa vào Hàng chờ
    await gameEngine.handlePlayerJoin({
      username: 'hocsinh_hang_cho_31',
      displayName: 'Học Sinh Chờ 31',
      avatarUrl: 'https://ui-avatars.com/api/?name=Wait31'
    });
    assert.strictEqual(gameEngine.waitingQueue.length, 1, 'Học sinh thứ 31 phải vào hàng chờ');
    assert.strictEqual(gameEngine.waitingQueue[0].username, 'hocsinh_hang_cho_31', 'Tên học sinh trong hàng chờ chuẩn');
    assert.strictEqual(gameEngine.waitingQueue[0].deskIndex, -1, 'Học sinh trong hàng chờ chưa có bàn (deskIndex = -1)');

    // 1 học sinh ở bàn #5 (index 4) rời lớp (kick/out)
    const leavingDesk = 4;
    const leavingUser = gameEngine.desks[leavingDesk].username;
    await gameEngine.kickPlayer(leavingUser);

    // Học sinh thứ 31 từ hàng chờ phải LẬP TỨC được đưa vào thay thế bàn số 5!
    assert.strictEqual(gameEngine.waitingQueue.length, 0, 'Hàng chờ được giải phóng');
    assert.strictEqual(gameEngine.desks[leavingDesk].username, 'hocsinh_hang_cho_31', 'Học sinh hàng chờ phải ngồi đúng bàn trống');
    assert.strictEqual(gameEngine.desks[leavingDesk].deskIndex, leavingDesk, 'deskIndex phải được cập nhật đúng số bàn');
  });

  await test('10. Kiểm thử spawnBots(30) + spawnBots(10) vào hàng chờ & kickRandomPlayer', async () => {
    await gameEngine.clearAllStudents();
    assert.strictEqual(gameEngine.desks.filter(d => d !== null).length, 0);

    // 1. Sinh 30 bot đầu tiên -> Kín 30 bàn
    const spawned30 = await gameEngine.spawnBots(30);
    assert.strictEqual(spawned30, 30, 'Đã sinh đủ 30 bot');
    assert.strictEqual(gameEngine.desks.filter(d => d !== null).length, 30, 'Kín 30 bàn');
    assert.strictEqual(gameEngine.waitingQueue.length, 0, 'Hàng chờ = 0');

    // 2. Thêm 10 bot khi đã kín 30 bàn -> Phải vào hàng chờ cả 10
    const spawned10 = await gameEngine.spawnBots(10);
    assert.strictEqual(spawned10, 10, 'Đã sinh tiếp 10 bot');
    assert.strictEqual(gameEngine.desks.filter(d => d !== null).length, 30, 'Bàn vẫn là 30');
    assert.strictEqual(gameEngine.waitingQueue.length, 10, 'Hàng chờ phải nhận đủ 10 người mới');

    // 3. Cho 1 học sinh ngẫu nhiên rời lớp -> Hàng chờ giảm còn 9, bàn vẫn đủ 30
    const kickedUser = await gameEngine.kickRandomPlayer();
    assert.ok(kickedUser, 'Đã kick được 1 người ngẫu nhiên');
    assert.strictEqual(gameEngine.desks.filter(d => d !== null).length, 30, 'Bàn vẫn đủ 30 sau khi người từ hàng chờ vào thay');
    assert.strictEqual(gameEngine.waitingQueue.length, 9, 'Hàng chờ giảm còn 9');
  });

  await test('11. Kiểm thử Xóa người chơi khỏi Bảng xếp hạng khi rời lớp / thoát phiên live', async () => {
    await gameEngine.clearAllStudents();
    const sessionId = gameEngine.currentSession ? gameEngine.currentSession.id : 1;

    // Cho 2 bạn vào lớp
    await gameEngine.handlePlayerJoin({ username: 'top1_player', displayName: 'Top 1 Player', userId: 'p1' });
    await gameEngine.handlePlayerJoin({ username: 'top2_player', displayName: 'Top 2 Player', userId: 'p2' });

    const p1 = gameEngine.students.get('top1_player');
    const p2 = gameEngine.students.get('top2_player');

    // Cộng điểm cho cả 2 bạn vào BXH
    await db.updateLeaderboard(sessionId, p1.playerId, 50, true, 2.0);
    await db.updateLeaderboard(sessionId, p2.playerId, 30, true, 2.5);

    let board = await db.getTopLeaderboard(sessionId, 5);
    assert.strictEqual(board.length, 2, 'Có 2 bạn trên BXH');
    assert.strictEqual(board[0].username, 'top1_player', 'Top 1 là top1_player');

    // top1_player rời phòng / lướt live / kick
    await gameEngine.kickPlayer('top1_player');

    // Bảng xếp hạng phải LẬP TỨC xóa top1_player!
    board = await db.getTopLeaderboard(sessionId, 5);
    assert.strictEqual(board.length, 1, 'Chỉ còn 1 bạn trên BXH');
    assert.strictEqual(board[0].username, 'top2_player', 'top2_player được đôn lên Top 1');
    assert.ok(!board.some(b => b.username === 'top1_player'), 'top1_player đã hoàn toàn bị xóa khỏi BXH');
  });

  await test('12. Kiểm thử Tự động phát hiện người lướt live / không trả lời -> Out lớp & Hàng chờ vào thay', async () => {
    await gameEngine.clearAllStudents();
    gameEngine.autoKickOnSwipe = true;
    gameEngine.maxInactiveQuestions = 1;

    // Cho 2 bạn vào lớp
    await gameEngine.handlePlayerJoin({ username: 'student_active', displayName: 'Học Sinh Chăm Chỉ', userId: 'act_1' });
    await gameEngine.handlePlayerJoin({ username: 'student_swiped', displayName: 'Học Sinh Lướt Live', userId: 'swp_1' });

    // Đưa 1 bạn vào hàng chờ (fake deskIndex -1)
    const waitingStudent = {
      playerId: 999,
      userId: 'wait_1',
      username: 'student_waiting',
      displayName: 'Học Sinh Chờ',
      deskIndex: -1,
      score: 0,
      streak: 0,
      status: 'idle',
      joinedAt: Date.now()
    };
    gameEngine.waitingQueue.push(waitingStudent);
    gameEngine.students.set('student_waiting', waitingStudent);

    const swipedStudent = gameEngine.students.get('student_swiped');
    const swipedDesk = swipedStudent.deskIndex;

    // Bắt đầu 1 câu hỏi
    await gameEngine.startNewSession(1, 'Toán học');
    gameEngine.state = 'QUESTION_ACTIVE';
    gameEngine.currentQuestionIndex = 5; // đặt index khác để vượt qua grace period
    gameEngine.questionStartTime = Date.now();

    // Đánh dấu đã qua câu làm quen và không có hoạt động trong câu này
    swipedStudent.joinedQuestionIndex = -1;
    swipedStudent.lastActiveAt = gameEngine.questionStartTime - 30000;
    gameEngine.students.get('student_active').joinedQuestionIndex = -1;

    // student_active trả lời đúng
    await gameEngine.handlePlayerAnswer({ username: 'student_active', answer: 'A' });
    // student_swiped KHÔNG trả lời (lướt sang video khác)

    // Kết thúc câu hỏi
    await gameEngine.resolveQuestion();

    // student_active phải vẫn ngồi ở bàn
    assert.ok(gameEngine.students.has('student_active'), 'student_active vẫn còn trong lớp');

    // student_swiped phải bị TỰ ĐỘNG cho out lớp!
    assert.ok(!gameEngine.students.has('student_swiped'), 'student_swiped đã bị tự động kick ra khỏi lớp');

    // student_waiting từ hàng chờ phải vào ngồi đúng bàn của student_swiped!
    assert.strictEqual(gameEngine.desks[swipedDesk].username, 'student_waiting', 'Học sinh từ hàng chờ đã tự động vào thế chỗ bàn vừa trống');
    assert.strictEqual(gameEngine.waitingQueue.length, 0, 'Hàng chờ đã được giải phóng');
  });

  // 13. Kiểm thử Tự động trả lời câu hỏi cho Bot & Chức năng Xóa Học Sinh Ảo (Bảo toàn Người Xem Thật)
  await test('13. Tự động trả lời cho Bot & Xóa Chỉ Học Sinh Ảo (Bảo toàn 100% Người Xem Thật)', async () => {
    await gameEngine.clearAllStudents();

    // 1. Thêm 1 người xem thật từ TikTok (isBot: false)
    await gameEngine.handlePlayerJoin({
      username: 'real_tiktok_viewer_1',
      displayName: 'Khán Giả Thật',
      userId: 'tiktok_real_uid_123',
      isBot: false
    });

    // 2. Thêm 5 bot ảo (isBot: true)
    await gameEngine.spawnBots(5);

    // Xác nhận trong lớp có 6 học sinh (1 thật + 5 bot)
    assert.strictEqual(gameEngine.students.size, 6, 'Lớp phải có 6 học sinh (1 thật + 5 bot)');
    const realStudent = gameEngine.students.get('real_tiktok_viewer_1');
    assert.strictEqual(realStudent.isBot, false, 'Khán giả thật phải có isBot: false');

    // 3. Kiểm thử Tự động trả lời câu hỏi:
    // Bắt đầu 1 câu hỏi mới, bot sẽ được lên lịch trả lời tự động
    await gameEngine.startNewSession(1, 'Toán học');
    gameEngine.state = 'QUESTION_ACTIVE';
    gameEngine.currentQuestionIndex = 1;
    gameEngine.timeRemaining = 20;
    gameEngine.scheduleBotAnswers();

    // Xác nhận có các timer đếm giờ trả lời cho bot
    assert.ok(gameEngine.botAnswerTimers.length > 0, 'Các bot ảo phải được lên lịch tự động trả lời');

    // 4. Kiểm thử Chức năng Xóa Chỉ Học Sinh Ảo:
    const removed = await gameEngine.clearOnlyBots();
    assert.strictEqual(removed, 5, 'Phải xóa chính xác 5 bot ảo');

    // Khán giả thật vẫn phải ngồi nguyên ở bàn số 1!
    assert.strictEqual(gameEngine.students.size, 1, 'Chỉ còn lại 1 học sinh trong lớp');
    assert.ok(gameEngine.students.has('real_tiktok_viewer_1'), 'Khán giả thật vẫn được giữ nguyên 100%');
    assert.strictEqual(gameEngine.desks[0].username, 'real_tiktok_viewer_1', 'Khán giả thật vẫn ngồi nguyên tại bàn của mình');
  });

  console.log('====================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
