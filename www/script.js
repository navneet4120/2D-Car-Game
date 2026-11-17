document.title = "2D Car Racing";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const intro = document.getElementById("intro");
const scoreDiv = document.getElementById("score");
const ui = document.getElementById("ui");
const pauseOverlay = document.getElementById("pause-overlay");
const speedVal = document.getElementById("speed-val");
const nitroStatus = document.getElementById("nitro-status");
const gameOverOverlay = document.getElementById("game-over-overlay");

const lanes = [50, 150, 250];
let car, carX, obstacles, score, gameActive, isPaused;
let lives = 3; 
let recoveryTimer = 0;
let gameMode = 'two-way'; 
const RECOVERY_TIME = 600;

let laneCooldown = [0, 0, 0];
let roadOffset = 0;
let playerTilt = 0;
let manualSpeed = 10;
let displayedSpeed = 10;
let carPushY = 0; 
let targetPushY = 0; 
let sessionMaxSpeed = 0;

let nitroActive = false;
let nitroReady = true;
let nitroTimer = 0;
let normalSpeedSave = 10;

// Keyboard Navigation Variables
let currentMenuIndex = 0;
let menuOptions = [];
let menuActive = true; 

// Initialization
setupMenu(['btn-two-way', 'btn-one-way']);

function setupMenu(options) {
    menuOptions = options;
    currentMenuIndex = 0;
    updateMenuSelection();
}

function updateMenuSelection() {
    menuOptions.forEach((btnId, index) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (index === currentMenuIndex) btn.classList.add("active-btn");
            else btn.classList.remove("active-btn");
        }
    });
}

function startGame(mode) {
    gameMode = mode;
    menuActive = false;
    intro.style.display = "none";
    document.getElementById("game-container").style.display = "block";
    initGame();
}

function goToMainMenu() {
    isPaused = false;
    gameActive = false;
    menuActive = true;
    pauseOverlay.style.display = "none";
    gameOverOverlay.style.display = "none";
    document.getElementById("game-container").style.display = "none";
    
    // YAHAN CHANGE HAI: block ki jagah flex use karo
    const introMenu = document.getElementById("intro");
    introMenu.style.display = "flex"; 
    
    canvas.classList.remove("game-blur");
    setupMenu(['btn-two-way', 'btn-one-way']);
}

function initGame() {
    menuActive = false;
    car = { lane: 1, y: 20 }; 
    carX = lanes[car.lane] - 10;
    playerTilt = 0; carPushY = 0; targetPushY = 0;
    obstacles = []; score = 0; manualSpeed = 10; displayedSpeed = 10; sessionMaxSpeed = 0;
    lives = 3; 
    recoveryTimer = 0;
    updateLifeUI();
    
    gameActive = true; 
    isPaused = false;
    gameOverOverlay.style.display = "none";
    pauseOverlay.style.display = "none";
    canvas.classList.remove("game-blur");
    
    requestAnimationFrame(gameLoop);
}

function updateLifeUI() {
    for (let i = 1; i <= 3; i++) {
        const box = document.getElementById(`life${i}`);
        if (box) {
            if (i <= lives) box.classList.remove("life-lost");
            else box.classList.add("life-lost");
        }
    }
}

function spawnObstacle() {
    let lane = Math.floor(Math.random() * 3);
    if (obstacles.filter(o => o.y < 8).length >= 2 || laneCooldown[lane] > 0) return null;
    laneCooldown[lane] = 130; 
    
    let isBus = Math.random() < 0.4;
    let type = isBus ? "bus" : "car"; 
    let speed = isBus ? 0.02 : 0.04; 
    let color;

    if (isBus) {
        color = ["#ee5253", "#0984e3", "#2ecc71"][Math.floor(Math.random() * 3)];
    } else {
        color = ["taxi", "#ff9f43", "#a29bfe", "#dfe6e9", "#f368e0"][Math.floor(Math.random() * 5)];
    }

    return { lane, x: lanes[lane]-10, y: -15, type, color, speed, isHit: false, hitDir: 0 };
}

function drawPlayer(x, y, color) {
    ctx.save();
    ctx.translate(x + 10, y + 5 + carPushY); 
    ctx.rotate(playerTilt);
    
    if (nitroActive) {
        ctx.fillStyle = "rgba(0, 242, 255, " + (Math.random() * 0.6) + ")";
        ctx.fillRect(-8, 15, 6, 25 + Math.random()*20);
        ctx.fillRect(2, 15, 6, 25 + Math.random()*20);
    }
    
    ctx.fillStyle = "#000"; 
    ctx.fillRect(-13, 5, 4, 8); ctx.fillRect(9, 5, 4, 8);
    ctx.fillRect(-13, 18, 4, 8); ctx.fillRect(9, 18, 4, 8);
    
    ctx.fillStyle = "#111"; ctx.fillRect(-12, 28, 24, 4); 
    ctx.fillStyle = nitroActive ? "#00f2ff" : color; 
    ctx.fillRect(-10, 0, 20, 30); 
    
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(-3, 0, 2, 30); ctx.fillRect(1, 0, 2, 30); 
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.fillRect(-7, 4, 14, 8); 
    ctx.fillStyle = "#ffff00"; ctx.fillRect(-8, -2, 4, 3); ctx.fillRect(4, -2, 4, 3); 
    ctx.restore();
}

function drawEnemy(o) {
    let h = (o.type === "bus") ? 55 : 30;
    ctx.save();
    ctx.translate(o.x + 10, (o.y * 20) + h/2);
    if (gameMode === 'one-way') ctx.rotate(Math.PI);
    ctx.fillStyle = "#000"; 
    ctx.fillRect(-13, -h/2 + 5, 3, 7); ctx.fillRect(10, -h/2 + 5, 3, 7);
    ctx.fillRect(-13, h/2 - 12, 3, 7); ctx.fillRect(10, h/2 - 12, 3, 7);
    
    if (o.color === "taxi") {
        ctx.fillStyle = "#f1c40f"; ctx.fillRect(-10, -h/2, 20, 30);
        ctx.fillStyle = "black"; ctx.fillRect(-4, 2, 8, 3);
    } else {
        ctx.fillStyle = o.color; ctx.fillRect(-10, -h/2, 20, h);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    let glassY = (o.type === "bus") ? (h/2 - 15) : (h/2 - 12); 
    ctx.fillRect(-8, glassY, 16, 8); 
    ctx.shadowBlur = 8;
    ctx.shadowColor = "white";
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(-8, h/2 - 2, 4, 3); ctx.fillRect(4, h/2 - 2, 4, 3); 
    ctx.restore();
}

function handleCollision(o) {
    if (nitroActive) {
        o.isHit = true; o.hitDir = o.x < carX ? -1 : 1;
        return;
    }
    let damage = (o.type === "bus") ? 2 : 1;
    lives -= damage;
    recoveryTimer = 0; 
    updateLifeUI();
    if (lives <= 0) { endGame(); } 
    else {
        o.isHit = true; o.hitDir = 1; targetPushY = 20; 
    }
}

function isColliding(o) {
    if (o.isHit) return false;
    let carTop = (car.y * 20) + carPushY, h = (o.type === "bus") ? 55 : 30;
    return (carX < o.x + 20 && carX + 20 > o.x && carTop < (o.y * 20) + h && carTop + 30 > (o.y * 20));
}

function togglePause() {
    if (!gameActive) return;
    isPaused = !isPaused;
    pauseOverlay.style.display = isPaused ? "flex" : "none";
    canvas.classList.toggle("game-blur", isPaused);
    if (isPaused) {
        setupMenu(['btn-resume', 'btn-pause-menu']);
    } else {
        requestAnimationFrame(gameLoop);
    }
}

function update() {
    roadOffset += (manualSpeed / 10); 
    if (roadOffset >= 40) roadOffset = 0;
    laneCooldown = laneCooldown.map(c => c > 0 ? c - 1 : 0);
    
    if (displayedSpeed < manualSpeed) displayedSpeed += 0.5;
    else if (displayedSpeed > manualSpeed) displayedSpeed -= 0.5;

    if (displayedSpeed > sessionMaxSpeed) sessionMaxSpeed = displayedSpeed;

    if (gameActive && !isPaused && lives < 3) {
        recoveryTimer++;
        if (recoveryTimer >= RECOVERY_TIME) {
            lives++;
            recoveryTimer = 0;
            updateLifeUI();
        }
    }

    if (nitroActive) {
        nitroTimer--;
        if (nitroTimer <= 0) {
            nitroActive = false; manualSpeed = normalSpeedSave;
            nitroReady = false; nitroStatus.innerText = "RECHARGING...";
            setTimeout(() => { nitroReady = true; nitroStatus.innerText = "NITRO READY"; }, 9000); 
        }
    }

    if (Math.random() < 0.015) {
        let obj = spawnObstacle();
        if (obj) obstacles.push(obj);
    }

    carPushY += (targetPushY - carPushY) * 0.1; targetPushY *= 0.92; 

    obstacles.forEach(o => {
        if (o.isHit) { o.x += o.hitDir * 8; o.y += 0.2; }
        else {
            let moveSpeed = (gameMode === 'one-way') ? (manualSpeed / 200) - o.speed : (manualSpeed / 200) + o.speed;
            o.y += moveSpeed; 
            if (isColliding(o)) handleCollision(o);
        }
    });

    obstacles = obstacles.filter(o => o.y < 30 && o.x > -100 && o.x < 400);
    score += nitroActive ? 5 : 1;
    carX += (lanes[car.lane] - 10 - carX) * 0.1;
    playerTilt = (lanes[car.lane] - 10 - carX) * 0.005;
}

function draw() {
    ctx.fillStyle = "#222"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; ctx.setLineDash([20, 30]);
    ctx.lineDashOffset = -roadOffset;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100, 500); ctx.stroke(); }
    drawPlayer(carX, car.y * 20, "#00d2ff");
    obstacles.forEach(o => drawEnemy(o));
    
    scoreDiv.innerText = Math.floor(score / 15);
    speedVal.innerText = Math.floor(displayedSpeed);
}

function endGame() {
    gameActive = false;
    canvas.classList.add("game-blur");

    let currentScore = Math.floor(score / 15);
    let currentSpeed = Math.floor(sessionMaxSpeed);

    let scoreKey = (gameMode === 'one-way') ? "highScore_oneWay" : "highScore_twoWay";
    let speedKey = (gameMode === 'one-way') ? "topSpeed_oneWay" : "topSpeed_twoWay";

    let highScore = localStorage.getItem(scoreKey) || 0;
    let topSpeed = localStorage.getItem(speedKey) || 0;

    if(currentScore > highScore) { highScore = currentScore; localStorage.setItem(scoreKey, highScore); }
    if(currentSpeed > topSpeed) { topSpeed = currentSpeed; localStorage.setItem(speedKey, topSpeed); }

    document.getElementById("mode-display").innerText = gameMode.replace('-', ' ');
    document.getElementById("final-score-val").innerText = currentScore;
    document.getElementById("high-score-val").innerText = highScore;
    document.getElementById("max-speed-val").innerText = currentSpeed;
    document.getElementById("all-time-speed-val").innerText = topSpeed;

    gameOverOverlay.style.display = "flex";
    setupMenu(['btn-restart', 'btn-over-menu']);
}

function gameLoop() {
    if (!gameActive || isPaused) return;
    update(); draw();
    requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    // 1. Menu Navigation logic
    if (menuActive || isPaused || !gameActive) {
        if (key === "a" || key === "w" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
            currentMenuIndex = (currentMenuIndex - 1 + menuOptions.length) % menuOptions.length;
            updateMenuSelection();
        }
        if (key === "d" || key === "s" || e.key === "ArrowRight" || e.key === "ArrowDown") {
            currentMenuIndex = (currentMenuIndex + 1) % menuOptions.length;
            updateMenuSelection();
        }
        if (e.code === "Space" || e.key === "Enter") {
            document.getElementById(menuOptions[currentMenuIndex]).click();
            return;
        }
        if (key !== " ") return; 
    }

    // 2. Gameplay Controls
    if (e.code === "Space") { 
        e.preventDefault(); 
        if (!gameActive && !menuActive) return; 
        togglePause(); 
    }

    if (!isPaused && gameActive) {
        if ((key === "a" || e.key === "ArrowLeft") && car.lane > 0) car.lane--;
        if ((key === "d" || e.key === "ArrowRight") && car.lane < 2) car.lane++;
        if (key === "w") { manualSpeed += 5; targetPushY = -25; }
        if (key === "s") { manualSpeed = Math.max(5, manualSpeed - 5); targetPushY = 15; }
        if (key === "q" && nitroReady && !nitroActive) {
            nitroActive = true; nitroTimer = 540; 
            normalSpeedSave = manualSpeed; manualSpeed = 100;
            targetPushY = -40; nitroStatus.innerText = "NITRO ACTIVE!";
        }
    }
});

function setupMobileControls() {
    // 1. Fix Pause Button
    const pauseBtn = document.getElementById("pause-btn-ui");
    pauseBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Game controls ko trigger hone se rokega
        togglePause();
    }, {passive: false});

    // 2. Left Movement
    document.getElementById("touch-left").addEventListener("touchstart", (e) => {
        if (gameActive && !isPaused) {
            if (car.lane > 0) car.lane--;
        }
    });

    // 3. Right Movement
    document.getElementById("touch-right").addEventListener("touchstart", (e) => {
        if (gameActive && !isPaused) {
            if (car.lane < 2) car.lane++;
        }
    });

    // 4. Speed Up (W)
    document.getElementById("touch-up").addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (gameActive && !isPaused) {
            manualSpeed += 5; 
            targetPushY = -25;
        }
    });

    // 5. Speed Down (S)
    document.getElementById("touch-down").addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (gameActive && !isPaused) {
            manualSpeed = Math.max(5, manualSpeed - 5); 
            targetPushY = 15;
        }
    });

    // 6. Nitro (Niche Left Mein)
    document.getElementById("touch-nitro").addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (gameActive && !isPaused && nitroReady && !nitroActive) {
            activateNitro(); // Maan lete hain ye function aapne banaya hai ya logic wahi rahega
            if (navigator.vibrate) navigator.vibrate(50);
        }
    });
}

// Nitro Logic Helper
function activateNitro() {
    nitroActive = true; 
    nitroTimer = 540; 
    normalSpeedSave = manualSpeed; 
    manualSpeed = 100;
    targetPushY = -40; 
    nitroStatus.innerText = "NITRO ACTIVE!";
}

// Initialization
setupMobileControls();