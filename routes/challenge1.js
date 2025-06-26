const express = require('express');
const router = express.Router();
const mariadb = require('mariadb');

// MariaDB 연결 풀 (app.js에서 전달받을 예정)
let pool;

// 연결 풀 설정 함수
function setPool(dbPool) {
    pool = dbPool;
}

// 문제 정보
const challengeInfo = {
    id: 1,
    title: "기본 로그인 우회",
    category: "SQL Injection",
    difficulty: "Easy",
    description: "회원가입 후, 취약한 로그인 쿼리를 우회하여 관리자 계정으로 로그인하세요.",
    hint: "username 필드에 ' OR '1'='1를 입력해보세요.",
    solved: false
};

// 회원가입 API (정상 INSERT)
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
            [username, password, email, 'user']
        );
        res.json({ success: true, message: '회원가입 성공!' });
    } catch (err) {
        res.json({ success: false, message: '회원가입 실패: ' + err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 취약한 로그인 API (SQLi)
router.post('/login', async (req, res) => {
    console.log('challenge1 /login 진입');
    const { username, password } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        const users = await conn.query(query);
        console.log('실행 쿼리:', query);
        console.log('쿼리 결과:', users);
        if (users.length > 0) {
            res.json({ success: true, message: '로그인 성공!', flag: challengeInfo.flag, user: users[0] });
        } else {
            res.json({ success: false, message: '로그인 실패. SQL Injection을 시도해보세요.' });
        }
    } catch (err) {
        res.json({ success: false, message: '오류: ' + err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 문제 정보 API
router.get('/api/challenge/info', (req, res) => {
    res.json(challengeInfo);
});

module.exports = { router, setPool, challengeInfo }; 