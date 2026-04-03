const bg = document.getElementById("bg-video");

const CONFIG = {
    baseSpeed: 360,
    spawnIntervalMin: 900,
    spawnIntervalMax: 1500,
    groundY: 100,
    gravity: 1800,
    maxSpeed: 620,
    speedRampPerSec: 14,
    minSpawnCap: 820,
    maxSpawnCap: 1100,
    scorePerSecond: 10,
    minObstacleGapPx: 420,
    minGapScaleAtMaxSpeed: 1.3
};

const HIGH_SCORE_KEY = "dinoHighScore";

const bgMusic = new Audio("./bgmusic.mpeg");
const gameOverSfx = new Audio("./gameover.mpeg");
bgMusic.loop = true;
bgMusic.volume = 0.45;
gameOverSfx.volume = 0.9;

let audioStarted = false;
let gameOverAudioPlayed = false;

const OBSTACLE_TYPES = [
    {
        name: "obstacle1",
        image: "./obstacle1.png",
        width: 64,
        height: 86,
        yOffset: 0,
        hitbox: { xInset: 12, yInset: 10, width: 40, height: 70 }
    },
    {
        name: "obstacle2",
        image: "./obstacle2.png",
        width: 78,
        height: 104,
        yOffset: 0,
        hitbox: { xInset: 14, yInset: 10, width: 50, height: 88 }
    },
    {
        name: "bird",
        image: "./obstacle3.png",
        width: 84,
        height: 44,
        yOffset: 150,
        hitbox: { xInset: 10, yInset: 8, width: 64, height: 26 }
    }
];

const game = {
    score: 0,
    highScore: 0,
    distanceSec: 0,
    hasBeatenHighScore: false,
    highScoreFlashMs: 0,
    state: "idle",
    speed: CONFIG.baseSpeed,
    obstacles: [],
    spawnTimerMs: 0,
    nextSpawnInMs: randomSpawnDelay(),
    dino: {
        y: CONFIG.groundY,
        vy: 0,
        isJumping: false,
        jumpForce: 760
    }
};

const gameOverText = document.querySelector(".gameOver");
const gameContainer = document.querySelector(".gameContainer");

function startBgMusic() {
    if (audioStarted) return;
    audioStarted = true;
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => { });
}

function stopBgMusic() {
    bgMusic.pause();
    bgMusic.currentTime = 0;
}

function playGameOverAudio() {
    if (gameOverAudioPlayed) return;
    gameOverAudioPlayed = true;
    stopBgMusic();
    gameOverSfx.currentTime = 0;
    gameOverSfx.play().catch(() => { });
}

function randomSpawnDelay() {
    const min = CONFIG.spawnIntervalMin;
    const max = CONFIG.spawnIntervalMax;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickObstacleType() {
    const score = game.score;
    const birdChance = score >= 300 ? 0.45 : 0.18;
    if (Math.random() < birdChance) {
        return OBSTACLE_TYPES.find((t) => t.name === "bird");
    }
    const groundTypes = OBSTACLE_TYPES.filter((t) => t.name !== "bird");
    return groundTypes[Math.floor(Math.random() * groundTypes.length)];
}

function loadHighScore() {
    try {
        const stored = Number(localStorage.getItem(HIGH_SCORE_KEY));
        game.highScore = Number.isFinite(stored) ? stored : 0;
    } catch {
        game.highScore = 0;
    }
}

function saveHighScore() {
    try {
        localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));
    } catch {
    }
}

function triggerHighScoreFlash() {
    game.highScoreFlashMs = 1400;
}

function updateScoreCard() {
    const scoreCard = document.getElementById("scoreCard");
    if (!scoreCard) return;
    const isFlashing = game.highScoreFlashMs > 0;
    scoreCard.classList.toggle("new-high-score-flash", isFlashing);
    scoreCard.textContent =
        "Score: " + Math.floor(game.score) +
        " | High: " + Math.floor(game.highScore) +
        " | Speed: " + Math.floor(game.speed) +
        (isFlashing ? " | NEW HIGH SCORE" : "");
}

function setGameOverVisible(show) {
    if (!gameOverText) return;
    gameOverText.style.display = show ? "block" : "none";
}

function restartGame(startRunning = false) {
    game.score = 0;
    game.distanceSec = 0;
    game.speed = CONFIG.baseSpeed;
    game.hasBeatenHighScore = false;
    game.highScoreFlashMs = 0;

    for (const obs of game.obstacles) {
        obs.el.remove();
    }
    game.obstacles.length = 0;

    game.spawnTimerMs = 0;
    game.nextSpawnInMs = randomSpawnDelay();

    game.dino.y = CONFIG.groundY;
    game.dino.vy = 0;
    game.dino.isJumping = false;

    const dino = document.getElementById("dino");
    if (dino) dino.style.bottom = game.dino.y + "px";

    stopBgMusic();
    gameOverSfx.pause();
    gameOverSfx.currentTime = 0;
    audioStarted = false;
    gameOverAudioPlayed = false;

    game.state = startRunning ? "running" : "idle";
    setGameOverVisible(false);
    if (startRunning) startBgMusic();
    updateScoreCard();
}

function onJumpInput() {
    if (game.state === "gameOver") {
        restartGame(true);
    }
    if (game.state === "idle") {
        game.state = "running";
        startBgMusic();
    }
    if (game.state !== "running") return;
    if (!game.dino.isJumping) {
        game.dino.isJumping = true;
        game.dino.vy = game.dino.jumpForce;
    }
}

function spawnObstacle() {
    const el = document.createElement("div");
    el.className = "obstacle";

    const type = pickObstacleType();
    el.style.width = type.width + "px";
    el.style.height = type.height + "px";
    el.style.backgroundImage = "url(" + type.image + ")";
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundPosition = "bottom center";

    gameContainer.appendChild(el);

    const x = gameContainer.clientWidth + 20;
    const y = CONFIG.groundY + type.yOffset;

    const obstacleData = {
        el,
        x,
        y,
        width: type.width,
        height: type.height,
        type: type.name,
        hitbox: type.hitbox,
        isReady: false
    };

    const probe = new Image();
    probe.onload = () => {
        obstacleData.isReady = true;
    };
    probe.onerror = () => {
        const fallback = OBSTACLE_TYPES[0];
        obstacleData.type = fallback.name;
        obstacleData.width = fallback.width;
        obstacleData.height = fallback.height;
        obstacleData.hitbox = fallback.hitbox;
        el.style.width = fallback.width + "px";
        el.style.height = fallback.height + "px";
        el.style.backgroundImage = "url(" + fallback.image + ")";
        obstacleData.isReady = true;
    };
    probe.src = type.image;

    game.obstacles.push(obstacleData);

    el.style.left = x + "px";
    el.style.bottom = y + "px";
}

function updateSpawner(dt) {
    game.spawnTimerMs += dt * 1000;
    if (game.spawnTimerMs >= game.nextSpawnInMs) {
        const rightMostObstacle = game.obstacles.reduce((maxX, obs) => {
            const trailingEdge = obs.x + obs.width;
            return trailingEdge > maxX ? trailingEdge : maxX;
        }, -Infinity);

        const spawnX = gameContainer.clientWidth + 20;
        const gapToLast = spawnX - rightMostObstacle;
        const speedRatio = Math.min(1, game.speed / CONFIG.maxSpeed);
        const requiredGap = Math.floor(
            CONFIG.minObstacleGapPx * (1 + (CONFIG.minGapScaleAtMaxSpeed - 1) * speedRatio)
        );
        if (rightMostObstacle !== -Infinity && gapToLast < requiredGap) {
            return;
        }

        spawnObstacle();
        game.spawnTimerMs = 0;
        game.nextSpawnInMs = randomSpawnDelay();
    }
}

function updateObstacles(dt) {
    for (let i = game.obstacles.length - 1; i >= 0; i -= 1) {
        const obs = game.obstacles[i];
        obs.x -= game.speed * dt;
        obs.el.style.left = obs.x + "px";
        if (obs.x + obs.width < 0) {
            obs.el.remove();
            game.obstacles.splice(i, 1);
        }
    }
}

function updateDino(dt) {
    game.dino.vy -= CONFIG.gravity * dt;
    game.dino.y += game.dino.vy * dt;

    if (game.dino.y <= CONFIG.groundY) {
        game.dino.y = CONFIG.groundY;
        game.dino.vy = 0;
        game.dino.isJumping = false;
    }

    const dino = document.getElementById("dino");
    if (dino) {
        dino.style.bottom = game.dino.y + "px";
    }
}

function isColliding(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function getDinoHitbox() {
    const dinoEl = document.getElementById("dino");
    if (!dinoEl) return null;
    const dinoLeft = parseFloat(getComputedStyle(dinoEl).left) || 220;
    return {
        x: dinoLeft + 18,
        y: game.dino.y + 10,
        width: 50,
        height: 78
    };
}

function checkCollisions() {
    const dinoBox = getDinoHitbox();
    if (!dinoBox) return;

    for (const obs of game.obstacles) {
        if (!obs.isReady) continue;

        const obsBox = {
            x: obs.x + obs.hitbox.xInset,
            y: obs.y + obs.hitbox.yInset,
            width: obs.hitbox.width,
            height: obs.hitbox.height
        };

        if (obsBox.x + obsBox.width < dinoBox.x) {
            continue;
        }

        if (isColliding(dinoBox, obsBox)) {
            game.state = "gameOver";
            setGameOverVisible(true);
            playGameOverAudio();
            break;
        }
    }
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function updateScoreAndDifficulty(dt) {
    game.distanceSec += dt;
    game.score += CONFIG.scorePerSecond * dt;

    game.speed = Math.min(
        CONFIG.maxSpeed,
        CONFIG.baseSpeed + game.distanceSec * CONFIG.speedRampPerSec
    );

    const pressure = Math.min(1, game.score / 500);
    const dynamicMin = Math.max(
        CONFIG.minSpawnCap,
        Math.floor(lerp(CONFIG.spawnIntervalMin, CONFIG.minSpawnCap, pressure))
    );
    const dynamicMax = Math.max(
        CONFIG.maxSpawnCap,
        Math.floor(lerp(CONFIG.spawnIntervalMax, CONFIG.maxSpawnCap, pressure))
    );

    game.nextSpawnInMs = Math.min(
        game.nextSpawnInMs,
        Math.floor(Math.random() * (dynamicMax - dynamicMin + 1)) + dynamicMin
    );

    if (game.score > game.highScore) {
        if (!game.hasBeatenHighScore) {
            game.hasBeatenHighScore = true;
            triggerHighScoreFlash();
        }
        game.highScore = game.score;
        saveHighScore();
    }

    if (game.highScoreFlashMs > 0) {
        game.highScoreFlashMs = Math.max(0, game.highScoreFlashMs - dt * 1000);
    }

    updateScoreCard();
}

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        onJumpInput();
    }
    if ((e.code === "Enter" || e.code === "KeyR") && game.state === "gameOver") {
        e.preventDefault();
        restartGame(false);
    }
});

document.addEventListener("touchstart", onJumpInput);
document.addEventListener("click", onJumpInput);

setGameOverVisible(false);
loadHighScore();
updateScoreCard();

let lastTime = 0;

function gameLoop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = (ts - lastTime) / 1000;
    lastTime = ts;

    if (game.state === "running") {
        updateScoreAndDifficulty(dt);
        updateDino(dt);
        updateSpawner(dt);
        updateObstacles(dt);
        checkCollisions();
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

