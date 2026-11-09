/**
 * DỊCH VỤ TÍNH ĐIỂM VÀ THƯỞNG TỐC ĐỘ, CHUỖI THẮNG
 */
const config = require('../config/config');

class ScoreService {
  constructor() {
    this.rules = { ...config.game.scoring };
  }

  updateRules(customRules) {
    this.rules = { ...this.rules, ...customRules };
  }

  /**
   * Tính toán điểm số dựa trên đáp án, thời gian trả lời và chuỗi đúng hiện tại
   * @param {boolean} isCorrect - Trả lời đúng hay sai
   * @param {number} responseTimeSeconds - Thời gian trả lời (giây)
   * @param {number} timeLimitSeconds - Tổng thời gian của câu hỏi (giây)
   * @param {number} currentStreak - Chuỗi trả lời đúng hiện tại trước câu hỏi này
   * @returns {{ totalPoints: number, basePoints: number, speedBonus: number, streakBonus: number, newStreak: number }}
   */
  calculateScore(isCorrect, responseTimeSeconds, timeLimitSeconds, currentStreak = 0) {
    if (!isCorrect) {
      return {
        totalPoints: 0,
        basePoints: 0,
        speedBonus: 0,
        streakBonus: 0,
        newStreak: 0
      };
    }

    const basePoints = this.rules.correctBase || 10;
    let speedBonus = 0;

    // Tính thưởng tốc độ: nếu trả lời trong nửa thời gian đầu, thưởng từ 1 đến 5 điểm
    if (timeLimitSeconds > 0 && responseTimeSeconds <= timeLimitSeconds) {
      const remainingRatio = Math.max(0, (timeLimitSeconds - responseTimeSeconds) / timeLimitSeconds);
      speedBonus = Math.round(remainingRatio * (this.rules.speedBonusMax || 5));
    }

    const newStreak = currentStreak + 1;
    let streakBonus = 0;

    if (newStreak >= 5) {
      streakBonus = this.rules.streak5Bonus || 5;
    } else if (newStreak >= 3) {
      streakBonus = this.rules.streak3Bonus || 3;
    }

    const totalPoints = basePoints + speedBonus + streakBonus;

    return {
      totalPoints,
      basePoints,
      speedBonus,
      streakBonus,
      newStreak
    };
  }
}

module.exports = new ScoreService();
