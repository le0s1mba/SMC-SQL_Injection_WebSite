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
    id: 2,
    title: "검색 기능 우회",
    category: "SQL Injection",
    difficulty: "Medium",
    description: "게시글을 등록한 뒤, 취약한 검색 쿼리를 우회하여 숨겨진 데이터를 찾아보세요.",
};

// 다양한 오류 메시지 생성 함수
function getRandomErrorMessage() {
    const errorMessages = [
        "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
        "쿼리 실행 중 오류가 발생했습니다. 입력값을 확인해주세요.",
        "검색 조건이 너무 복잡합니다. 다른 검색어를 시도해보세요.",
        "데이터베이스 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
        "검색 쿼리 구문에 문제가 있습니다. 검색어를 수정해주세요.",
        "데이터베이스 테이블에 접근할 수 없습니다.",
        "검색 결과를 처리하는 중 오류가 발생했습니다.",
        "입력된 검색 조건이 유효하지 않습니다.",
        "데이터베이스 인덱스 오류가 발생했습니다.",
        "검색 기능이 일시적으로 사용할 수 없습니다."
    ];
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
}

// 플래그 감지 함수
function detectFlag(posts) {
    if (!Array.isArray(posts)) return false;
    for (let post of posts) {
        if (post && typeof post === 'object') {
            for (let key in post) {
                if (post[key] && typeof post[key] === 'string' && post[key] === 'Clear') {
                    return true;
                }
            }
        }
    }
    return false;
}

// 게시글 등록 API (정상 INSERT)
router.post('/api/sql-injection/post', async (req, res) => {
    const { title, content, author } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO posts (title, content, author) VALUES (?, ?, ?)',
            [title, content, author]
        );
        res.json({ success: true, message: '게시글 등록 성공!' });
    } catch (err) {
        res.json({ success: false, message: '게시글 등록 실패: ' + err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 취약한 검색 API (SQLi)
router.post('/search', async (req, res) => {
    console.log('challenge2 /search 진입');
    const { search } = req.body;
    const keyword = search;
    
    // 1단계 페이로드 필터링
    if (!keyword || keyword.match(/(#|or|and)/i)) {
        console.log('필터링에 걸림:', keyword);
        return res.json({ success: false, message: '입력값이 필터링에 의해 차단되었습니다.' });
    }
    
    let conn;
    try {
        conn = await pool.getConnection();
        // 취약한 SQL 쿼리 (실제로는 절대 이렇게 하면 안됨!)
        const query = `SELECT * FROM posts WHERE title = '${keyword}'`;
        console.log('실행 쿼리:', query);
        let posts = await conn.query(query);
        if (!Array.isArray(posts)) {
            posts = [posts];
        }
        console.log('쿼리 결과:', posts);
        
        // 플래그 감지
        const flagDetected = detectFlag(posts);
        
        if (flagDetected) {
            // 플래그가 포함된 post는 결과에서 제외
            const filteredPosts = posts.filter(post => {
                for (let key in post) {
                    if (post[key] && typeof post[key] === 'string' && post[key].includes('FLAG{sql_search_bypass_2024}')) {
                        return false;
                    }
                }
                return true;
            });
            res.json({ 
                success: true, 
                posts: filteredPosts,
                flag: challengeInfo.flag,
                message: '🎉 검색 우회 성공! SQL Injection이 성공했습니다.'
            });
        } else {
            res.json({ success: true, posts }); // 검색 결과가 없을 때 별도의 메시지는 내려주지 않음
        }
        
    } catch (err) {
        console.log('쿼리 실행 에러:', err);
        
        // SQL 오류 코드에 따른 구체적인 메시지
        let errorMessage;
        if (err.errno === 1064 || err.code === 'ER_PARSE_ERROR' || err.code === 'ER_SYNTAX_ERROR') {
            errorMessage = 'SQL 문법 오류가 발생했습니다. 쿼리 구문을 확인해주세요.';
        } else if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = '해당 테이블이 존재하지 않습니다.';
        } else if (err.errno === 1054 || err.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = '존재하지 않는 컬럼입니다.';
        } else if (err.errno === 1045 || err.code === 'ER_ACCESS_DENIED_ERROR') {
            errorMessage = '데이터베이스 접근 권한이 없습니다.';
        } else if (err.errno === 2006 || err.code === 'ER_CONNECTION_LOST') {
            errorMessage = '데이터베이스 연결이 끊어졌습니다.';
        } else if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
            errorMessage = '중복된 데이터가 존재합니다.';
        } else if (err.errno === 1264 || err.code === 'ER_DATA_TOO_LONG') {
            errorMessage = '입력된 데이터가 너무 깁니다.';
        } else if (err.errno === 1136 || err.code === 'ER_WRONG_VALUE_COUNT') {
            errorMessage = '컬럼 수와 값의 수가 일치하지 않습니다.';
        } else if (err.errno === 1365 || err.code === 'ER_DIVISION_BY_ZERO') {
            errorMessage = '0으로 나누기 오류가 발생했습니다.';
        } else if (err.errno === 1242 || err.code === 'ER_SUBQUERY_NO_1_ROW') {
            errorMessage = '서브쿼리가 2개 이상의 행을 반환했습니다.';
        } else {
            // 기본 오류 메시지
            errorMessage = getRandomErrorMessage();
        }
        // 상세 DB 에러 메시지도 함께 전달
        if (err.sqlMessage) {
            errorMessage += `<br><span style="font-size:0.95em;color:#888;">(DB 오류: ${err.sqlMessage})</span>`;
        }
        res.json({ success: false, message: errorMessage });
    } finally {
        if (conn) conn.release();
    }
});

// 문제 정보 API
router.get('/api/challenge/info', (req, res) => {
    res.json(challengeInfo);
});

module.exports = { router, setPool, challengeInfo }; 