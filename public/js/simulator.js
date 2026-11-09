/**
 * BỘ ĐIỀU KHIỂN GIẢ LẬP SỰ KIỆN TIKTOK LIVE (40 HỌC SINH + ẢNH ĐẠI DIỆN)
 */

const sampleNames = [
  'nguyen_van_an', 'mai_anh_cute', 'minh_khoi_pro', 'hoang_long_99',
  'thu_thao_hn', 'quang_huy_top1', 'lan_huong_2k', 'duc_thang_vip',
  'bao_chau_dn', 'tuan_kiet_sg', 'phuong_thao_hp', 'hai_dang_vn',
  'thanh_hang_vt', 'viet_anh_nb', 'thuy_tien_ct', 'xuan_bac_hn',
  'diep_anh_sg', 'hong_phuc_hue', 'gia_huy_dalat', 'cam_tu_qn',
  'khanh_linh_nt', 'bao_nam_bd', 'thanh_truc_ag', 'quoc_bao_la',
  'ngoc_huyen_hd', 'tien_dung_tb', 'kim_ngan_qn', 'huu_thang_na',
  'my_duyen_bt', 'trong_nghia_ld', 'anh_thu_cm', 'hoang_nam_pt',
  'tra_my_gl', 'duc_anh_qb', 'yen_nhi_qt', 'phuc_thinh_py',
  'quynh_chi_tn', 'tuan_anh_vp', 'minh_thu_bn', 'huy_hoang_bg',
  'nhat_minh_ls', 'thanh_huong_cb', 'quang_minh_bk', 'van_hau_hg'
];

let activeBotStudents = [];

document.addEventListener('DOMContentLoaded', () => {
  const logBox = document.getElementById('log-box');
  const txtUsername = document.getElementById('txt-username');
  const txtComment = document.getElementById('txt-comment');
  const txtAvatar = document.getElementById('txt-avatar');
  const btnSend = document.getElementById('btn-send');

  // Khởi tạo tên ngẫu nhiên
  txtUsername.value = sampleNames[Math.floor(Math.random() * sampleNames.length)];

  // Gửi bình luận thủ công
  btnSend.addEventListener('click', () => {
    sendComment(txtUsername.value.trim(), txtComment.value.trim(), txtUsername.value.trim(), txtAvatar ? txtAvatar.value.trim() : null);
    txtComment.value = '';
  });

  // Xử lý các nút bấm nhanh
  document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-cmd');
      txtComment.value = text;
      sendComment(txtUsername.value.trim(), text, txtUsername.value.trim(), txtAvatar ? txtAvatar.value.trim() : null);
    });
  });

  let fallbackBotId = 1;
  async function fallbackSpawnStudents(count) {
    appendLog('Hệ thống', `🔄 Đang tự động đưa ${count} học sinh ảo vào lớp học...`);
    for (let i = 0; i < count; i++) {
      let uname;
      for (const name of sampleNames) {
        if (!activeBotStudents.includes(name)) {
          uname = name;
          break;
        }
      }
      if (!uname) {
        uname = `hoc_sinh_${fallbackBotId++}`;
      }
      activeBotStudents.push(uname);
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=random&color=fff&size=128&bold=true`;
      await sendComment(uname, 'VÀO LỚP', uname, avatarUrl);
      await sleep(150);
    }
  }

  // Nút sinh 10 học sinh ảo
  document.getElementById('btn-batch-join').addEventListener('click', async () => {
    appendLog('Hệ thống', 'Đang đưa 10 học sinh ảo vào lớp học (hoặc hàng chờ nếu đã đủ 30)...');
    try {
      const res = await fetch('/api/game/spawn-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      });
      if (!res.ok) {
        await fallbackSpawnStudents(10);
        return;
      }
      const data = await res.json();
      appendLog('Hệ thống', `✅ Đã thêm 10 bạn. Hiện có ${data.activeDesksCount}/30 bàn ngồi và ${data.queueCount} bạn trong hàng chờ.`);
    } catch (e) {
      await fallbackSpawnStudents(10);
    }
  });

  // Nút sinh 30 học sinh lấp đầy cả lớp kèm ảnh đại diện
  const btnBatch30 = document.getElementById('btn-batch-join-30') || document.getElementById('btn-batch-join-40');
  if (btnBatch30) {
    btnBatch30.addEventListener('click', async () => {
      appendLog('Hệ thống', '🚀 Bắt đầu đưa 30 học sinh kèm Avatar vào kín 30 bàn học...');
      try {
        const res = await fetch('/api/game/spawn-bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 30 })
        });
        if (!res.ok) {
          await fallbackSpawnStudents(30);
          return;
        }
        const data = await res.json();
        appendLog('Hệ thống', `✅ Đã xử lý đưa học sinh vào. Hiện có ${data.activeDesksCount}/30 bàn ngồi.`);
      } catch (e) {
        await fallbackSpawnStudents(30);
      }
    });
  }

  // Nút 1 học sinh rời lớp (để kiểm tra hoạt ảnh rời lớp & học sinh hàng chờ vào thế chỗ)
  const btnLeave = document.getElementById('btn-batch-leave');
  if (btnLeave) {
    btnLeave.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/game/kick-random', { method: 'POST' });
        if (!res.ok) {
          if (activeBotStudents.length > 0) {
            const u = activeBotStudents.shift();
            await sendComment(u, 'OUT');
          }
          return;
        }
        const data = await res.json();
        if (data.kicked) {
          appendLog('Hệ thống', `🚪 Phát hiện @${data.kicked} lướt xem live khác -> Tự động cho rời lớp & xóa khỏi BXH! (Hàng chờ còn: ${data.queueCount})`);
        } else {
          alert('Chưa có học sinh nào ngồi trong lớp!');
        }
      } catch (e) {
        if (activeBotStudents.length > 0) {
          const u = activeBotStudents.shift();
          await sendComment(u, 'OUT');
        }
      }
    });
  }

  // Nút làm sạch toàn bộ học sinh để kiểm thử lại từ đầu
  const btnReset = document.getElementById('btn-batch-reset');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (confirm('Bạn có chắc muốn làm sạch toàn bộ học sinh trong phòng học để test lại từ đầu không?')) {
        activeBotStudents = [];
        try {
          await fetch('/api/game/reset-students', { method: 'POST' });
          appendLog('Hệ thống', '🧹 Đã làm sạch toàn bộ học sinh trong phòng học!');
        } catch (e) {
          appendLog('Lỗi', 'Không thể đặt lại học sinh: ' + e.message);
        }
      }
    });
  }

  // Nút xóa toàn bộ học sinh ảo (giữ nguyên người xem thật trên TikTok)
  const btnClearBots = document.getElementById('btn-batch-clear-bots');
  if (btnClearBots) {
    btnClearBots.addEventListener('click', async () => {
      if (confirm('Bạn có chắc muốn xóa tất cả học sinh ảo không?\n(Toàn bộ người xem thật trên TikTok sẽ được giữ nguyên 100%)')) {
        try {
          const res = await fetch('/api/game/clear-bots', { method: 'POST' });
          const data = await res.json();
          activeBotStudents = [];
          appendLog('Hệ thống', `🤖🧹 Đã xóa ${data.removedCount} học sinh ảo. Hiện còn ${data.activeDesksCount}/30 người xem thật trong lớp.`);
        } catch (e) {
          appendLog('Lỗi', 'Không thể xóa học sinh ảo: ' + e.message);
        }
      }
    });
  }

  // Kết nối socket.io để lắng nghe nhật ký lớp học
  const socket = io();
  socket.on('classroom:student_joined', (data) => {
    appendLog('Lớp học', `🎉 ${data.message} (Bàn #${data.student.deskIndex + 1})`);
  });

  socket.on('classroom:student_queued', (data) => {
    appendLog('Hàng chờ', `⏳ Lớp đã đầy 30 bạn. @${data.student.username} xếp hàng chờ vị trí #${data.queuePosition}`);
  });

  socket.on('classroom:student_kicked', (data) => {
    appendLog('Rời lớp', `👋 @${data.username} đã rời khỏi bàn #${data.deskIndex + 1}`);
  });

  socket.on('classroom:student_answered', (data) => {
    appendLog('Học sinh', `✋ @${data.username} đã chọn đáp án: [${data.answer}]`);
  });

  socket.on('question:revealed', (data) => {
    appendLog('Đáp án', `🔔 Công bố: Đáp án đúng là [${data.correctAnswer}]. Có ${data.correctStudents.length} bạn đúng!`);
  });

  async function sendComment(username, comment, displayName, avatarUrl) {
    if (!username || !comment) return;
    const safeAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username)}&background=random&color=fff&size=128&bold=true`;
    try {
      const res = await fetch('/api/simulator/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          comment,
          displayName: displayName || username,
          avatarUrl: safeAvatar
        })
      });
      const data = await res.json();
      if (data.success) {
        appendLog(username, comment);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function appendLog(user, text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timeStr = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-user">@${user}:</span> <span class="log-text">${text}</span>`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
