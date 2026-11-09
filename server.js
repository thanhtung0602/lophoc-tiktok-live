const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const config = require('./src/config/config');
const db = require('./src/database/db');
const gameEngine = require('./src/services/gameEngine');
const tiktokConnector = require('./src/services/tiktokConnector');
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Gán Socket.IO cho gameEngine
gameEngine.setSocketIO(io);

// Lắng nghe các sự kiện từ module TikTokConnector và chuyển tiếp vào GameEngine an toàn
tiktokConnector.on('player:join', async (data) => {
  try {
    await gameEngine.handlePlayerJoin(data);
  } catch (err) {
    console.error('[Server] Lỗi xử lý player:join:', err.message);
  }
});

tiktokConnector.on('player:answer', async (data) => {
  try {
    await gameEngine.handlePlayerAnswer(data);
  } catch (err) {
    console.error('[Server] Lỗi xử lý player:answer:', err.message);
  }
});

tiktokConnector.on('command:top', async (data) => {
  try {
    const sessionId = gameEngine.currentSession ? gameEngine.currentSession.id : 1;
    const topList = await db.getTopLeaderboard(sessionId, 5);
    io.emit('chat:system_announcement', {
      message: `TOP 5 HIỆN TẠI: ` + topList.map(t => `#${t.rank} ${t.displayName}: ${t.totalScore}đ`).join(' | ')
    });
  } catch (err) {
    console.error('[Server] Lỗi xử lý command:top:', err.message);
  }
});

tiktokConnector.on('player:activity', (data) => {
  if (data && data.username) {
    gameEngine.recordUserActivity(data.username);
  }
});

tiktokConnector.on('player:leave', async (data) => {
  try {
    gameEngine.kickPlayer(data.username);
  } catch (err) {
    console.error('[Server] Lỗi xử lý player:leave:', err.message);
  }
});

// Định tuyến API
app.use('/api', apiRoutes);

// Định tuyến giao diện
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/game.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/simulator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/simulator.html'));
});

// Quản lý kết nối Socket.IO thời gian thực
io.on('connection', (socket) => {
  // Gửi trạng thái lớp học hiện tại ngay khi client kết nối
  gameEngine.broadcastState();

  socket.on('disconnect', () => {
    // client disconnect
  });
});

// Khởi động server
async function start() {
  try {
    // 1. Khởi tạo Cơ sở dữ liệu (SQL Server hoặc Resilient Storage)
    await db.initialize();

    // 2. Khởi tạo phiên học đầu tiên
    await gameEngine.startNewSession(1, 'Lớp Học Hoạt Hình TikTok LIVE');

    // 3. Khởi tạo kết nối TikTok (Mock hoặc Live)
    await tiktokConnector.connect();

    server.listen(config.port, () => {
      console.log('================================================================');
      console.log(`🚀 CLASSROOM 2D TIKTOK LIVE SERVER SẴN SÀNG TẠI PORT: ${config.port}`);
      console.log(`🎮 Game View (OBS Source):    http://localhost:${config.port}/game`);
      console.log(`⚙️  Admin Dashboard:           http://localhost:${config.port}/admin`);
      console.log(`🧪 TikTok Event Simulator:     http://localhost:${config.port}/simulator`);
      console.log(`🏠 Central Hub:                http://localhost:${config.port}/`);
      console.log('================================================================');
    });
  } catch (err) {
    console.error('Lỗi nghiêm trọng khi khởi động Server:', err);
    process.exit(1);
  }
}

start();
