/**
 * JAVASCRIPT ĐIỀU KHIỂN TRANG QUẢN TRỊ (ADMIN DASHBOARD)
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Elements
  const selSubject = document.getElementById('sel-subject');
  const btnStartSession = document.getElementById('btn-start-session');
  const btnNext = document.getElementById('btn-next');
  const btnPause = document.getElementById('btn-pause');
  const btnSkip = document.getElementById('btn-skip');
  const btnReveal = document.getElementById('btn-reveal');
  const btnVoice = document.getElementById('btn-voice');
  const btnToggleAutopilot = document.getElementById('btn-toggle-autopilot');
  const btnEndPeriod = document.getElementById('btn-end-period');

  // Stat Elements
  const statState = document.getElementById('stat-state');
  const statSubject = document.getElementById('stat-subject');
  const statStudents = document.getElementById('stat-students');
  const statQuestion = document.getElementById('stat-question');
  const statPeriodTimer = document.getElementById('stat-period-timer');

  let currentAutopilot = true;

  // AI Elements
  const btnAiGenerate = document.getElementById('btn-ai-generate');
  const txtAiTopic = document.getElementById('txt-ai-topic');
  const selAiSubject = document.getElementById('sel-ai-subject');
  const selAiDiff = document.getElementById('sel-ai-diff');
  const aiResultsBox = document.getElementById('ai-results-box');

  // Load initial subjects
  loadSubjects();
  loadQuestionTable();

  // Socket state update
  socket.on('game:state', (state) => {
    statState.textContent = state.state;
    statSubject.textContent = state.subject ? `${state.subject.icon} ${state.subject.name}` : 'Chưa chọn';
    const maxCap = state.maxClassCapacity || 30;
    const seated = state.activeDesksCount !== undefined ? state.activeDesksCount : Math.min(state.totalStudents || 0, maxCap);
    const qCount = state.queueCount || 0;
    statStudents.textContent = `${seated}/${maxCap} (Chờ: ${qCount})`;
    
    if (state.periodTimeRemaining !== undefined && statPeriodTimer) {
      const mins = Math.floor(state.periodTimeRemaining / 60);
      const secs = state.periodTimeRemaining % 60;
      statPeriodTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    if (state.autopilot !== undefined && btnToggleAutopilot) {
      currentAutopilot = state.autopilot;
      btnToggleAutopilot.textContent = currentAutopilot ? '🤖 Treo Live Tự Động: BẬT' : '⏸️ Treo Live Tự Động: TẮT';
      btnToggleAutopilot.style.background = currentAutopilot ? '#0ea5e9' : '#64748b';
    }

    if (state.autoKickOnSwipe !== undefined) {
      updateAutoKickUI(state.autoKickOnSwipe, state.maxInactiveQuestions);
    }

    if (state.currentQuestion) {
      statQuestion.textContent = `#${state.questionIndex}: ${state.currentQuestion.content.substring(0, 30)}... (${state.timeRemaining}s)`;
    } else {
      statQuestion.textContent = state.state === 'RECESS' ? `Nghỉ giải lao (${state.recessTimeRemaining}s)` : 'Chưa có câu hỏi';
    }

    if (state.state === 'PAUSED') {
      btnPause.textContent = '▶️ Tiếp tục';
      btnPause.className = 'btn-start';
    } else {
      btnPause.textContent = '⏸️ Tạm dừng';
      btnPause.className = 'btn-pause';
    }
  });

  socket.on('period:timer', (data) => {
    if (statPeriodTimer && data.periodTimeRemaining !== undefined) {
      const mins = Math.floor(data.periodTimeRemaining / 60);
      const secs = data.periodTimeRemaining % 60;
      statPeriodTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  });

  socket.on('recess:timer', (data) => {
    if (statPeriodTimer) {
      statPeriodTimer.textContent = `Nghỉ: ${data.recessTimeRemaining}s`;
    }
  });

  // Action listeners
  btnStartSession.addEventListener('click', async () => {
    const sId = selSubject.value;
    await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: sId })
    });
  });

  btnNext.addEventListener('click', async () => {
    await fetch('/api/game/next', { method: 'POST' });
  });

  btnPause.addEventListener('click', async () => {
    const isPaused = statState.textContent === 'PAUSED';
    await fetch(`/api/game/${isPaused ? 'resume' : 'pause'}`, { method: 'POST' });
  });

  btnSkip.addEventListener('click', async () => {
    await fetch('/api/game/skip', { method: 'POST' });
  });

  btnReveal.addEventListener('click', async () => {
    await fetch('/api/game/reveal', { method: 'POST' });
  });

  btnVoice.addEventListener('click', async () => {
    await fetch('/api/game/repeat-voice', { method: 'POST' });
  });

  if (btnToggleAutopilot) {
    btnToggleAutopilot.addEventListener('click', async () => {
      currentAutopilot = !currentAutopilot;
      await fetch('/api/game/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: currentAutopilot })
      });
      btnToggleAutopilot.textContent = currentAutopilot ? '🤖 Treo Live Tự Động: BẬT' : '⏸️ Treo Live Tự Động: TẮT';
      btnToggleAutopilot.style.background = currentAutopilot ? '#0ea5e9' : '#64748b';
    });
  }

  // Tự động out khi lướt video khác (AFK / Không tương tác)
  let currentAutoKick = true;
  let currentMaxInactive = 1;
  const btnToggleAutoKick = document.getElementById('btn-toggle-autokick');

  function updateAutoKickUI(enabled, count) {
    currentAutoKick = enabled;
    currentMaxInactive = count || 1;
    if (!btnToggleAutoKick) return;
    if (enabled) {
      btnToggleAutoKick.textContent = `📱 Lướt Live Tự Out: ${currentMaxInactive} Câu`;
      btnToggleAutoKick.style.background = '#8b5cf6';
    } else {
      btnToggleAutoKick.textContent = '📱 Lướt Live Tự Out: TẮT';
      btnToggleAutoKick.style.background = '#64748b';
    }
  }

  if (btnToggleAutoKick) {
    btnToggleAutoKick.addEventListener('click', async () => {
      let nextMode = 1;
      let nextEnabled = true;
      if (currentAutoKick && currentMaxInactive === 1) {
        nextMode = 2;
        nextEnabled = true;
      } else if (currentAutoKick && currentMaxInactive === 2) {
        nextMode = 1;
        nextEnabled = false;
      } else {
        nextMode = 1;
        nextEnabled = true;
      }

      try {
        const res = await fetch('/api/game/auto-kick-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoKickOnSwipe: nextEnabled, maxInactiveQuestions: nextMode })
        });
        const data = await res.json();
        updateAutoKickUI(data.autoKickOnSwipe, data.maxInactiveQuestions);
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    });
  }

  if (btnEndPeriod) {
    btnEndPeriod.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn kết thúc tiết học 10 phút ngay bây giờ để vinh danh Top 3 và vào giải lao 20s không?')) {
        await fetch('/api/game/end-period', { method: 'POST' });
      }
    });
  }

  // Quản lý học sinh và hàng chờ từ trang Admin
  const btnAdminFill30 = document.getElementById('btn-admin-fill-30');
  const btnAdminAdd10 = document.getElementById('btn-admin-add-10');
  const btnAdminKick1 = document.getElementById('btn-admin-kick-1');
  const btnAdminClearBots = document.getElementById('btn-admin-clear-bots');
  const btnAdminResetStudents = document.getElementById('btn-admin-reset-students');

  if (btnAdminFill30) {
    btnAdminFill30.addEventListener('click', async () => {
      btnAdminFill30.disabled = true;
      try {
        await fetch('/api/game/spawn-bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 30 })
        });
      } catch (e) {
        alert('Lỗi: ' + e.message);
      } finally {
        btnAdminFill30.disabled = false;
      }
    });
  }

  if (btnAdminAdd10) {
    btnAdminAdd10.addEventListener('click', async () => {
      btnAdminAdd10.disabled = true;
      try {
        await fetch('/api/game/spawn-bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 10 })
        });
      } catch (e) {
        alert('Lỗi: ' + e.message);
      } finally {
        btnAdminAdd10.disabled = false;
      }
    });
  }

  if (btnAdminClearBots) {
    btnAdminClearBots.addEventListener('click', async () => {
      if (confirm('Bạn có chắc muốn xóa TẤT CẢ học sinh ảo?\n(Người xem thật trên TikTok sẽ được giữ nguyên 100%)')) {
        btnAdminClearBots.disabled = true;
        try {
          const res = await fetch('/api/game/clear-bots', { method: 'POST' });
          const data = await res.json();
          alert(`🤖🧹 Đã xóa ${data.removedCount} học sinh ảo.\nHiện còn ${data.activeDesksCount}/30 người xem thật trong lớp.`);
        } catch (e) {
          alert('Lỗi: ' + e.message);
        } finally {
          btnAdminClearBots.disabled = false;
        }
      }
    });
  }

  if (btnAdminKick1) {
    btnAdminKick1.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/game/kick-random', { method: 'POST' });
        const data = await res.json();
        if (!data.kicked) {
          alert('Chưa có học sinh nào ngồi trong lớp!');
        }
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    });
  }

  if (btnAdminResetStudents) {
    btnAdminResetStudents.addEventListener('click', async () => {
      if (confirm('Làm sạch toàn bộ 30 học sinh và hàng chờ?')) {
        await fetch('/api/game/reset-students', { method: 'POST' });
      }
    });
  }

  // Quản lý kết nối TikTok LIVE thực tế
  const txtTikTokUsername = document.getElementById('txt-tiktok-username');
  const btnConnectTikTok = document.getElementById('btn-connect-tiktok');
  const btnDisconnectTikTok = document.getElementById('btn-disconnect-tiktok');
  const tiktokStatusBadge = document.getElementById('tiktok-status-badge');

  async function updateTikTokStatusUI() {
    try {
      const res = await fetch('/api/tiktok/status');
      const data = await res.json();
      if (txtTikTokUsername && data.username && !txtTikTokUsername.value) {
        txtTikTokUsername.value = data.username;
      }
      if (tiktokStatusBadge) {
        if (data.mode === 'live' && data.isConnected) {
          tiktokStatusBadge.innerHTML = `Trạng thái: <span style="color: #2ecc71;">🟢 ĐANG KẾT NỐI LIVE (@${data.username})</span>`;
        } else if (data.mode === 'live' && !data.isConnected) {
          tiktokStatusBadge.innerHTML = `Trạng thái: <span style="color: #ef4444;">🔴 Mất kết nối (@${data.username})</span>`;
        } else {
          tiktokStatusBadge.innerHTML = `Trạng thái: <span style="color: #f59e0b;">🟡 Đang chạy Giả lập (Mock)</span>`;
        }
      }
    } catch (e) {}
  }
  updateTikTokStatusUI();

  if (btnConnectTikTok) {
    btnConnectTikTok.addEventListener('click', async () => {
      const uname = txtTikTokUsername.value.trim();
      if (!uname) {
        alert('Vui lòng nhập Username TikTok của bạn!');
        return;
      }
      btnConnectTikTok.disabled = true;
      btnConnectTikTok.textContent = '⏳ Đang kết nối...';
      try {
        const res = await fetch('/api/tiktok/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: uname, mode: 'live' })
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ Kết nối thành công tới phòng TikTok LIVE của @${data.username}! Game đã sẵn sàng nhận bình luận thực tế.`);
        } else {
          alert(`⚠️ ${data.error || 'Không thể kết nối. Hãy chắc chắn tài khoản đang bật phát trực tiếp (Live) trên TikTok!'}`);
        }
      } catch (e) {
        alert('Lỗi kết nối: ' + e.message);
      } finally {
        btnConnectTikTok.disabled = false;
        btnConnectTikTok.textContent = '🔴 Kết Nối LIVE Trực Tiếp';
        updateTikTokStatusUI();
      }
    });
  }

  if (btnDisconnectTikTok) {
    btnDisconnectTikTok.addEventListener('click', async () => {
      try {
        await fetch('/api/tiktok/disconnect', { method: 'POST' });
        alert('Đã chuyển về chế độ Giả lập (Mock) để thử nghiệm an toàn.');
      } catch (e) {}
      updateTikTokStatusUI();
    });
  }

  // AI Generator
  btnAiGenerate.addEventListener('click', async () => {
    const sName = selAiSubject.value;
    const topic = txtAiTopic.value.trim();
    const diff = selAiDiff.value;

    btnAiGenerate.disabled = true;
    btnAiGenerate.textContent = '⏳ Đang tạo bằng AI...';
    aiResultsBox.innerHTML = '<div style="color: #94a3b8; padding: 12px;">Đang suy nghĩ và biên soạn câu hỏi...</div>';

    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName: sName, topic, difficulty: diff, count: 3 })
      });
      const data = await res.json();
      if (data.success && data.data) {
        renderAiResults(data.data);
      }
    } catch (e) {
      alert('Lỗi tạo câu hỏi: ' + e.message);
    } finally {
      btnAiGenerate.disabled = false;
      btnAiGenerate.textContent = '✨ Tạo Câu Hỏi Bằng AI';
    }
  });

  function renderAiResults(questions) {
    aiResultsBox.innerHTML = '';
    questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #334155;';
      
      const optHtml = (q.options || []).map(o => `<b>${o.key}:</b> ${o.text} ${o.isCorrect ? '✅' : ''}`).join(' | ');

      card.innerHTML = `
        <div style="font-weight: bold; color: #38bdf8; margin-bottom: 6px;">Câu ${idx + 1}: ${q.content}</div>
        <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">${optHtml}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;"><i>💡 ${q.explanation || ''}</i></div>
        <button class="btn-start" style="padding: 6px 14px; font-size: 12px;" onclick="saveAiQuestion(${JSON.stringify(q).replace(/"/g, '&quot;')})">➕ Thêm Vào Ngân Hàng</button>
      `;
      aiResultsBox.appendChild(card);
    });
  }

  window.saveAiQuestion = async (qData) => {
    const sId = selSubject.value || 1;
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: sId,
          content: qData.content,
          correctAnswer: qData.correctAnswer,
          options: qData.options,
          questionType: qData.questionType,
          difficulty: qData.difficulty,
          explanation: qData.explanation,
          timeLimit: qData.timeLimit || 20
        })
      });
      const ret = await res.json();
      if (ret.success) {
        alert('Đã thêm câu hỏi vào ngân hàng thành công!');
        loadQuestionTable();
      }
    } catch (e) {
      alert('Lỗi lưu câu hỏi: ' + e.message);
    }
  };

  let allLoadedQuestions = [];
  const selFilterSubject = document.getElementById('sel-filter-subject');

  async function loadSubjects() {
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      if (data.success) {
        selSubject.innerHTML = '';
        selAiSubject.innerHTML = '';
        if (selFilterSubject) {
          selFilterSubject.innerHTML = '<option value="ALL">Tất cả môn học (1,500 câu)</option>';
        }
        data.data.forEach(s => {
          const sId = s.id || s.Id;
          const sName = `${s.icon || s.Icon} ${s.name || s.Name}`;

          const opt = document.createElement('option');
          opt.value = sId;
          opt.textContent = sName;
          selSubject.appendChild(opt);

          const optAi = document.createElement('option');
          optAi.value = s.name || s.Name;
          optAi.textContent = sName;
          selAiSubject.appendChild(optAi);

          if (selFilterSubject) {
            const optF = document.createElement('option');
            optF.value = sId;
            optF.textContent = `${sName} (100 câu)`;
            selFilterSubject.appendChild(optF);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderFilteredQuestions() {
    const tbody = document.getElementById('questions-tbody');
    const titleEl = document.querySelector('#tab-questions h2');
    if (!tbody) return;

    const filterVal = selFilterSubject ? selFilterSubject.value : 'ALL';
    const filtered = filterVal === 'ALL'
      ? allLoadedQuestions
      : allLoadedQuestions.filter(q => String(q.subjectId || q.SubjectId) === String(filterVal));

    if (titleEl) {
      titleEl.textContent = `📚 Danh Sách Câu Hỏi Trong Hệ Thống (${filtered.length} câu)`;
    }

    tbody.innerHTML = '';
    // Hiển thị tối đa 200 câu một lúc để giao diện duyệt cực mượt mà
    const displayList = filtered.slice(0, 200);
    displayList.forEach(q => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${q.id}</td>
        <td><b>${q.subjectName || 'Toán học'}</b></td>
        <td>${q.content}</td>
        <td><span class="tag-badge" style="background: #0284c7; color: #fff;">${q.correctAnswer}</span></td>
        <td>${q.difficulty}</td>
        <td>${q.timeLimit}s</td>
      `;
      tbody.appendChild(tr);
    });

    if (filtered.length > 200) {
      const trMore = document.createElement('tr');
      trMore.innerHTML = `
        <td colspan="6" style="text-align: center; color: #94a3b8; font-style: italic; padding: 12px;">
          ... Và còn ${filtered.length - 200} câu hỏi khác (Hãy lọc theo môn để xem chi tiết từng bộ 100 câu) ...
        </td>
      `;
      tbody.appendChild(trMore);
    }
  }

  if (selFilterSubject) {
    selFilterSubject.addEventListener('change', renderFilteredQuestions);
  }

  async function loadQuestionTable() {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        allLoadedQuestions = data.data;
        renderFilteredQuestions();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Chuyển Tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      document.getElementById(target).style.display = 'block';
    });
  });
});
