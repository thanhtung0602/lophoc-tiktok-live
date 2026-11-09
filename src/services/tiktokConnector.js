const EventEmitter = require('events');
const config = require('../config/config');

class TikTokConnector extends EventEmitter {
  constructor() {
    super();
    this.mode = config.tiktok.mode; // 'mock' or 'live'
    this.username = config.tiktok.username;
    this.isConnected = false;
    this.liveConnection = null;
    this.recentComments = new Map(); // Anti-spam debounce: username -> timestamp
  }

  async connect(targetUsername) {
    if (targetUsername) {
      let clean = String(targetUsername).trim().replace(/^@/, '');
      if (clean.includes('tiktok.com/@')) {
        clean = clean.split('tiktok.com/@')[1].split('/')[0].split('?')[0];
      }
      this.username = clean;
      this.mode = 'live'; // Chuyển sang live khi có target username
    }

    // Nếu đang có kết nối cũ thì ngắt trước khi kết nối mới
    if (this.liveConnection) {
      try {
        this.liveConnection.disconnect();
      } catch (e) {}
      this.liveConnection = null;
    }

    if (this.mode === 'mock') {
      this.isConnected = true;
      console.log(`[TikTokConnector] Đang chạy ở chế độ MOCK SIMULATOR (Thử nghiệm & Giả lập an toàn).`);
      this.emit('connected', { mode: 'mock', username: this.username });
      return true;
    }

    try {
      const tlc = require('tiktok-live-connector');
      const ConnectorClass = tlc.TikTokLiveConnection || tlc.WebcastPushConnection || tlc.default;
      if (!ConnectorClass) {
        throw new Error('Không tìm thấy lớp kết nối TikTokLiveConnection trong thư viện tiktok-live-connector!');
      }

      console.log(`[TikTokConnector] Đang kết nối đến TikTok LIVE của @${this.username}...`);
      this.liveConnection = new ConnectorClass(this.username, {
        processInitialData: false,
        enableExtendedGiftInfo: false,
        fetchRoomInfoOnConnect: true
      });

      const state = await this.liveConnection.connect();
      this.isConnected = true;
      console.log(`[TikTokConnector] ✅ ĐÃ KẾT NỐI THÀNH CÔNG TikTok LIVE Room ID: ${state.roomId} (@${this.username})`);
      this.emit('connected', { mode: 'live', roomId: state.roomId, username: this.username });

      this.liveConnection.on('chat', (data) => {
        const comment = data.comment || data.content || '';
        const user = data.user || {};
        const username = data.uniqueId || user.displayId || user.uniqueId || user.id || 'viewer';
        const displayName = data.nickname || user.nickname || username;
        const avatar = data.profilePictureUrl ||
          (user.avatarThumb && user.avatarThumb.urlListList && user.avatarThumb.urlListList[0]) ||
          (user.avatarMedium && user.avatarMedium.urlListList && user.avatarMedium.urlListList[0]) ||
          (data.userDetails && data.userDetails.profilePictureUrls ? data.userDetails.profilePictureUrls[0] : null);

        console.log(`[TikTok LIVE Chat] 💬 @${username} (${displayName}): "${comment}"`);

        this.processIncomingComment({
          userId: data.userId || user.id || username,
          username,
          displayName,
          comment,
          avatarUrl: avatar,
          timestamp: Date.now(),
          isBot: false // Người xem thật trên TikTok LIVE
        });
      });

      this.liveConnection.on('like', (data) => {
        const u = data.uniqueId || (data.user && (data.user.displayId || data.user.uniqueId || data.user.id));
        if (u) this.emit('player:activity', { username: u });
      });

      this.liveConnection.on('gift', (data) => {
        const u = data.uniqueId || (data.user && (data.user.displayId || data.user.uniqueId || data.user.id));
        if (u) this.emit('player:activity', { username: u });
      });

      this.liveConnection.on('member', (data) => {
        const u = data.uniqueId || (data.user && (data.user.displayId || data.user.uniqueId || data.user.id));
        if (u) this.emit('player:activity', { username: u });
      });

      this.liveConnection.on('disconnected', () => {
        this.isConnected = false;
        console.warn('[TikTokConnector] Mất kết nối TikTok LIVE. Đang cố gắng kết nối lại...');
        this.emit('disconnected');
      });

      this.liveConnection.on('streamEnd', () => {
        this.isConnected = false;
        console.warn('[TikTokConnector] Phiên TikTok LIVE đã kết thúc.');
        this.emit('disconnected');
      });

      return true;
    } catch (err) {
      console.warn(`[TikTokConnector] Không thể kết nối trực tiếp phòng LIVE @${this.username}: ${err.message}`);
      console.log('[TikTokConnector] Chuyển đổi an toàn sang chế độ SIMULATOR để sẵn sàng kiểm thử!');
      this.mode = 'mock';
      this.isConnected = true;
      this.emit('connected', { mode: 'mock', fallback: true, error: err.message });
      return false;
    }
  }

  disconnect() {
    if (this.liveConnection) {
      try {
        this.liveConnection.disconnect();
      } catch (e) {}
      this.liveConnection = null;
    }
    this.isConnected = false;
    this.mode = 'mock';
    console.log('[TikTokConnector] Đã ngắt kết nối và chuyển về chế độ Mock Simulator.');
    this.emit('disconnected');
  }

  /**
   * Phân loại và chuẩn hóa bình luận nhận được từ TikTok LIVE hoặc Simulator
   */
  processIncomingComment(rawEvent) {
    const { userId, username, displayName, comment, timestamp } = rawEvent;
    if (!comment || typeof comment !== 'string') return;

    const safeName = displayName || username || 'User';
    const avatarUrl = rawEvent.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=random&color=fff&size=128&bold=true`;

    // Chống spam: debounce 800ms cho cùng một người dùng
    const lastTime = this.recentComments.get(username) || 0;
    if (Date.now() - lastTime < 800) {
      return;
    }
    this.recentComments.set(username, Date.now());

    // Ghi nhận tương tác của người chơi để không bị coi là lướt live
    this.emit('player:activity', { username });

    const trimmed = comment.trim();
    const upper = trimmed.toUpperCase();

    // Chuẩn hóa chuỗi bình luận
    const cleanUpper = upper.replace(/[!./#,:;]/g, '').trim();

    // 1. Phân loại lệnh JOIN / VÀO LỚP (Nhận diện rộng rãi các biến thể)
    const isJoin = cleanUpper === 'JOIN' ||
                   cleanUpper === 'VAO LOP' ||
                   cleanUpper === 'VÀO LỚP' ||
                   cleanUpper === 'VAOLOP' ||
                   cleanUpper === 'VAO' ||
                   cleanUpper === 'VÀO' ||
                   cleanUpper === 'THAM GIA' ||
                   cleanUpper === 'THAMGIA' ||
                   cleanUpper === 'DI HOC' ||
                   cleanUpper === 'ĐI HỌC' ||
                   upper.includes('VÀO LỚP') ||
                   upper.includes('VAO LOP') ||
                   upper.includes('THAM GIA') ||
                   upper.includes('XIN VÀO') ||
                   upper.includes('CHO EM VÀO') ||
                   upper.includes('CHO VÀO') ||
                   upper.includes('ĐI HỌC') ||
                   upper.includes('DI HOC') ||
                   cleanUpper.startsWith('JOIN') ||
                   cleanUpper.startsWith('VÀO');

    if (isJoin) {
      this.emit('player:join', {
        userId: userId || username,
        username,
        displayName: displayName || username,
        avatarUrl,
        timestamp: timestamp || Date.now(),
        isBot: rawEvent.isBot === true
      });
      return;
    }

    // 2. Phân loại lệnh RỜI LỚP / OUT / QUIT / LEAVE / THOÁT
    const isLeave = cleanUpper === 'OUT' ||
                    cleanUpper === 'ROI LOP' ||
                    cleanUpper === 'RỜI LỚP' ||
                    cleanUpper === 'QUIT' ||
                    cleanUpper === 'LEAVE' ||
                    cleanUpper === 'THOAT' ||
                    cleanUpper === 'THOÁT' ||
                    upper.includes('RỜI LỚP') ||
                    upper.includes('ROI LOP');

    if (isLeave) {
      this.emit('player:leave', {
        username,
        timestamp: timestamp || Date.now()
      });
      return;
    }

    // 2. Phân loại lệnh TOP / BXH
    if (upper === 'TOP' || upper === 'BXH' || upper === 'DIEM' || upper === 'SCORE') {
      this.emit('command:top', { username });
      return;
    }

    // 3. Phân loại lệnh HELP / GIÚP
    if (upper === 'HELP' || upper === 'GIUP' || upper === 'HUONG DAN') {
      this.emit('command:help', { username });
      return;
    }

    // 4. Phân loại Trả lời trắc nghiệm (A, B, C, D hoặc "CHỌN A", "ĐÁP ÁN B")
    const optionMatch = upper.match(/^(?:CHON|DAP AN|DAPAN|CHỌN|ĐÁP ÁN)?\s*([A-D])$/);
    if (optionMatch) {
      this.emit('player:answer', {
        userId: userId || username,
        username,
        displayName: displayName || username,
        answer: optionMatch[1],
        rawText: trimmed,
        timestamp: timestamp || Date.now()
      });
      return;
    }

    // 5. Phân loại Trả lời Đúng / Sai
    if (upper === 'ĐÚNG' || upper === 'DUNG' || upper === 'TRUE' || upper === 'D') {
      this.emit('player:answer', {
        userId: userId || username,
        username,
        displayName: displayName || username,
        answer: 'ĐÚNG',
        rawText: trimmed,
        timestamp: timestamp || Date.now()
      });
      return;
    }
    if (upper === 'SAI' || upper === 'FALSE' || upper === 'S') {
      this.emit('player:answer', {
        userId: userId || username,
        username,
        displayName: displayName || username,
        answer: 'SAI',
        rawText: trimmed,
        timestamp: timestamp || Date.now()
      });
      return;
    }

    // 6. Câu trả lời dạng văn bản / số
    this.emit('player:answer', {
      userId: userId || username,
      username,
      displayName: displayName || username,
      answer: trimmed,
      rawText: trimmed,
      timestamp: timestamp || Date.now()
    });
  }

  simulateComment(username, comment, displayName, avatarUrl) {
    this.processIncomingComment({
      userId: `sim_${username}`,
      username,
      displayName: displayName || username,
      comment,
      avatarUrl,
      timestamp: Date.now(),
      isBot: true // Học sinh giả lập từ Simulator
    });
  }

  disconnect() {
    if (this.liveConnection) {
      try {
        this.liveConnection.disconnect();
      } catch (e) {}
    }
    this.isConnected = false;
  }
}

module.exports = new TikTokConnector();
