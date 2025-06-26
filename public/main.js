// Matrix 배경 효과
function createMatrix() {
    const matrix = document.getElementById('matrix');
    if (!matrix) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    matrix.appendChild(canvas);
    
    const chars = '01';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    
    for (let i = 0; i < columns; i++) {
        drops[i] = 1;
    }
    
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const text = chars.charAt(Math.floor(Math.random() * chars.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    
    setInterval(draw, 35);
}

// 문제 목록 로드
async function loadChallenges() {
    try {
        const response = await fetch('/api/challenges');
        const challenges = await response.json();
        
        const tbody = document.getElementById('challengesTable');
        if (!tbody) return;
        
        tbody.innerHTML = challenges.map(challenge => `
            <tr class="fade-in">
                <td>${challenge.id}</td>
                <td>
                    <strong>${challenge.title}</strong>
                    <br><small class="text-muted">${challenge.description}</small>
                </td>
                <td>
                    <span class="badge bg-primary">${challenge.category}</span>
                </td>
                <td>
                    ${getDifficultyBadge(challenge.difficulty)}
                </td>
                <td>
                    <span class="badge bg-secondary challenge-status" data-id="${challenge.id}">미해결</span>
                </td>
                <td>
                    <a href="/challenge/${challenge.id}" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-play"></i> 시작
                    </a>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('문제 목록 로드 오류:', error);
    }
}

// 난이도 배지 생성
function getDifficultyBadge(difficulty) {
    switch (difficulty) {
        case 'Easy':
            return '<span class="badge bg-success">Easy</span>';
        case 'Medium':
            return '<span class="badge bg-warning">Medium</span>';
        case 'Hard':
            return '<span class="badge bg-danger">Hard</span>';
        default:
            return '<span class="badge bg-secondary">Unknown</span>';
    }
}

// 진행 상황 로드
async function loadProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        
        document.getElementById('solvedChallenges').textContent = data.solved;
        document.getElementById('totalChallenges').textContent = data.total;
        document.getElementById('progressRate').textContent = Math.round((data.solved / data.total) * 100) + '%';
        document.getElementById('totalScore').textContent = data.score;
        
        // 해결된 문제 표시 업데이트
        updateSolvedChallenges(data.solved);
        
    } catch (error) {
        console.error('진행 상황 로드 오류:', error);
    }
}

// 해결된 문제 표시 업데이트
function updateSolvedChallenges(solvedCount) {
    const statusElements = document.querySelectorAll('.challenge-status');
    statusElements.forEach((element, index) => {
        if (index < solvedCount) {
            element.textContent = '해결됨';
            element.className = 'badge bg-success challenge-status';
        }
    });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    createMatrix();
    loadChallenges();
    loadProgress();
    
    // 창 크기 변경 시 Matrix 캔버스 크기 조정
    window.addEventListener('resize', function() {
        const matrix = document.getElementById('matrix');
        if (matrix) {
            matrix.innerHTML = '';
            createMatrix();
        }
    });
});

// 전역 함수들 (다른 페이지에서 사용)
window.HackCTF = {
    showResult: function(message, isSuccess = false) {
        const resultBox = document.createElement('div');
        resultBox.className = `result-box ${isSuccess ? 'success-result' : 'error-result'}`;
        resultBox.innerHTML = `
            <i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        `;
        
        // 결과를 페이지에 추가
        const container = document.querySelector('.container') || document.body;
        container.appendChild(resultBox);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            resultBox.remove();
        }, 3000);
    },
    
    showFlag: function(flag) {
        const flagBox = document.createElement('div');
        flagBox.className = 'flag-box fade-in';
        flagBox.innerHTML = `
            <i class="fas fa-flag"></i>
            <br>축하합니다! 플래그를 획득했습니다!
            <br><strong>${flag}</strong>
        `;
        
        const container = document.querySelector('.container') || document.body;
        container.appendChild(flagBox);
        
        // 플래그는 자동으로 제거하지 않음
    },
    
    showHint: function(hint) {
        const hintBox = document.createElement('div');
        hintBox.className = 'hint-box fade-in';
        hintBox.innerHTML = `
            <i class="fas fa-lightbulb"></i>
            <strong>힌트:</strong> ${hint}
        `;
        
        const container = document.querySelector('.container') || document.body;
        container.appendChild(hintBox);
    }
}; 