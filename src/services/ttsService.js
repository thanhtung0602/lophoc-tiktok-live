const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class TTSService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../../public/assets/tts_cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.voiceSettings = {
      speed: config.tts.speed,
      pitch: config.tts.pitch,
      voice: config.tts.defaultVoice, // 'female' or 'male'
      lang: 'vi-VN'
    };
  }

  pickRandom(arr) {
    if (!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  getCacheHash(text, voice) {
    return crypto.createHash('md5').update(`${text}_${voice || this.voiceSettings.voice}`).digest('hex');
  }

  updateSettings(settings) {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
  }

  /**
   * Tạo kịch bản chuẩn cho giáo viên AI đọc câu hỏi
   * @param {Object} question
   * @param {number} questionNumber
   * @returns {{ fullScript: string, questionOnly: string, optionsScript: string }}
   */
  generateQuestionScript(question, questionNumber = 1) {
    const qNumText = `Câu hỏi số ${questionNumber}: ${question.content}`;
    let optText = '';

    if (question.options && question.options.length > 0) {
      if (question.questionType === 'TRUE_FALSE') {
        optText = 'Đáp án A: Đúng, hoặc Đáp án B: Sai.';
      } else {
        optText = question.options.map(o => `Đáp án ${o.key}: ${o.text}.`).join(' ');
      }
    }

    const fullScript = optText ? `${qNumText}. ${optText}`.trim() : qNumText;
    return {
      fullScript,
      questionOnly: qNumText,
      optionsScript: optText
    };
  }

  generateRevealScript(question, correctStudents = [], topLeaderboard = []) {
    let script = `Hết giờ! Đáp án chính xác là ${question.correctAnswer}.`;

    // 1. Chúc mừng các bạn học sinh trả lời đúng ở câu này (Ngôn ngữ an toàn 100%, tích cực, vui tươi)
    if (correctStudents && correctStudents.length > 0) {
      if (correctStudents.length === 1) {
        const singleName = (correctStudents[0].displayName || correctStudents[0].username || '').replace(/_/g, ' ');
        const singlePraise = this.pickRandom([
          ` Chúc mừng bạn ${singleName} xuất sắc nhất lớp đã trả lời rất nhanh và chính xác!`,
          ` Quá tuyệt vời, duy nhất bạn ${singleName} trả lời đúng câu này, mười điểm xuất sắc!`,
          ` Chiến thần tri thức ${singleName} nhảy số nhanh như chớp, lụm trọn điểm một mình luôn!`
        ]);
        script += singlePraise;
      } else {
        const multiPraise = this.pickRandom([
          ` Chúc mừng ${correctStudents.length} bạn đã chọn đúng, tư duy rất nhanh và chuẩn xác nha!`,
          ` Rất xuất sắc! Có hẳn ${correctStudents.length} bạn trả lời đúng câu này, đỉnh chóp luôn!`,
          ` Quá tuyệt vời, ${correctStudents.length} bạn đã ghi điểm trọn vẹn cho câu hỏi vừa rồi!`
        ]);
        script += multiPraise;
      }
    } else {
      const nonePraise = this.pickRandom([
        ` Câu này đánh đố một chút nên chưa có bạn nào chọn đúng, cùng cố gắng ở câu tiếp theo nha!`,
        ` Tiếc quá, chưa bạn nào chọn đúng câu này, câu sau chuẩn bị bứt phá lại nha các em!`,
        ` Câu hỏi này khá thử thách đấy, chúng mình cùng chuẩn bị sang câu tiếp theo nhé!`
      ]);
      script += nonePraise;
    }

    // 2. ĐỌC 3 NGƯỜI CÓ ĐIỂM CAO NHẤT HIỆN TẠI (TOP 3 SAU MỖI CÂU HỎI)
    if (topLeaderboard && topLeaderboard.length > 0) {
      const activeTop = topLeaderboard
        .filter(p => (p.totalScore || 0) > 0)
        .slice(0, 3);

      if (activeTop.length > 0) {
        const cleanName = (p) => (p.displayName || p.username || 'Bạn').replace(/_/g, ' ');
        if (activeTop.length === 3) {
          script += ` Top ba dẫn đầu hiện tại: Top một ${cleanName(activeTop[0])} ${activeTop[0].totalScore} điểm, Top hai ${cleanName(activeTop[1])} ${activeTop[1].totalScore} điểm, Top ba ${cleanName(activeTop[2])} ${activeTop[2].totalScore} điểm. Các bạn còn lại tăng tốc lên nào!`;
        } else if (activeTop.length === 2) {
          script += ` Dẫn đầu hiện tại: Top một ${cleanName(activeTop[0])} ${activeTop[0].totalScore} điểm, Top hai ${cleanName(activeTop[1])} ${activeTop[1].totalScore} điểm. Đua điểm rất sôi nổi!`;
        } else if (activeTop.length === 1) {
          script += ` Dẫn đầu hiện tại là bạn ${cleanName(activeTop[0])} với ${activeTop[0].totalScore} điểm. Xuất sắc!`;
        }
      }
    }

    return script;
  }

  generateWelcomeScript(subjectName) {
    const lines = [
      `Chào mừng các bạn học sinh thân yêu đến với tiết học môn ${subjectName || 'Kiến thức'}! Lớp học bắt đầu!`,
      `Tiết học môn ${subjectName || 'Kiến thức'} chính thức bắt đầu! Hãy cùng nhau thi đua trả lời thật nhanh nhé!`,
      `Chào mừng cả lớp! Hôm nay chúng ta cùng khám phá những câu hỏi thú vị môn ${subjectName || 'Kiến thức'}, bắt đầu nào!`
    ];
    return this.pickRandom(lines);
  }

  generateWarning5sScript() {
    const lines = [
      'Còn năm giây cuối, các em nhanh tay chọn đáp án nào!',
      'Năm giây nữa hết giờ, nhanh tay nào các bạn ơi!',
      'Đồng hồ đếm ngược năm giây cuối cùng, nhanh tay lên nào!'
    ];
    return this.pickRandom(lines);
  }

  generatePeriodSummaryScript(subjectName, top3 = []) {
    let script = `Tiết học môn ${subjectName || 'học'} mười phút đã kết thúc! `;
    if (top3 && top3.length > 0) {
      const top1 = top3[0] ? `Quán quân bạn ${top3[0].displayName || top3[0].username} đạt ${top3[0].totalScore} điểm` : '';
      const top2 = top3[1] ? `, Á quân bạn ${top3[1].displayName || top3[1].username} đạt ${top3[1].totalScore} điểm` : '';
      const top3rd = top3[2] ? `, Quý quân bạn ${top3[2].displayName || top3[2].username} đạt ${top3[2].totalScore} điểm` : '';
      script += `Xin nhiệt liệt biểu dương ba bạn học sinh xuất sắc nhất: ${top1}${top2}${top3rd}! Xuất sắc mười điểm! `;
    } else {
      script += `Cảm ơn tất cả các em đã tham gia rất tích cực! `;
    }
    script += `Các em có hai mươi giây giải lao thư giãn rồi cùng bước vào môn học tiếp theo nhé!`;
    return script;
  }

  generateRecessEndScript(nextSubjectName) {
    return `Hết giờ giải lao! Chúng ta cùng bắt đầu tiết học môn ${nextSubjectName || 'tiếp theo'} nhé các em!`;
  }

  /**
   * Trả về thông tin phát âm thanh cho Frontend/OBS Game View
   */
  getSpeechPayload(text, type = 'question') {
    const hash = this.getCacheHash(text, this.voiceSettings.voice);
    return {
      text,
      type,
      voice: this.voiceSettings.voice,
      speed: this.voiceSettings.speed,
      pitch: this.voiceSettings.pitch,
      lang: 'vi-VN',
      cacheKey: hash
    };
  }
}

module.exports = new TTSService();
