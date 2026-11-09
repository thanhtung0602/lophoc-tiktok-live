const express = require('express');
const router = express.Router();
const db = require('../database/db');
const gameEngine = require('../services/gameEngine');
const aiQuestionService = require('../services/aiQuestionService');
const tiktokConnector = require('../services/tiktokConnector');

// 1. Quản lý môn học
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await db.getSubjects();
    res.json({ success: true, data: subjects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Lấy danh sách câu hỏi
router.get('/questions', async (req, res) => {
  try {
    const { subjectId } = req.query;
    const questions = await db.getQuestionsBySubject(subjectId);
    res.json({ success: true, data: questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Thêm mới câu hỏi
router.post('/questions', async (req, res) => {
  try {
    const { subjectId, content, correctAnswer, options, questionType, difficulty, explanation, timeLimit } = req.body;
    if (!subjectId || !content || !correctAnswer) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đầy đủ: Môn học, nội dung câu hỏi và đáp án đúng!' });
    }

    const created = await db.addQuestion({
      subjectId: parseInt(subjectId, 10),
      content,
      correctAnswer,
      options: options || [],
      questionType: questionType || 'MULTIPLE_CHOICE',
      difficulty: difficulty || 'MEDIUM',
      explanation: explanation || '',
      timeLimit: parseInt(timeLimit, 10) || 20
    });

    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Sinh câu hỏi tự động bằng AI
router.post('/ai/generate-questions', async (req, res) => {
  try {
    const { subjectName, topic, difficulty, count } = req.body;
    const questions = await aiQuestionService.generateQuestions(
      subjectName || 'Toán học',
      topic || '',
      difficulty || 'MEDIUM',
      parseInt(count, 10) || 3
    );
    res.json({ success: true, data: questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Bảng xếp hạng Top 10
router.get('/leaderboard', async (req, res) => {
  try {
    const sessionId = gameEngine.currentSession ? gameEngine.currentSession.id : 1;
    const top = await db.getTopLeaderboard(sessionId, 10);
    res.json({ success: true, data: top });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Điều khiển Game Engine
router.post('/game/start', async (req, res) => {
  try {
    const { subjectId, title } = req.body;
    const session = await gameEngine.startNewSession(subjectId, title);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/game/next', (req, res) => {
  const success = gameEngine.startNextQuestion();
  res.json({ success });
});

router.post('/game/pause', (req, res) => {
  gameEngine.pause();
  res.json({ success: true });
});

router.post('/game/resume', (req, res) => {
  gameEngine.resume();
  res.json({ success: true });
});

router.post('/game/skip', (req, res) => {
  gameEngine.skipQuestion();
  res.json({ success: true });
});

router.post('/game/reveal', (req, res) => {
  gameEngine.revealEarly();
  res.json({ success: true });
});

router.post('/game/repeat-voice', (req, res) => {
  gameEngine.repeatTTS();
  res.json({ success: true });
});

router.post('/game/kick', (req, res) => {
  const { username } = req.body;
  const ok = gameEngine.kickPlayer(username);
  res.json({ success: ok });
});

router.post('/game/autopilot', (req, res) => {
  const { enabled } = req.body;
  gameEngine.setAutopilot(enabled);
  res.json({ success: true, autopilot: gameEngine.autopilot });
});

router.post('/game/end-period', async (req, res) => {
  await gameEngine.endPeriodAndCelebrate();
  res.json({ success: true });
});

router.post('/game/reset-students', async (req, res) => {
  try {
    await gameEngine.clearAllStudents();
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Lỗi reset-students:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/game/clear-bots', async (req, res) => {
  try {
    const removedCount = await gameEngine.clearOnlyBots();
    res.json({
      success: true,
      removedCount,
      activeDesksCount: gameEngine.desks.filter(d => d !== null).length,
      queueCount: gameEngine.waitingQueue.length,
      totalStudents: gameEngine.students.size
    });
  } catch (err) {
    console.error('[API] Lỗi clear-bots:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/game/spawn-bots', async (req, res) => {
  try {
    const count = parseInt(req.body.count) || 10;
    const spawned = await gameEngine.spawnBots(count);
    res.json({
      success: true,
      spawned,
      activeDesksCount: gameEngine.desks.filter(d => d !== null).length,
      queueCount: gameEngine.waitingQueue.length,
      totalStudents: gameEngine.students.size
    });
  } catch (err) {
    console.error('[API] Lỗi spawn-bots:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/game/kick-random', async (req, res) => {
  try {
    const kicked = await gameEngine.kickRandomPlayer();
    res.json({
      success: true,
      kicked,
      activeDesksCount: gameEngine.desks.filter(d => d !== null).length,
      queueCount: gameEngine.waitingQueue.length
    });
  } catch (err) {
    console.error('[API] Lỗi kick-random:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/game/auto-kick-config', (req, res) => {
  const { autoKickOnSwipe, maxInactiveQuestions } = req.body;
  if (autoKickOnSwipe !== undefined) {
    gameEngine.autoKickOnSwipe = Boolean(autoKickOnSwipe);
  }
  if (maxInactiveQuestions !== undefined) {
    gameEngine.maxInactiveQuestions = Math.max(1, parseInt(maxInactiveQuestions, 10) || 1);
  }
  gameEngine.broadcastState();
  res.json({
    success: true,
    autoKickOnSwipe: gameEngine.autoKickOnSwipe,
    maxInactiveQuestions: gameEngine.maxInactiveQuestions
  });
});

// 7. Bộ giả lập bình luận TikTok Simulator
router.post('/simulator/comment', (req, res) => {
  const { username, comment, displayName, avatarUrl } = req.body;
  if (!username || !comment) {
    return res.status(400).json({ success: false, error: 'Thiếu username hoặc comment!' });
  }
  tiktokConnector.simulateComment(username, comment, displayName, avatarUrl);
  res.json({ success: true });
});

// 8. Cấu hình kết nối TikTok
router.get('/tiktok/status', (req, res) => {
  res.json({
    success: true,
    mode: tiktokConnector.mode,
    username: tiktokConnector.username,
    isConnected: tiktokConnector.isConnected,
    roomId: tiktokConnector.liveConnection ? tiktokConnector.liveConnection.roomId : null
  });
});

router.post('/tiktok/connect', async (req, res) => {
  try {
    const { username, mode } = req.body;
    if (mode) tiktokConnector.mode = mode;
    const connected = await tiktokConnector.connect(username);
    res.json({
      success: connected,
      mode: tiktokConnector.mode,
      username: tiktokConnector.username,
      error: !connected ? `Không thể kết nối phòng LIVE của @${tiktokConnector.username}. Hãy chắc chắn tài khoản đang phát LIVE trực tiếp trên TikTok!` : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tiktok/disconnect', (req, res) => {
  tiktokConnector.disconnect();
  res.json({ success: true, mode: tiktokConnector.mode, username: tiktokConnector.username });
});

module.exports = router;
