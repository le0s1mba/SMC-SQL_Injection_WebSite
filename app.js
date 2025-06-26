require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');

// 문제별 라우터 import
const challenge1Router = require('./routes/challenge1');
const challenge2Router = require('./routes/challenge2');
const challenge3Router = require('./routes/challenge3');

const app = express();
const PORT = process.env.PORT || 3000;

// MariaDB 연결 풀 생성
const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'mo-e.cp6qo28c2yh2.ap-northeast-1.rds.amazonaws.com',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'bicboy',
    password: process.env.DB_PASSWORD || 'bongilcheon',
    database: process.env.DB_NAME || 'mysql',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
});

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'hack-simulation-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// SQL Injection 문제 데이터
const challenges = [
    {
        id: 1,
        title: "기본 로그인 우회",
        category: "SQL Injection",
        difficulty: "Easy",
        description: "로그인 페이지에서 SQL Injection을 통해 관리자 계정으로 로그인하세요.",
        hint: "username 필드에 ' OR '1'='1를 입력해보세요.",
        flag: "FLAG{sql_login_bypass_2024}",
        solved: false
    },
    {
        id: 2,
        title: "검색 기능 우회",
        category: "SQL Injection",
        difficulty: "Medium",
        description: "검색 기능에서 SQL Injection을 통해 숨겨진 데이터를 찾으세요.",
        hint: "UNION 쿼리를 사용해보세요.",
        flag: "FLAG{sql_search_bypass_2024}",
        solved: false
    },
    {
        id: 3,
        title: "데이터베이스 정보",
        category: "SQL Injection",
        difficulty: "Hard",
        description: "데이터베이스의 스키마 정보를 추출하여 테이블 구조를 파악하세요.",
        hint: "information_schema를 사용해보세요.",
        flag: "FLAG{sql_schema_extract_2024}",
        solved: false
    }
];

// 데이터베이스 초기화 함수
async function initializeDatabase() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // 사용자 진행 상황 테이블
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                solved_challenges TEXT,
                total_score INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // 해킹 시도 로그 테이블
        await conn.query(`
            CREATE TABLE IF NOT EXISTS hack_attempts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255),
                challenge_id INT,
                attempt_type VARCHAR(255),
                payload TEXT,
                success BOOLEAN,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 테스트용 사용자 테이블 생성
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 테스트용 사용자 데이터 삽입
        await conn.query(`
            INSERT IGNORE INTO users (username, password, email, role) VALUES 
            ('admin', 'admin123', 'admin@example.com', 'admin'),
            ('user1', 'password1', 'user1@example.com', 'user'),
            ('user2', 'password2', 'user2@example.com', 'user')
        `);
        
        // 테스트용 게시물 테이블 생성
        await conn.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                author VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 테스트용 게시물 데이터 삽입
        await conn.query(`
            INSERT IGNORE INTO posts (title, content, author) VALUES 
            ('공개 게시물', '이것은 공개 게시물입니다.', 'user1'),
            ('비밀 게시물', 'Clear', 'admin'),
            ('일반 게시물', '일반적인 내용입니다.', 'user2')
        `);
        
        // secret_table (2번 문제의 UNION/FLAG용)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS secret_table (
                id INT AUTO_INCREMENT PRIMARY KEY,
                secret_data VARCHAR(255)
            )
        `);
        await conn.query(`
            INSERT IGNORE INTO secret_table (secret_data) VALUES ('Clear')
        `);
        
        console.log('데이터베이스 초기화 완료');
    } catch (err) {
        console.error('데이터베이스 초기화 오류:', err);
    } finally {
        if (conn) conn.release();
    }
}

// 데이터베이스 초기화 실행
initializeDatabase();

// 각 문제별 라우터에 연결 풀 전달
challenge1Router.setPool(pool);
challenge2Router.setPool(pool);
challenge3Router.setPool(pool);

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 문제별 라우터 연결
app.use('/api/challenge1', challenge1Router.router);
app.use('/api/challenge2', challenge2Router.router);
app.use('/api/challenge3', challenge3Router.router);

// 문제 데이터 API
app.get('/api/challenges', (req, res) => {
    res.json(challenges);
});

// 진행 상황 API
app.get('/api/progress', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [progress] = await conn.query('SELECT * FROM user_progress WHERE session_id = ?', [req.sessionID]);
        
        if (progress.length === 0) {
            res.json({ solved: 0, total: challenges.length, score: 0 });
        } else {
            const solved = progress[0].solved_challenges ? JSON.parse(progress[0].solved_challenges).length : 0;
            res.json({ 
                solved: solved, 
                total: challenges.length, 
                score: progress[0].total_score 
            });
        }
    } catch (err) {
        console.error('진행 상황 조회 오류:', err);
        res.json({ solved: 0, total: challenges.length, score: 0 });
    } finally {
        if (conn) conn.release();
    }
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SQL Injection 공격 사이트가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`서버 IP: ${process.env.SERVER_IP || 'localhost'}`);
    console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
    console.log(`http://localhost:${PORT}`);
}); 