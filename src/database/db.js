const mssql = require('mssql');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { subjectsData } = require('./seedData');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isMssqlConnected = false;
    this.memoryStore = {
      subjects: [],
      questionPacks: [],
      questions: [],
      questionOptions: [],
      players: new Map(), // key: tiktokUserId
      playerAnswers: new Map(), // key: `${sessionId}_${questionId}_${playerId}` (anti-duplication)
      scoreEvents: [],
      leaderboards: new Map(), // key: `${sessionId}_${playerId}`
      sessions: new Map(),
      settings: new Map()
    };
  }

  async initialize() {
    console.log('[DB] Đang khởi tạo kết nối Cơ sở dữ liệu...');

    // Nếu cấu hình DB_TYPE là 'mssql', cố gắng kết nối Microsoft SQL Server
    if (config.db.type === 'mssql') {
      try {
        const sqlConfig = {
          user: config.db.user,
          password: config.db.password,
          server: config.db.server,
          port: config.db.port,
          database: config.db.database,
          options: config.db.options
        };

        this.pool = await new mssql.ConnectionPool(sqlConfig).connect();
        this.isMssqlConnected = true;
        console.log(`[DB] ĐÃ KẾT NỐI THÀNH CÔNG Microsoft SQL Server tại ${config.db.server}:${config.db.port}/${config.db.database}`);
        
        await this.ensureMssqlSchema();
        await this.seedMssqlData();
        return;
      } catch (err) {
        console.warn(`[DB] Không thể kết nối trực tiếp đến SQL Server (${err.message}).`);
        console.warn(`[DB] Tự động kích hoạt cơ chế Local Resilient Storage để game chạy tức thì không bị gián đoạn!`);
        this.isMssqlConnected = false;
      }
    }

    // Khởi tạo bộ lưu trữ Resilient In-Memory & File Sync
    await this.initMemoryStore();
  }

  async ensureMssqlSchema() {
    if (!this.isMssqlConnected || !this.pool) return;
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const rawSql = fs.readFileSync(schemaPath, 'utf8');
        // Tách các lệnh GO
        const batches = rawSql.split(/\bGO\b/i).filter(b => b.trim().length > 0);
        for (const batch of batches) {
          try {
            await this.pool.request().batch(batch);
          } catch (e) {
            // bỏ qua lỗi nếu db/bảng đã tồn tại
          }
        }
        console.log('[DB] Kiểm tra Schema SQL Server hoàn tất.');
      }
    } catch (err) {
      console.error('[DB] Lỗi khi nạp schema SQL Server:', err.message);
    }
  }

  async seedMssqlData() {
    if (!this.isMssqlConnected || !this.pool) return;
    try {
      const checkResult = await this.pool.request().query('SELECT COUNT(*) as count FROM Subjects');
      if (checkResult.recordset[0].count === 0) {
        console.log('[DB] Đang nạp dữ liệu mẫu 15 môn học vào SQL Server...');
        for (const subj of subjectsData) {
          const sRes = await this.pool.request()
            .input('code', mssql.NVarChar, subj.code)
            .input('name', mssql.NVarChar, subj.name)
            .input('icon', mssql.NVarChar, subj.icon)
            .input('color', mssql.NVarChar, subj.color)
            .input('desc', mssql.NVarChar, subj.description)
            .query(`INSERT INTO Subjects (Code, Name, Icon, Color, Description) 
                    OUTPUT INSERTED.Id 
                    VALUES (@code, @name, @icon, @color, @desc)`);
          const subjectId = sRes.recordset[0].Id;

          // Tạo Pack mặc định
          const pRes = await this.pool.request()
            .input('subjectId', mssql.Int, subjectId)
            .input('title', mssql.NVarChar, `Bộ câu hỏi ${subj.name}`)
            .query(`INSERT INTO QuestionPacks (SubjectId, Title, TotalQuestions) 
                    OUTPUT INSERTED.Id 
                    VALUES (@subjectId, @title, 0)`);
          const packId = pRes.recordset[0].Id;

          // Thêm các câu hỏi
          for (const q of subj.questions) {
            const qRes = await this.pool.request()
              .input('packId', mssql.Int, packId)
              .input('subjectId', mssql.Int, subjectId)
              .input('type', mssql.NVarChar, q.type)
              .input('diff', mssql.NVarChar, q.difficulty)
              .input('content', mssql.NVarChar, q.content)
              .input('correct', mssql.NVarChar, q.correctAnswer)
              .input('expl', mssql.NVarChar, q.explanation)
              .input('timeLimit', mssql.Int, q.timeLimit)
              .query(`INSERT INTO Questions (PackId, SubjectId, QuestionType, Difficulty, Content, CorrectAnswer, Explanation, TimeLimit)
                      OUTPUT INSERTED.Id
                      VALUES (@packId, @subjectId, @type, @diff, @content, @correct, @expl, @timeLimit)`);
            const qId = qRes.recordset[0].Id;

            for (const opt of q.options || []) {
              await this.pool.request()
                .input('qId', mssql.Int, qId)
                .input('key', mssql.NVarChar, opt.key)
                .input('text', mssql.NVarChar, opt.text)
                .input('isCorrect', mssql.Bit, opt.isCorrect ? 1 : 0)
                .query(`INSERT INTO QuestionOptions (QuestionId, OptionKey, OptionText, IsCorrect)
                        VALUES (@qId, @key, @text, @isCorrect)`);
            }
          }
        }
        console.log('[DB] Nạp dữ liệu khởi tạo SQL Server thành công!');
      }
    } catch (err) {
      console.error('[DB] Lỗi nạp seed MSSQL:', err.message);
    }
  }

  async initMemoryStore() {
    console.log('[DB] Đang nạp dữ liệu 15 môn học vào bộ nhớ...');
    let subjId = 1;
    let packId = 1;
    let qId = 1;

    for (const subj of subjectsData) {
      const subjectObj = {
        id: subjId++,
        code: subj.code,
        name: subj.name,
        icon: subj.icon,
        color: subj.color,
        description: subj.description,
        isActive: true
      };
      this.memoryStore.subjects.push(subjectObj);

      const packObj = {
        id: packId++,
        subjectId: subjectObj.id,
        title: `Bộ câu hỏi ${subj.name}`,
        totalQuestions: subj.questions.length,
        isActive: true
      };
      this.memoryStore.questionPacks.push(packObj);

      for (const q of subj.questions) {
        const questionObj = {
          id: qId++,
          packId: packObj.id,
          subjectId: subjectObj.id,
          questionType: q.type,
          difficulty: q.difficulty,
          content: q.content,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          timeLimit: q.timeLimit ? Math.max(35, q.timeLimit) : 35,
          pointsBase: 10,
          options: (q.options || []).map(opt => ({
            key: opt.key,
            text: opt.text,
            isCorrect: !!opt.isCorrect
          }))
        };
        this.memoryStore.questions.push(questionObj);
      }
    }
    console.log(`[DB] Đã nạp ${this.memoryStore.subjects.length} môn học và ${this.memoryStore.questions.length} câu hỏi mẫu vào bộ nhớ.`);
  }

  // API Methods
  async getSubjects() {
    if (this.isMssqlConnected && this.pool) {
      const res = await this.pool.request().query('SELECT * FROM Subjects WHERE IsActive = 1 ORDER BY Id ASC');
      return res.recordset;
    }
    return this.memoryStore.subjects.filter(s => s.isActive);
  }

  async getAllQuestions() {
    if (this.isMssqlConnected && this.pool) {
      const qRes = await this.pool.request().query(`
        SELECT q.*, s.Name as SubjectName, s.Icon as SubjectIcon, s.Color as SubjectColor 
        FROM Questions q
        JOIN Subjects s ON q.SubjectId = s.Id
        WHERE q.IsActive = 1
      `);
      const optRes = await this.pool.request().query('SELECT * FROM QuestionOptions');
      
      const optionsMap = {};
      for (const opt of optRes.recordset) {
        if (!optionsMap[opt.QuestionId]) optionsMap[opt.QuestionId] = [];
        optionsMap[opt.QuestionId].push({
          key: opt.OptionKey,
          text: opt.OptionText,
          isCorrect: !!opt.IsCorrect
        });
      }

      return qRes.recordset.map(q => ({
        id: q.Id,
        packId: q.PackId,
        subjectId: q.SubjectId,
        subjectName: q.SubjectName,
        subjectIcon: q.SubjectIcon,
        subjectColor: q.SubjectColor,
        questionType: q.QuestionType,
        difficulty: q.Difficulty,
        content: q.Content,
        correctAnswer: q.CorrectAnswer,
        explanation: q.Explanation,
        timeLimit: q.TimeLimit,
        pointsBase: q.PointsBase,
        options: optionsMap[q.Id] || []
      }));
    }

    return this.memoryStore.questions.map(q => {
      const subj = this.memoryStore.subjects.find(s => s.id === q.subjectId);
      return {
        ...q,
        subjectName: subj ? subj.name : '',
        subjectIcon: subj ? subj.icon : '📚',
        subjectColor: subj ? subj.color : '#3498db'
      };
    });
  }

  async getQuestionsBySubject(subjectId) {
    const all = await this.getAllQuestions();
    if (!subjectId) return all;
    return all.filter(q => q.subjectId === parseInt(subjectId, 10));
  }

  async addQuestion(questionData) {
    if (this.isMssqlConnected && this.pool) {
      const tx = new mssql.Transaction(this.pool);
      await tx.begin();
      try {
        const qReq = new mssql.Request(tx);
        const res = await qReq
          .input('packId', mssql.Int, questionData.packId || 1)
          .input('subjectId', mssql.Int, questionData.subjectId)
          .input('type', mssql.NVarChar, questionData.questionType || 'MULTIPLE_CHOICE')
          .input('diff', mssql.NVarChar, questionData.difficulty || 'MEDIUM')
          .input('content', mssql.NVarChar, questionData.content)
          .input('correct', mssql.NVarChar, questionData.correctAnswer)
          .input('expl', mssql.NVarChar, questionData.explanation || '')
          .input('timeLimit', mssql.Int, questionData.timeLimit || 20)
          .query(`INSERT INTO Questions (PackId, SubjectId, QuestionType, Difficulty, Content, CorrectAnswer, Explanation, TimeLimit)
                  OUTPUT INSERTED.Id
                  VALUES (@packId, @subjectId, @type, @diff, @content, @correct, @expl, @timeLimit)`);
        const qId = res.recordset[0].Id;

        for (const opt of questionData.options || []) {
          const optReq = new mssql.Request(tx);
          await optReq
            .input('qId', mssql.Int, qId)
            .input('key', mssql.NVarChar, opt.key)
            .input('text', mssql.NVarChar, opt.text)
            .input('isCorrect', mssql.Bit, opt.isCorrect ? 1 : 0)
            .query(`INSERT INTO QuestionOptions (QuestionId, OptionKey, OptionText, IsCorrect)
                    VALUES (@qId, @key, @text, @isCorrect)`);
        }
        await tx.commit();
        return { ...questionData, id: qId };
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }

    const newId = this.memoryStore.questions.length + 1;
    const newQ = {
      id: newId,
      packId: questionData.packId || 1,
      subjectId: parseInt(questionData.subjectId, 10),
      questionType: questionData.questionType || 'MULTIPLE_CHOICE',
      difficulty: questionData.difficulty || 'MEDIUM',
      content: questionData.content,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation || '',
      timeLimit: parseInt(questionData.timeLimit, 10) || 20,
      pointsBase: 10,
      options: questionData.options || []
    };
    this.memoryStore.questions.push(newQ);
    return newQ;
  }

  async findOrCreatePlayer(tiktokUserId, username, displayName, avatarStyle, avatarUrl) {
    const defaultAvatar = avatarStyle || {
      hairStyle: Math.floor(Math.random() * 5),
      hairColor: ['#2c3e50', '#795548', '#e67e22', '#16a085', '#e91e63'][Math.floor(Math.random() * 5)],
      shirtColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e'][Math.floor(Math.random() * 6)],
      skinColor: ['#ffe0bd', '#ffd1a4', '#f1c27d', '#e0ac69'][Math.floor(Math.random() * 4)],
      gender: Math.random() > 0.5 ? 'male' : 'female',
      avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username)}&background=random&color=fff&size=128&bold=true`
    };

    if (this.isMssqlConnected && this.pool) {
      const checkRes = await this.pool.request()
        .input('userId', mssql.NVarChar, tiktokUserId)
        .query('SELECT * FROM Players WHERE TikTokUserId = @userId');
      
      if (checkRes.recordset.length > 0) {
        const found = checkRes.recordset[0];
        const parsedAvatar = typeof found.AvatarStyleJson === 'string' ? JSON.parse(found.AvatarStyleJson) : found.AvatarStyleJson;
        return {
          ...found,
          avatarUrl: parsedAvatar.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(found.DisplayName || found.TikTokUsername)}&background=random&color=fff&size=128&bold=true`
        };
      }

      const insertRes = await this.pool.request()
        .input('userId', mssql.NVarChar, tiktokUserId)
        .input('username', mssql.NVarChar, username)
        .input('displayName', mssql.NVarChar, displayName || username)
        .input('avatar', mssql.NVarChar, JSON.stringify(defaultAvatar))
        .query(`INSERT INTO Players (TikTokUserId, TikTokUsername, DisplayName, AvatarStyleJson)
                OUTPUT INSERTED.*
                VALUES (@userId, @username, @displayName, @avatar)`);
      const created = insertRes.recordset[0];
      return {
        ...created,
        avatarUrl: defaultAvatar.avatarUrl
      };
    }

    if (this.memoryStore.players.has(tiktokUserId)) {
      return this.memoryStore.players.get(tiktokUserId);
    }

    const player = {
      id: this.memoryStore.players.size + 1,
      tiktokUserId,
      tiktokUsername: username,
      displayName: displayName || username,
      avatarStyle: defaultAvatar,
      avatarUrl: defaultAvatar.avatarUrl,
      totalScoreAllTime: 0,
      totalCorrectAllTime: 0,
      firstJoinedAt: new Date(),
      lastActiveAt: new Date()
    };
    this.memoryStore.players.set(tiktokUserId, player);
    return player;
  }

  // Ghi nhận câu trả lời với ràng buộc chống trùng lặp điểm
  async recordPlayerAnswer(sessionId, questionId, playerId, answer, isCorrect, responseTime, points) {
    const key = `${sessionId}_${questionId}_${playerId}`;

    if (this.isMssqlConnected && this.pool) {
      try {
        await this.pool.request()
          .input('sId', mssql.Int, sessionId)
          .input('qId', mssql.Int, questionId)
          .input('pId', mssql.Int, playerId)
          .input('ans', mssql.NVarChar, String(answer))
          .input('isCorrect', mssql.Bit, isCorrect ? 1 : 0)
          .input('time', mssql.Float, responseTime)
          .input('pts', mssql.Int, points)
          .query(`INSERT INTO PlayerAnswers (SessionId, QuestionId, PlayerId, AnswerGiven, IsCorrect, ResponseTimeSeconds, PointsAwarded)
                  VALUES (@sId, @qId, @pId, @ans, @isCorrect, @time, @pts)`);

        if (points > 0) {
          await this.pool.request()
            .input('sId', mssql.Int, sessionId)
            .input('qId', mssql.Int, questionId)
            .input('pId', mssql.Int, playerId)
            .input('type', mssql.NVarChar, 'CORRECT_ANSWER')
            .input('pts', mssql.Int, points)
            .input('reason', mssql.NVarChar, `Trả lời đúng (${responseTime.toFixed(1)}s)`)
            .query(`INSERT INTO ScoreEvents (SessionId, QuestionId, PlayerId, EventType, Points, Reason)
                    VALUES (@sId, @qId, @pId, @type, @pts, @reason)`);
        }
        return { success: true, duplicated: false };
      } catch (err) {
        // Vi phạm UNIQUE constraint (2627 hoặc 2601 trong MSSQL)
        if (err.number === 2627 || err.number === 2601) {
          return { success: false, duplicated: true };
        }
        throw err;
      }
    }

    if (this.memoryStore.playerAnswers.has(key)) {
      return { success: false, duplicated: true };
    }

    const answerRecord = {
      sessionId,
      questionId,
      playerId,
      answerGiven: String(answer),
      isCorrect,
      responseTimeSeconds: responseTime,
      pointsAwarded: points,
      answeredAt: new Date()
    };
    this.memoryStore.playerAnswers.set(key, answerRecord);

    if (points > 0) {
      this.memoryStore.scoreEvents.push({
        sessionId,
        questionId,
        playerId,
        eventType: 'CORRECT_ANSWER',
        points,
        reason: `Trả lời đúng (${responseTime.toFixed(1)}s)`,
        createdAt: new Date()
      });
    }

    return { success: true, duplicated: false };
  }

  async updateLeaderboard(sessionId, playerId, points, isCorrect, responseTime) {
    if (this.isMssqlConnected && this.pool) {
      await this.pool.request()
        .input('sId', mssql.Int, sessionId)
        .input('pId', mssql.Int, playerId)
        .input('pts', mssql.Int, points)
        .input('isCorrect', mssql.Bit, isCorrect ? 1 : 0)
        .input('time', mssql.Float, responseTime)
        .query(`
          MERGE Leaderboards AS target
          USING (SELECT @sId AS SessionId, @pId AS PlayerId) AS source
          ON (target.SessionId = source.SessionId AND target.PlayerId = source.PlayerId)
          WHEN MATCHED THEN
            UPDATE SET 
              TotalScore = target.TotalScore + @pts,
              CorrectCount = target.CorrectCount + (CASE WHEN @isCorrect = 1 THEN 1 ELSE 0 END),
              WrongCount = target.WrongCount + (CASE WHEN @isCorrect = 0 THEN 1 ELSE 0 END),
              StreakCount = (CASE WHEN @isCorrect = 1 THEN target.StreakCount + 1 ELSE 0 END),
              MaxStreak = (CASE WHEN @isCorrect = 1 AND (target.StreakCount + 1) > target.MaxStreak THEN target.StreakCount + 1 ELSE target.MaxStreak END),
              AvgResponseTime = (target.AvgResponseTime + @time) / 2.0,
              UpdatedAt = SYSDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (SessionId, PlayerId, TotalScore, CorrectCount, WrongCount, StreakCount, MaxStreak, AvgResponseTime)
            VALUES (@sId, @pId, @pts, (CASE WHEN @isCorrect = 1 THEN 1 ELSE 0 END), (CASE WHEN @isCorrect = 0 THEN 1 ELSE 0 END), (CASE WHEN @isCorrect = 1 THEN 1 ELSE 0 END), (CASE WHEN @isCorrect = 1 THEN 1 ELSE 0 END), @time);
        `);
      return;
    }

    const key = `${sessionId}_${playerId}`;
    let entry = this.memoryStore.leaderboards.get(key);
    if (!entry) {
      entry = {
        sessionId,
        playerId,
        totalScore: 0,
        correctCount: 0,
        wrongCount: 0,
        streakCount: 0,
        maxStreak: 0,
        avgResponseTime: responseTime,
        totalAnswered: 0
      };
      this.memoryStore.leaderboards.set(key, entry);
    }

    entry.totalScore += points;
    entry.totalAnswered += 1;
    if (isCorrect) {
      entry.correctCount += 1;
      entry.streakCount += 1;
      if (entry.streakCount > entry.maxStreak) {
        entry.maxStreak = entry.streakCount;
      }
    } else {
      entry.wrongCount += 1;
      entry.streakCount = 0;
    }
    entry.avgResponseTime = (entry.avgResponseTime + responseTime) / 2.0;
  }

  // Xóa điểm số người chơi khỏi Bảng xếp hạng khi rời lớp / thoát phiên live
  async removePlayerFromLeaderboard(sessionId, playerId) {
    if (this.isMssqlConnected && this.pool) {
      await this.pool.request()
        .input('sId', mssql.Int, sessionId)
        .input('pId', mssql.Int, playerId)
        .query(`DELETE FROM Leaderboards WHERE SessionId = @sId AND PlayerId = @pId`);
      return;
    }

    const key = `${sessionId}_${playerId}`;
    this.memoryStore.leaderboards.delete(key);
  }

  // Làm sạch toàn bộ bảng xếp hạng của phiên học
  async clearLeaderboard(sessionId) {
    if (this.isMssqlConnected && this.pool) {
      await this.pool.request()
        .input('sId', mssql.Int, sessionId)
        .query(`DELETE FROM Leaderboards WHERE SessionId = @sId`);
      return;
    }

    for (const [key, entry] of this.memoryStore.leaderboards.entries()) {
      if (entry.sessionId === sessionId) {
        this.memoryStore.leaderboards.delete(key);
      }
    }
  }

  async getTopLeaderboard(sessionId, limit = 10) {
    if (this.isMssqlConnected && this.pool) {
      const res = await this.pool.request()
        .input('sId', mssql.Int, sessionId)
        .input('limit', mssql.Int, limit)
        .query(`
          SELECT TOP (@limit) 
            l.TotalScore, l.CorrectCount, l.StreakCount, l.MaxStreak, l.AvgResponseTime,
            p.Id as PlayerId, p.TikTokUsername, p.DisplayName, p.AvatarStyleJson
          FROM Leaderboards l
          JOIN Players p ON l.PlayerId = p.Id
          WHERE l.SessionId = @sId
          ORDER BY l.TotalScore DESC, l.CorrectCount DESC, l.AvgResponseTime ASC
        `);
      return res.recordset.map((row, idx) => {
        const parsedAvatar = typeof row.AvatarStyleJson === 'string' ? JSON.parse(row.AvatarStyleJson) : row.AvatarStyleJson;
        return {
          rank: idx + 1,
          playerId: row.PlayerId,
          username: row.TikTokUsername,
          displayName: row.DisplayName,
          avatarStyle: parsedAvatar,
          avatarUrl: (parsedAvatar && parsedAvatar.avatarUrl) ? parsedAvatar.avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.DisplayName || row.TikTokUsername)}&background=random&color=fff&size=128&bold=true`,
          totalScore: row.TotalScore,
          correctCount: row.CorrectCount,
          streakCount: row.StreakCount,
          avgResponseTime: row.AvgResponseTime
        };
      });
    }

    const entries = Array.from(this.memoryStore.leaderboards.values())
      .filter(e => e.sessionId === sessionId);

    // Tiêu chí sắp xếp: Điểm cao nhất -> Số câu đúng nhiều nhất -> Thời gian trả lời trung bình nhanh nhất
    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.avgResponseTime - b.avgResponseTime;
    });

    const topList = entries.slice(0, limit);
    return topList.map((entry, idx) => {
      let player = null;
      for (const p of this.memoryStore.players.values()) {
        if (p.id === entry.playerId) {
          player = p;
          break;
        }
      }
      return {
        rank: idx + 1,
        playerId: entry.playerId,
        username: player ? player.tiktokUsername : `User_${entry.playerId}`,
        displayName: player ? player.displayName : `User_${entry.playerId}`,
        avatarStyle: player ? player.avatarStyle : null,
        avatarUrl: player ? (player.avatarUrl || (player.avatarStyle && player.avatarStyle.avatarUrl)) : `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=128&bold=true`,
        totalScore: entry.totalScore,
        correctCount: entry.correctCount,
        streakCount: entry.streakCount,
        avgResponseTime: entry.avgResponseTime
      };
    });
  }

  async createSession(title, subjectId) {
    const sessionCode = `LIVE_${Date.now()}`;
    if (this.isMssqlConnected && this.pool) {
      const res = await this.pool.request()
        .input('code', mssql.NVarChar, sessionCode)
        .input('title', mssql.NVarChar, title || 'Tiết học TikTok LIVE')
        .input('sId', mssql.Int, subjectId || null)
        .query(`INSERT INTO LiveSessions (SessionCode, Title, SubjectId, Status)
                OUTPUT INSERTED.*
                VALUES (@code, @title, @sId, 'ACTIVE')`);
      return res.recordset[0];
    }

    const session = {
      id: this.memoryStore.sessions.size + 1,
      sessionCode,
      title: title || 'Tiết học TikTok LIVE',
      subjectId: subjectId || null,
      status: 'ACTIVE',
      startedAt: new Date(),
      totalParticipants: 0,
      totalQuestionsAsked: 0
    };
    this.memoryStore.sessions.set(session.id, session);
    return session;
  }
}

const db = new DatabaseService();
module.exports = db;
