const config = require('../config/config');

class AIQuestionService {
  /**
   * Tạo bộ câu hỏi bằng AI hoặc Smart Generator
   * @param {string} subjectName Tên môn học
   * @param {string} topic Chủ đề cụ thể
   * @param {string} difficulty Độ khó ('EASY', 'MEDIUM', 'HARD')
   * @param {number} count Số lượng câu hỏi muốn tạo
   */
  async generateQuestions(subjectName, topic = '', difficulty = 'MEDIUM', count = 3) {
    if (config.ai.geminiApiKey) {
      try {
        return await this.generateWithGemini(subjectName, topic, difficulty, count);
      } catch (err) {
        console.warn('[AI Service] Lỗi gọi Gemini API, chuyển sang Smart Generative Fallback:', err.message);
      }
    }

    return this.generateSmartFallback(subjectName, topic, difficulty, count);
  }

  async generateWithGemini(subjectName, topic, difficulty, count) {
    const prompt = `Bạn là một giáo viên chuyên gia. Hãy tạo ${count} câu hỏi trắc nghiệm tiếng Việt môn ${subjectName}${topic ? ` về chủ đề ${topic}` : ''} với độ khó ${difficulty} dành cho học sinh.
Định dạng trả về duy nhất là JSON array, không kèm markdown backticks, theo cấu trúc:
[
  {
    "questionType": "MULTIPLE_CHOICE",
    "content": "Nội dung câu hỏi?",
    "options": [
      {"key": "A", "text": "Phương án 1", "isCorrect": false},
      {"key": "B", "text": "Phương án 2", "isCorrect": true},
      {"key": "C", "text": "Phương án 3", "isCorrect": false},
      {"key": "D", "text": "Phương án 4", "isCorrect": false}
    ],
    "correctAnswer": "B",
    "explanation": "Giải thích ngắn gọn súc tích",
    "difficulty": "${difficulty}",
    "timeLimit": 20
  }
]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.ai.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
    const data = await res.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  }

  generateSmartFallback(subjectName, topic, difficulty, count) {
    const templates = {
      'Toán học': [
        {
          q: 'Cho hình vuông có cạnh là 6 cm. Diện tích của hình vuông đó là:',
          a: '36 cm²',
          opts: ['24 cm²', '36 cm²', '30 cm²', '12 cm²'],
          expl: 'Diện tích hình vuông = cạnh x cạnh = 6 x 6 = 36 cm².'
        },
        {
          q: 'Số nguyên tố nhỏ nhất là số nào?',
          a: '2',
          opts: ['0', '1', '2', '3'],
          expl: '2 là số nguyên tố chẵn và nhỏ nhất.'
        },
        {
          q: 'Giá trị của biểu thức (15 + 25) : 5 là:',
          a: '8',
          opts: ['6', '8', '10', '12'],
          expl: '(15 + 25) = 40; 40 : 5 = 8.'
        }
      ],
      'Lịch sử': [
        {
          q: 'Vị vua nào đã ban chiếu dời đô về Thăng Long năm 1010?',
          a: 'Lý Thái Tổ',
          opts: ['Lý Thái Tổ', 'Lê Lợi', 'Trần Hưng Đạo', 'Quang Trung'],
          expl: 'Năm Canh Tuất 1010, vua Lý Thái Tổ ban Chiếu dời đô từ Hoa Lư về Thăng Long.'
        },
        {
          q: 'Tuyên ngôn Độc lập khai sinh nước VNDCCH được đọc tại đâu?',
          a: 'Quảng trường Ba Đình',
          opts: ['Nhà hát Lớn Hà Nội', 'Quảng trường Ba Đình', 'Bến Nhà Rồng', 'Dinh Độc Lập'],
          expl: 'Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình ngày 2/9/1945.'
        }
      ],
      'Địa lý': [
        {
          q: 'Quốc gia nào có đường bờ biển dài nhất thế giới?',
          a: 'Canada',
          opts: ['Nga', 'Indonesia', 'Canada', 'Úc'],
          expl: 'Canada có đường bờ biển dài nhất thế giới với hơn 202.080 km.'
        },
        {
          q: 'Sông Mê Kông chảy qua bao nhiêu quốc gia?',
          a: '6 quốc gia',
          opts: ['4 quốc gia', '5 quốc gia', '6 quốc gia', '7 quốc gia'],
          expl: 'Sông Mê Kông chảy qua Trung Quốc, Myanmar, Lào, Thái Lan, Campuchia và Việt Nam.'
        }
      ],
      'Tiếng Anh': [
        {
          q: 'What is the opposite of "Generous"?',
          a: 'Stingy',
          opts: ['Kind', 'Stingy', 'Friendly', 'Polite'],
          expl: '"Generous" (hào phóng) trái nghĩa với "Stingy" (keo kiệt).'
        }
      ]
    };

    const list = templates[subjectName] || templates['Toán học'];
    const results = [];
    const keys = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < Math.min(count, list.length); i++) {
      const item = list[i];
      const correctIdx = item.opts.indexOf(item.a);
      const options = item.opts.map((opt, idx) => ({
        key: keys[idx],
        text: opt,
        isCorrect: idx === correctIdx
      }));

      results.push({
        questionType: 'MULTIPLE_CHOICE',
        content: item.q,
        options,
        correctAnswer: keys[correctIdx],
        explanation: item.expl,
        difficulty,
        timeLimit: 20
      });
    }

    return results;
  }
}

module.exports = new AIQuestionService();
