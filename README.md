# GAME 2D LỚP HỌC TƯƠNG TÁC TIKTOK LIVE 🎓✨

Dự án trò chơi 2D mô phỏng lớp học hoạt hình trực tiếp trên TikTok LIVE, cho phép hàng trăm người xem livestream có thể tham gia vào lớp, xuất hiện tại bàn học, nhận câu hỏi từ giáo viên AI, bình luận đáp án để ghi điểm và tranh vị trí TOP 1 trên bảng xếp hạng thời gian thực.

---

## I. TỔNG QUAN HỆ THỐNG VÀ KIẾN TRÚC

```
                    ┌──────────────────────────────────────────────┐
                    │     TIKTOK LIVE STREAM / SIMULATOR CHAT      │
                    └──────────────────────┬───────────────────────┘
                                           │
                                    (Bình luận Chat)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │        TikTok LIVE Connector Adapter         │
                    │   - Nhận diện: JOIN, VÀO LỚP, A, B, C, D...  │
                    │   - Lọc spam (Debounce 800ms)                │
                    └──────────────────────┬───────────────────────┘
                                           │
                                  (Sự kiện thời gian thực)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND ENGINE (Node.js)                             │
│                                                                                  │
│  ┌───────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐  │
│  │      GameEngine       │ │      ScoreService       │ │      TTSService      │  │
│  │  - Quản lý tiết học   │ │  - Điểm base (+10đ)     │ │  - Giọng AI tiếng    │  │
│  │  - Xếp 40 bàn học sinh│ │  - Thưởng tốc độ (1-5đ) │ │    Việt tự nhiên     │  │
│  │  - Đếm ngược thời gian│ │  - Thưởng chuỗi thắng   │ │  - Đồng bộ hoạt ảnh  │  │
│  └───────────┬───────────┘ └────────────┬────────────┘ └──────────┬───────────┘  │
└──────────────┼──────────────────────────┼─────────────────────────┼──────────────┘
               │                          │                         │
               ▼                          ▼                         ▼
┌──────────────────────────────┐ ┌──────────────────────┐ ┌────────────────────────┐
│      SOCKET.IO SERVER        │ │ CƠ SỞ DỮ LIỆU SQL    │ │   GOOGLE GEMINI AI     │
│  - Phát sóng Socket thời     │ │ - Microsoft SQL      │ │ - Sinh câu hỏi tự    │
│    gian thực đến OBS/Phaser  │ │   Server (T-SQL)     │ │   động theo môn học  │
│  - Đồng bộ điểm, bảng xếp    │ │ - Resilient Storage  │ │ - 4 phương án kèm    │
│    hạng, hoạt ảnh nhân vật   │ │   khởi tạo tức thì   │ │   lời giải chi tiết  │
└──────────────┬───────────────┘ └──────────────────────┘ └────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND & OBS BROWSER SOURCE                            │
│                                                                                  │
│   🎮 Game View (/game)          ⚙️ Admin Panel (/admin)   🧪 Simulator (/simulator)
│   - Engine Phaser 3 2D         - Chọn môn học            - Giả lập bình luận     │
│   - Bảng đen trung tâm         - Bắt đầu, tạm dừng       - Tạo 10 học sinh ảo    │
│   - Cô giáo AI hoạt họa        - Công bố đáp án sớm      - Trả lời ngẫu nhiên    │
│   - 40 học sinh giơ tay & avatar - Sinh câu hỏi bằng AI    - Thử nghiệm không cần  │
│   - Tối ưu OBS 9:16 & 16:9     - Xem bảng xếp hạng         kết nối TikTok thật   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## II. CẤU TRÚC THƯ MỤC DỰ ÁN

```
d:\lophoc\
├── package.json                   # Danh mục phụ thuộc và lệnh chạy
├── .env.example                   # Mẫu cấu hình môi trường
├── .env                           # Tệp biến môi trường chính thức
├── server.js                      # Máy chủ chính Express.js + Socket.IO
├── test/
│   └── systemTest.js              # Kịch bản kiểm thử toàn bộ hệ thống
├── src/
│   ├── config/
│   │   └── config.js              # Nạp và chuẩn hóa cấu hình
│   ├── database/
│   │   ├── schema.sql             # Kịch bản T-SQL Microsoft SQL Server đầy đủ
│   │   ├── seedData.js            # Dữ liệu khởi tạo chuẩn 15 môn học & câu hỏi
│   │   └── db.js                  # Lớp kết nối SQL Server & Local Resilient Storage
│   ├── services/
│   │   ├── gameEngine.js          # Quản lý lớp học, 40 bàn, đếm ngược, chuyển tiết
│   │   ├── scoreService.js        # Tính điểm đúng, thưởng tốc độ, chuỗi thắng
│   │   ├── ttsService.js          # Soạn kịch bản giọng nói AI giáo viên tiếng Việt
│   │   ├── aiQuestionService.js   # Tích hợp Gemini / AI sinh câu hỏi thông minh
│   │   └── tiktokConnector.js     # Module kết nối và phân loại sự kiện TikTok LIVE
│   └── routes/
│       └── apiRoutes.js           # REST API quản trị, câu hỏi, phiên học
└── public/
    ├── index.html                 # Cổng điều hướng tập trung (Central Hub)
    ├── game.html                  # Giao diện game Phaser 3 2D cho OBS Livestream
    ├── admin.html                 # Bảng điều khiển quản trị viên
    ├── simulator.html             # Giao diện giả lập sự kiện bình luận TikTok
    ├── css/
    │   ├── game.css               # Phong cách giao diện HUD và bảng xếp hạng
    │   ├── admin.css              # Giao diện quản trị hiện đại
    │   └── simulator.css          # Giao diện thử nghiệm chat
    ├── js/
    │   ├── game/
    │   │   ├── main.js            # Khởi tạo Phaser 3, xử lý âm thanh & tỷ lệ khung
    │   │   ├── ClassroomScene.js  # Không gian lớp học 2D, bảng đen, bàn học sinh
    │   │   ├── TeacherSprite.js   # Nhân vật cô giáo 2D, cử động môi, chỉ bảng
    │   │   ├── StudentSprite.js   # Nhân vật học sinh tự sinh, giơ tay, nhảy ăn mừng
    │   │   ├── BoardDisplay.js    # Bảng đen viết phấn, 4 đáp án A/B/C/D, đồng hồ
    │   │   └── SoundManager.js    # Bộ tổng hợp âm chuông, tích tắc, pháo hoa, TTS
    │   ├── admin.js               # Điều khiển trạng thái tiết học từ xa
    │   └── simulator.js           # Gửi bình luận và tạo bot thử nghiệm
    └── vendor/
        └── phaser.min.js          # Phaser 3 Game Engine cục bộ (hoạt động offline)
```

---

## III. HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 18 trở lên (đã kiểm tra tương thích trên Node v24).
- **Microsoft SQL Server** (Tùy chọn): Phiên bản 2016, 2019, 2022 hoặc Azure SQL. *Lưu ý: Nếu chưa cài SQL Server, hệ thống sẽ tự động kích hoạt bộ lưu trữ Resilient Storage để bạn có thể trải nghiệm ngay mà không cần cấu hình phức tạp!*

### 2. Cài đặt các gói phụ thuộc
Mở PowerShell tại thư mục `d:\lophoc` và chạy:
```powershell
npm install
```

### 3. Cấu hình biến môi trường (`.env`)
Tệp `.env` đã được thiết lập sẵn các giá trị mặc định:
```ini
PORT=3000
NODE_ENV=development

# Cấu hình Cơ sở dữ liệu Microsoft SQL Server
DB_TYPE=mssql
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourStrongPassword123
DB_NAME=ClassroomLiveDB
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Chế độ kết nối TikTok: 'mock' (thử nghiệm) hoặc 'live' (kết nối trực tiếp phòng LIVE)
TIKTOK_CONNECT_MODE=mock
TIKTOK_USERNAME=demo_teacher

# AI Giọng đọc tiếng Việt (Web Speech API)
TTS_PROVIDER=web
TTS_SPEED=1.0
TTS_DEFAULT_VOICE=female

# Google Gemini API (Tùy chọn để AI tạo câu hỏi mới trong Admin)
GEMINI_API_KEY=
```

### 4. Khởi chạy máy chủ
```powershell
npm start
```

Sau khi chạy lệnh, máy chủ sẽ xuất hiện thông báo:
```
🚀 CLASSROOM 2D TIKTOK LIVE SERVER SẴN SÀNG TẠI PORT: 3000
🎮 Game View (OBS Source):    http://localhost:3000/game
⚙️  Admin Dashboard:           http://localhost:3000/admin
🧪 TikTok Event Simulator:     http://localhost:3000/simulator
🏠 Central Hub:                http://localhost:3000/
```

---

## IV. HƯỚNG DẪN CẤU HÌNH MICROSOFT SQL SERVER

Nếu bạn muốn lưu trữ dữ liệu vĩnh viễn trên SQL Server cục bộ hoặc VPS:

1. Mở **SQL Server Management Studio (SSMS)** hoặc **Azure Data Studio**.
2. Kết nối đến máy chủ SQL Server của bạn.
3. Mở tệp `src/database/schema.sql` và nhấn **Execute (F5)**.
4. Kịch bản sẽ tự động:
   - Tạo cơ sở dữ liệu `ClassroomLiveDB`.
   - Tạo 12 bảng chuẩn hóa: `Subjects`, `Grades`, `QuestionPacks`, `Questions`, `QuestionOptions`, `LiveSessions`, `Players`, `PlayerAnswers`, `ScoreEvents`, `Leaderboards`, `GameSettings`, `AdminUsers`.
   - Tạo ràng buộc duy nhất `UQ_Session_Question_Player` để **chống cộng trùng điểm khi người xem bình luận nhiều lần**.
5. Cập nhật thông tin đăng nhập trong tệp `.env` (`DB_USER`, `DB_PASSWORD`).
6. Khởi động lại máy chủ `npm start`, hệ thống sẽ thông báo:
   `[DB] ĐÃ KẾT NỐI THÀNH CÔNG Microsoft SQL Server`.

---

## V. CÁCH SỬ DỤNG TRÊN OBS STUDIO ĐỂ PHÁT TIKTOK LIVE

### 1. Thiết lập Canvas dọc (9:16) tối ưu cho TikTok LIVE
1. Trong OBS Studio, vào **Settings (Cài đặt)** > **Video**.
2. Đặt **Base (Canvas) Resolution**: `1080x1920` (hoặc `720x1280`).
3. Đặt **Output (Scaled) Resolution**: `1080x1920` (hoặc `720x1280`).
4. Đặt **Common FPS Values**: `60`.

### 2. Thêm Nguồn Trình Duyệt (Browser Source)
1. Trong bảng điều khiển **Sources (Nguồn)**, nhấp vào dấu **[+]** > Chọn **Browser**.
2. Đặt tên nguồn: `Lop_Hoc_2D`.
3. Điền các tham số:
   - **URL**: `http://localhost:3000/game?layout=9:16`
     *(Hoặc `http://localhost:3000/game?layout=9:16&overlay=true` nếu muốn nền trong suốt để ghép vào webcam/background riêng)*.
   - **Width (Chiều rộng)**: `1080` (hoặc `720`).
   - **Height (Chiều cao)**: `1920` (hoặc `1280`).
   - Tích chọn: **"Control audio via OBS" (Điều khiển âm thanh qua OBS)**.
4. Nhấp chuột phải vào nguồn `Lop_Hoc_2D` vừa tạo > chọn **Interact (Tương tác)** > nhấp vào nút **"BẬT NGAY"** một lần duy nhất để kích hoạt Web Audio API và giọng đọc AI của trình duyệt.

---

## VI. QUY TRÌNH TIẾT HỌC TỰ ĐỘNG & TREO LIVE (AUTOPILOT)

Hệ thống được thiết kế **hoàn toàn tự động** để streamer có thể **treo livestream 24/7** mà không cần thao tác bấm chuyển câu thủ công:

1. **Chu kỳ Tiết học 10 phút & Giải lao 20 giây**:
   - Mỗi tiết học diễn ra trong **10 phút (600 giây)**.
   - Đồng hồ trên HUD hiển thị đếm ngược thời gian của tiết học (`⏱️ Tiết: 09:45`).
   - Tự động nạp và chuyển tiếp các câu hỏi liên tục. Nếu hết câu hỏi, hệ thống tự động xáo trộn và nạp bổ sung nên livestream không bao giờ bị đứng.
2. **Quy trình câu hỏi hoàn toàn tự động**:
   - Cô giáo AI đọc câu hỏi và các phương án.
   - Đồng hồ đếm ngược 20 giây bắt đầu.
   - Học sinh bình luận và giơ tay trong lớp.
   - Hết giờ: Công bố đáp án, giải thích chi tiết, học sinh đúng nhảy ăn mừng.
   - Sau **6 giây** công bố kết quả, hệ thống **tự động chuyển ngay sang câu hỏi tiếp theo**!
3. **Tích lũy cộng dồn điểm số**:
   - Điểm số của từng học sinh được **cộng dồn liên tục qua từng câu hỏi** trong suốt 10 phút của môn học.
   - Bảng xếp hạng và điểm số trên bàn học hiển thị tổng điểm tích lũy thực tế, không bị reset sau mỗi câu.
4. **Bế mạc tiết học & Tuyên dương Top 3**:
   - Khi hết 10 phút tiết học, tiếng chuông vang lên và xuất hiện **Bục vinh danh 3 bạn điểm cao nhất môn**:
     * 👑 **Quán quân (Top 1)**
     * 🥈 **Á quân (Top 2)**
     * 🥉 **Quý quân (Top 3)**
   - Cô giáo AI xướng tên chúc mừng và thông báo **20 giây giải lao**.
5. **Chuyển tiết học mới & Reset điểm số công bằng**:
   - Sau 20 giây giải lao thư giãn, lớp học tự động chuyển sang **môn học tiếp theo** trong danh sách 15 môn.
   - Tất cả 40 học sinh **vẫn giữ nguyên chỗ ngồi** (không cần bình luận `JOIN` lại).
   - Điểm số của tất cả người chơi được **reset về 0** để bắt đầu một vòng đua mới công bằng và kịch tính!

---

## VII. HỆ THỐNG TÍNH ĐIỂM CHI TIẾT

| Hành động | Điểm thưởng | Ghi chú |
| :--- | :--- | :--- |
| **Trả lời đúng** | **+10 điểm** | Điểm cơ sở cho mỗi câu trả lời chính xác |
| **Thưởng tốc độ** | **+1 đến +5 điểm** | Tính theo tỷ lệ thời gian còn lại khi trả lời |
| **Chuỗi đúng 3 câu (Streak 3)** | **+3 điểm** | Thưởng duy trì phong độ |
| **Chuỗi đúng 5 câu (Streak 5+)** | **+5 điểm** | Thưởng học sinh xuất sắc |
| **Trả lời sai** | **0 điểm** | Reset chuỗi đúng về 0 |

---

## VIII. KIỂM THỬ TOÀN BỘ HỆ THỐNG

Dự án tích hợp bộ kiểm thử tự động toàn diện kiểm tra 8 hạng mục quan trọng:
```powershell
npm test
```

Kết quả kiểm thử:
- ✅ **Cơ sở dữ liệu**: Khởi tạo và nạp đủ 15 danh mục môn học.
- ✅ **Ngân hàng câu hỏi**: Đầy đủ 4 dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Điền từ, Quiz nhanh).
- ✅ **Tính điểm & Chuỗi**: Công thức cộng điểm cơ sở, thưởng tốc độ, streak bonus.
- ✅ **AI Text-To-Speech**: Sinh kịch bản đọc tiếng Việt tự nhiên cho cô giáo.
- ✅ **AI Soạn câu hỏi**: Trợ lý thông minh sinh đề kèm 4 đáp án và lời giải.
- ✅ **TikTok Connector**: Chuẩn hóa bình luận `JOIN`, `ABCD`, `ĐÚNG/SAI`, chống spam.
- ✅ **Game Engine & 40 Bàn học**: Xếp chỗ 40 học sinh, xử lý avatar, chống trùng điểm, bảng xếp hạng.
- ✅ **Autopilot & Tiết học 10 phút**: Tự động chuyển câu, cộng dồn điểm, vinh danh Top 3 và giải lao 20s.

Chúc bạn có những buổi phát TikTok LIVE tương tác lớp học bùng nổ người xem và triệu lượt bình luận! 🎓🚀
