-- ==============================================================================
-- DATABASE SCHEMA: CLASSROOM 2D TIKTOK LIVE INTERACTIVE
-- HỆ THỐNG CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER
-- ==============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ClassroomLiveDB')
BEGIN
    CREATE DATABASE ClassroomLiveDB;
    PRINT N'Created database ClassroomLiveDB successfully.';
END
GO

USE ClassroomLiveDB;
GO

-- 1. BẢNG MÔN HỌC (Subjects)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Subjects')
BEGIN
    CREATE TABLE Subjects (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Code NVARCHAR(50) NOT NULL UNIQUE,
        Name NVARCHAR(100) NOT NULL,
        Icon NVARCHAR(50) NOT NULL,
        Color NVARCHAR(20) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_Subjects_IsActive ON Subjects(IsActive);
    PRINT N'Created table Subjects.';
END
GO

-- 2. BẢNG CẤP ĐỘ / KHỐI LỚP (Grades)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Grades')
BEGIN
    CREATE TABLE Grades (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Code NVARCHAR(50) NOT NULL UNIQUE,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(255) NULL,
        OrderIndex INT NOT NULL DEFAULT 0
    );
    PRINT N'Created table Grades.';
END
GO

-- 3. BẢNG BỘ CÂU HỎI (QuestionPacks)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'QuestionPacks')
BEGIN
    CREATE TABLE QuestionPacks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubjectId INT NOT NULL,
        GradeId INT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        TotalQuestions INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_QuestionPacks_Subject FOREIGN KEY (SubjectId) REFERENCES Subjects(Id) ON DELETE CASCADE,
        CONSTRAINT FK_QuestionPacks_Grade FOREIGN KEY (GradeId) REFERENCES Grades(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_QuestionPacks_SubjectId ON QuestionPacks(SubjectId);
    PRINT N'Created table QuestionPacks.';
END
GO

-- 4. BẢNG CÂU HỎI (Questions)
-- QuestionType: 'MULTIPLE_CHOICE' (A,B,C,D), 'TRUE_FALSE' (ĐÚNG/SAI), 'FILL_IN', 'RAPID'
-- Difficulty: 'EASY', 'MEDIUM', 'HARD'
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Questions')
BEGIN
    CREATE TABLE Questions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PackId INT NOT NULL,
        SubjectId INT NOT NULL,
        QuestionType NVARCHAR(30) NOT NULL DEFAULT 'MULTIPLE_CHOICE',
        Difficulty NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        Content NVARCHAR(MAX) NOT NULL,
        CorrectAnswer NVARCHAR(100) NOT NULL,
        Explanation NVARCHAR(MAX) NULL,
        TimeLimit INT NOT NULL DEFAULT 20,
        PointsBase INT NOT NULL DEFAULT 10,
        ImageUrl NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Questions_Pack FOREIGN KEY (PackId) REFERENCES QuestionPacks(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Questions_Subject FOREIGN KEY (SubjectId) REFERENCES Subjects(Id)
    );
    CREATE INDEX IX_Questions_PackId ON Questions(PackId);
    CREATE INDEX IX_Questions_SubjectId ON Questions(SubjectId);
    PRINT N'Created table Questions.';
END
GO

-- 5. BẢNG CÁC PHƯƠNG ÁN LỰA CHỌN (QuestionOptions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'QuestionOptions')
BEGIN
    CREATE TABLE QuestionOptions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        QuestionId INT NOT NULL,
        OptionKey NVARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
        OptionText NVARCHAR(500) NOT NULL,
        IsCorrect BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_QuestionOptions_Question FOREIGN KEY (QuestionId) REFERENCES Questions(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_QuestionOptions_QuestionId ON QuestionOptions(QuestionId);
    PRINT N'Created table QuestionOptions.';
END
GO

-- 6. BẢNG PHIÊN LIVESTREAM (LiveSessions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LiveSessions')
BEGIN
    CREATE TABLE LiveSessions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SessionCode NVARCHAR(100) NOT NULL UNIQUE,
        Title NVARCHAR(200) NOT NULL,
        SubjectId INT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'ENDED'
        StartedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        EndedAt DATETIME2 NULL,
        TotalParticipants INT NOT NULL DEFAULT 0,
        TotalQuestionsAsked INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_LiveSessions_Subject FOREIGN KEY (SubjectId) REFERENCES Subjects(Id) ON DELETE SET NULL
    );
    PRINT N'Created table LiveSessions.';
END
GO

-- 7. BẢNG NGƯỜI CHƠI (Players)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Players')
BEGIN
    CREATE TABLE Players (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TikTokUserId NVARCHAR(100) NOT NULL UNIQUE,
        TikTokUsername NVARCHAR(100) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        AvatarStyleJson NVARCHAR(MAX) NULL, -- Lưu cấu hình màu tóc, áo, phụ kiện
        TotalScoreAllTime INT NOT NULL DEFAULT 0,
        TotalCorrectAllTime INT NOT NULL DEFAULT 0,
        FirstJoinedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        LastActiveAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_Players_TikTokUserId ON Players(TikTokUserId);
    CREATE INDEX IX_Players_TikTokUsername ON Players(TikTokUsername);
    PRINT N'Created table Players.';
END
GO

-- 8. BẢNG LỊCH SỬ TRẢ LỜI CÂU HỎI (PlayerAnswers)
-- Ràng buộc UNIQUE chống trùng lặp điểm khi nhận lại cùng một bình luận
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlayerAnswers')
BEGIN
    CREATE TABLE PlayerAnswers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SessionId INT NOT NULL,
        QuestionId INT NOT NULL,
        PlayerId INT NOT NULL,
        AnswerGiven NVARCHAR(200) NOT NULL,
        IsCorrect BIT NOT NULL DEFAULT 0,
        ResponseTimeSeconds FLOAT NOT NULL DEFAULT 0,
        PointsAwarded INT NOT NULL DEFAULT 0,
        AnsweredAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_PlayerAnswers_Session FOREIGN KEY (SessionId) REFERENCES LiveSessions(Id),
        CONSTRAINT FK_PlayerAnswers_Question FOREIGN KEY (QuestionId) REFERENCES Questions(Id),
        CONSTRAINT FK_PlayerAnswers_Player FOREIGN KEY (PlayerId) REFERENCES Players(Id),
        CONSTRAINT UQ_Session_Question_Player UNIQUE (SessionId, QuestionId, PlayerId)
    );
    CREATE INDEX IX_PlayerAnswers_Session_Question ON PlayerAnswers(SessionId, QuestionId);
    CREATE INDEX IX_PlayerAnswers_Player ON PlayerAnswers(PlayerId);
    PRINT N'Created table PlayerAnswers with UNIQUE anti-duplication constraint.';
END
GO

-- 9. BẢNG SỰ KIỆN CỘNG ĐIỂM (ScoreEvents - Audit Log)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScoreEvents')
BEGIN
    CREATE TABLE ScoreEvents (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SessionId INT NOT NULL,
        QuestionId INT NULL,
        PlayerId INT NOT NULL,
        EventType NVARCHAR(50) NOT NULL, -- 'BASE_CORRECT', 'SPEED_BONUS', 'STREAK_BONUS', 'ADMIN_ADJUST'
        Points INT NOT NULL,
        Reason NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_ScoreEvents_Session FOREIGN KEY (SessionId) REFERENCES LiveSessions(Id),
        CONSTRAINT FK_ScoreEvents_Player FOREIGN KEY (PlayerId) REFERENCES Players(Id)
    );
    CREATE INDEX IX_ScoreEvents_Session ON ScoreEvents(SessionId);
    CREATE INDEX IX_ScoreEvents_Player ON ScoreEvents(PlayerId);
    PRINT N'Created table ScoreEvents.';
END
GO

-- 10. BẢNG XẾP HẠNG PHIÊN LIVE (Leaderboards)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Leaderboards')
BEGIN
    CREATE TABLE Leaderboards (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SessionId INT NOT NULL,
        PlayerId INT NOT NULL,
        TotalScore INT NOT NULL DEFAULT 0,
        CorrectCount INT NOT NULL DEFAULT 0,
        WrongCount INT NOT NULL DEFAULT 0,
        StreakCount INT NOT NULL DEFAULT 0,
        MaxStreak INT NOT NULL DEFAULT 0,
        AvgResponseTime FLOAT NOT NULL DEFAULT 0,
        FinalRank INT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Leaderboards_Session FOREIGN KEY (SessionId) REFERENCES LiveSessions(Id),
        CONSTRAINT FK_Leaderboards_Player FOREIGN KEY (PlayerId) REFERENCES Players(Id),
        CONSTRAINT UQ_Leaderboards_Session_Player UNIQUE (SessionId, PlayerId)
    );
    CREATE INDEX IX_Leaderboards_Score ON Leaderboards(SessionId, TotalScore DESC, CorrectCount DESC, AvgResponseTime ASC);
    PRINT N'Created table Leaderboards.';
END
GO

-- 11. BẢNG CẤU HÌNH HỆ THỐNG (GameSettings)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GameSettings')
BEGIN
    CREATE TABLE GameSettings (
        SettingKey NVARCHAR(100) PRIMARY KEY,
        SettingValue NVARCHAR(MAX) NOT NULL,
        Description NVARCHAR(255) NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Created table GameSettings.';
END
GO

-- 12. BẢNG TÀI KHOẢN QUẢN TRỊ (AdminUsers)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdminUsers')
BEGIN
    CREATE TABLE AdminUsers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(100) NOT NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'ADMIN',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Created table AdminUsers.';
END
GO
