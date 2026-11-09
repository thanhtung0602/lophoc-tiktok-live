/**
 * SOUND & AUDIO SYNTHESIZER VÀ TEXT-TO-SPEECH CHO GAME LỚP HỌC
 * Sử dụng Web Audio API thuần túy (không phụ thuộc file âm thanh ngoài) + Web Speech API
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.ttsEnabled = true;
    this.voices = [];
    this.selectedVoice = null;
    this.hasNativeViVoice = false;
    this.onTeacherSpeakingChange = null;
    this.isSpeaking = false;
    this.currentSpeechType = null;
    this.currentAudio = null;
    this.cloudAudioQueue = [];
    this.cloudChunkTimer = null;

    this.initAudioContext();
    this.initTTS();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.autoUnlockAudio();
    } catch (e) {
      console.warn('Web Audio API không được hỗ trợ trên trình duyệt này');
    }
  }

  autoUnlockAudio() {
    // 1. Tự động kích hoạt ngay lập tức (hoạt động 100% trong OBS Browser Source CEF)
    this.ensureContext();

    // 2. Tự động mở khóa âm thanh bằng bất kỳ tương tác nào mà không cần bấm nút riêng
    const unlockEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown'];
    const unlock = () => {
      this.ensureContext();
      if (this.audioCtx && this.audioCtx.state === 'running') {
        unlockEvents.forEach(evt => window.removeEventListener(evt, unlock, true));
      }
    };
    unlockEvents.forEach(evt => window.addEventListener(evt, unlock, true));

    // 3. Tự động thử lại khi tài liệu tải xong
    if (document.readyState === 'complete') {
      this.ensureContext();
    } else {
      window.addEventListener('load', () => this.ensureContext(), { once: true });
    }
  }

  ensureContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  initTTS() {
    this.voices = [];
    this.selectedVoice = null;
    this.hasNativeViVoice = false;

    if (!('speechSynthesis' in window)) {
      console.warn('[SoundManager] Web Speech API không có sẵn (OBS CEF mode), kích hoạt Cloud TTS');
      return;
    }

    const loadVoices = () => {
      try {
        this.voices = window.speechSynthesis.getVoices() || [];
        // Ưu tiên giọng tiếng Việt
        this.selectedVoice = this.voices.find(v => v.lang && (v.lang.toLowerCase().includes('vi') || v.lang.toUpperCase().includes('VIE')));
        this.hasNativeViVoice = !!this.selectedVoice;
        console.log(`[SoundManager] Giọng hệ thống: ${this.voices.length}, Giọng tiếng Việt: ${this.hasNativeViVoice ? this.selectedVoice.name : 'Không có (Dùng Cloud TTS)'}`);
      } catch (e) {
        this.hasNativeViVoice = false;
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Cắt nhỏ văn bản thành các đoạn ngắn (dưới 150 ký tự) theo dấu câu để Cloud TTS đọc mượt mà
   */
  splitTextIntoChunks(text, maxLength = 150) {
    if (!text || !text.trim()) return [];
    const sentences = text.match(/[^.?!,;:]+[.?!,;:]+|[^.?!,;:]+$/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (let raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
        currentChunk = currentChunk ? (currentChunk + ' ' + sentence) : sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        if (sentence.length > maxLength) {
          const words = sentence.split(' ');
          let temp = '';
          for (const word of words) {
            if ((temp + ' ' + word).trim().length <= maxLength) {
              temp = temp ? (temp + ' ' + word) : word;
            } else {
              if (temp) chunks.push(temp.trim());
              temp = word;
            }
          }
          currentChunk = temp;
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }

  /**
   * Phát giọng đọc tiếng Việt qua Cloud TTS (Hoạt động 100% trong OBS Studio & mọi trình duyệt)
   */
  playCloudTTS(text, type = 'speech') {
    this.stopSpeech();
    this.isSpeaking = true;
    this.currentSpeechType = type;
    if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(true);

    const chunks = this.splitTextIntoChunks(text);
    if (chunks.length === 0) {
      this.isSpeaking = false;
      if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(false);
      return;
    }

    let chunkIndex = 0;

    const playNextChunk = () => {
      if (!this.isSpeaking || chunkIndex >= chunks.length) {
        this.isSpeaking = false;
        this.currentSpeechType = null;
        if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(false);
        return;
      }

      const chunkText = chunks[chunkIndex++];
      const encoded = encodeURIComponent(chunkText);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;

      const audio = new Audio(ttsUrl);
      this.currentAudio = audio;
      audio.playbackRate = 1.08; // Giọng đọc tự nhiên, chuẩn mực, truyền cảm hứng

      audio.onended = () => {
        if (this.isSpeaking) {
          this.cloudChunkTimer = setTimeout(playNextChunk, 120);
        }
      };

      audio.onerror = (err) => {
        console.warn('[SoundManager] Lỗi chunk Cloud TTS, chuyển câu tiếp:', err);
        if (this.isSpeaking) {
          this.cloudChunkTimer = setTimeout(playNextChunk, 100);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[SoundManager] Không thể tự động play audio chunk:', err);
          if (this.isSpeaking) {
            this.cloudChunkTimer = setTimeout(playNextChunk, 100);
          }
        });
      }
    };

    playNextChunk();
  }

  speak(text, speed = 1.12, pitch = 1.0, type = 'speech') {
    if (this.isMuted || !this.ttsEnabled) return;
    if (!text || !text.trim()) return;

    // Nếu là lời cảnh báo 5 giây cuối (type === 'warning') mà cô giáo vẫn đang đọc câu hỏi dở thì không ngắt lời câu hỏi!
    if (type === 'warning' && this.isSpeaking && this.currentSpeechType === 'question') {
      console.log('[SoundManager] Giữ nguyên câu hỏi đang đọc, không ngắt lời bởi cảnh báo 5s');
      return;
    }

    this.currentSpeechType = type;

    // Nếu có giọng tiếng Việt native trong hệ điều hành (Edge/Chrome/Cốc Cốc), dùng Web Speech API
    // Nếu trong OBS Browser Source (CEF không có giọng tiếng Việt), tự động chuyển sang Cloud TTS 100% tiếng Việt
    if (this.hasNativeViVoice && ('speechSynthesis' in window)) {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        setTimeout(() => this.executeSpeech(text, speed, pitch, type), 60);
      } else {
        this.executeSpeech(text, speed, pitch, type);
      }
    } else {
      this.playCloudTTS(text, type);
    }
  }

  executeSpeech(text, speed = 1.12, pitch = 1.0, type = 'speech') {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) utterance.voice = this.selectedVoice;
      utterance.lang = 'vi-VN';
      utterance.rate = speed || 1.12;
      utterance.pitch = pitch || 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(true);
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentSpeechType = null;
        if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(false);
      };

      utterance.onerror = (e) => {
        console.warn('[SoundManager] Native TTS lỗi, tự động chuyển Cloud TTS:', e);
        this.isSpeaking = false;
        this.currentSpeechType = null;
        if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(false);
        // Fallback tức thì sang Cloud TTS để không bao giờ bị mất tiếng
        this.playCloudTTS(text, type);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SoundManager] Lỗi phát Native TTS, chuyển Cloud TTS:', err);
      this.playCloudTTS(text, type);
    }
  }

  stopSpeech() {
    this.isSpeaking = false;
    this.currentSpeechType = null;
    if (this.cloudChunkTimer) {
      clearTimeout(this.cloudChunkTimer);
      this.cloudChunkTimer = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch (e) {}
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    if (this.onTeacherSpeakingChange) this.onTeacherSpeakingChange(false);
  }

  // 1. Tiếng chuông trường học báo bắt đầu / kết thúc tiết học (Âm ấm, êm dịu chuẩn TikTok)
  playSchoolBell() {
    if (this.isMuted || !this.audioCtx) return;
    this.ensureContext();

    const now = this.audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // Hợp âm Đô trưởng sáng rõ

    freqs.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.12, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 1.0);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 1.0);
    });
  }

  // 2. Tiếng đồng hồ gõ nhẹ (Âm gõ gỗ êm dịu, không bị chói tai hay báo động báo còi)
  playTick(fast = false) {
    if (this.isMuted || !this.audioCtx) return;
    this.ensureContext();

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fast ? 580 : 440, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 3. Tiếng chúc mừng trả lời đúng (Ngôi sao bay - Dịu nhẹ, không chói tai)
  playCorrectChime() {
    if (this.isMuted || !this.audioCtx) return;
    this.ensureContext();

    const now = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    });
  }

  // 4. Tiếng pháo hoa chiến thắng / TOP 1 (Âm điệu nhẹ nhàng ăn mừng)
  playVictoryFanfare() {
    if (this.isMuted || !this.audioCtx) return;
    this.ensureContext();

    const now = this.audioCtx.currentTime;
    const melody = [
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.15 },
      { f: 659.25, d: 0.35 },
      { f: 783.99, d: 0.5 }
    ];

    let t = now;
    melody.forEach(note => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t);
      osc.stop(t + note.d);
      t += note.d * 0.9;
    });
  }
}

window.soundManager = new SoundManager();
