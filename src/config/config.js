require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminSecret: process.env.ADMIN_SECRET || 'admin123',

  // Database
  db: {
    type: process.env.DB_TYPE || 'mssql',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrongPassword123',
    database: process.env.DB_NAME || 'ClassroomLiveDB',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true,
      connectTimeout: 5000,
      requestTimeout: 10000
    }
  },

  // TikTok Live
  tiktok: {
    mode: process.env.TIKTOK_CONNECT_MODE || 'mock',
    username: process.env.TIKTOK_USERNAME || 'demo_teacher'
  },

  // Game rules
  game: {
    maxClassCapacity: parseInt(process.env.MAX_CLASS_CAPACITY, 10) || 30,
    defaultQuestionDuration: parseInt(process.env.QUESTION_DURATION, 10) || 35,
    periodDuration: parseInt(process.env.PERIOD_DURATION, 10) || 600, // 10 phút = 600 giây
    recessDuration: parseInt(process.env.RECESS_DURATION, 10) || 20,  // 20 giây giải lao
    revealDelay: parseInt(process.env.REVEAL_DELAY, 10) || 12,        // 12 giây hiển thị đáp án và đọc trọn vẹn Top 3 trước khi tự chuyển câu
    autoKickOnSwipe: process.env.AUTO_KICK_ON_SWIPE !== 'false',       // Tự động out lớp và xóa BXH khi lướt sang video khác
    maxInactiveQuestions: parseInt(process.env.MAX_INACTIVE_QUESTIONS, 10) || 1, // Số câu không trả lời/tương tác thì coi như lướt live
    autopilot: process.env.AUTOPILOT !== 'false',                     // Tự động hoàn toàn để treo livestream
    scoring: {
      correctBase: 10,
      speedBonusMax: 5,
      streak3Bonus: 3,
      streak5Bonus: 5,
      allowChangeAnswer: false
    }
  },

  // AI & TTS
  tts: {
    provider: process.env.TTS_PROVIDER || 'web',
    speed: parseFloat(process.env.TTS_SPEED) || 1.0,
    pitch: parseFloat(process.env.TTS_PITCH) || 1.0,
    defaultVoice: process.env.TTS_DEFAULT_VOICE || 'female'
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  }
};

module.exports = config;
