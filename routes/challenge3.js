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
    id: 3,
    title: "데이터베이스 정보",
    category: "SQL Injection",
    difficulty: "Hard",
    description: "테이블/컬럼을 등록한 뒤, 취약한 쿼리로 스키마 정보를 추출해보세요.",
    hint: "information_schema를 사용해보세요.",
    solved: false
};

// 예시 테이블/컬럼 등록 API (실제 insert는 하지 않고 예시용)
router.post('/api/sql-injection/add-table', async (req, res) => {
    const { tableName, columnName } = req.body;
    // 실제로는 information_schema를 대상으로 하므로 insert는 하지 않음
    res.json({ success: true, message: `예시 테이블(${tableName})/컬럼(${columnName}) 등록 완료 (실제 DB에는 반영되지 않음)` });
});

// 취약한 DB 스키마 정보 추출 API (SQLi)
router.post('/schema', async (req, res) => {
    const { query } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        // 입력 쿼리 로그
        console.log('[challenge3] 입력 쿼리:', query);
        // 취약한 쿼리 실행 (실제로는 절대 이렇게 하면 안됨!)
        const [results] = await conn.query(query);
        // 응답 결과 로그
        console.log('[challenge3] 쿼리 결과:', results);
        // 클리어 메시지 반환 조건 수정 (results가 배열이 아니어도 동작)
        if (
            query.toLowerCase().includes('information_schema') &&
            ((Array.isArray(results) && results.length > 0) || (!Array.isArray(results) && results))
        ) {
            res.json({
                success: true,
                results,
                clearMessage: '문제를 클리어했습니다!'
            });
        } else {
            res.json({ success: true, results });
        }
    } catch (err) {
        console.log('[challenge3] 쿼리 실행 에러:', err);
        res.json({ success: false, message: 'SQL 오류: ' + err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 문제 정보 API
router.get('/api/challenge/info', (req, res) => {
    res.json(challengeInfo);
});

module.exports = { router, setPool, challengeInfo }; 