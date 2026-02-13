/* ═══════════════════════════════════════════════════════════
   CHROMA SHIFT — Game Engine
   Pure Vanilla JavaScript · No Frameworks
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ─── Constants ───
  const LEVELS = {
    1: { name: "STANDARD", gridSize: 5, count: 25, timeLimit: 30, penalty: 0.5 },
    2: { name: "PRO", gridSize: 5, count: 25, timeLimit: 22, penalty: 0.8 },
    3: { name: "ELITE", gridSize: 5, count: 25, timeLimit: 18, penalty: 1.0 },
    4: { name: "OMEGA", gridSize: 6, count: 36, timeLimit: 40, penalty: 2.0 },
  };

  const RANKS = [
    {
      threshold: 12,
      name: "GODMODE",
      cssClass: "rank-godmode",
      sub: "Transcendent reflexes",
    },
    {
      threshold: 15,
      name: "ELITE",
      cssClass: "rank-elite",
      sub: "Top tier operative",
    },
    {
      threshold: 18,
      name: "PRO",
      cssClass: "rank-pro",
      sub: "Sharp and efficient",
    },
    {
      threshold: 22,
      name: "ADVANCED",
      cssClass: "rank-advanced",
      sub: "Solid performance",
    },
    {
      threshold: Infinity,
      name: "BEGINNER",
      cssClass: "rank-beginner",
      sub: "Keep training, agent",
    },
  ];

  const STORAGE_KEY = "chromaShift_data";

  // ─── State ───
  let state = {
    currentLevel: 1,
    nextNumber: 1,
    timerRunning: false,
    startTime: 0,
    elapsed: 0,
    penalties: 0,
    penaltyTime: 0,
    combo: 0,
    maxCombo: 0,
    penaltyCount: 0,
    gameActive: false,
    soundEnabled: true,
    rafId: null,
  };

  // ─── DOM References ───
  const $ = (id) => document.getElementById(id);

  const DOM = {
    // Screens
    startScreen: $("startScreen"),
    gameScreen: $("gameScreen"),
    gameOverScreen: $("gameOverScreen"),
    // Start screen
    levelBtns: document.querySelectorAll(".level-btn"),
    playBtn: $("playBtn"),
    bestTimes: [
      null,
      $("bestTime1"),
      $("bestTime2"),
      $("bestTime3"),
      $("bestTime4"),
      $("bestTime5"),
    ],
    // Game screen
    hudLevel: $("hudLevel"),
    hudTimer: $("hudTimer"),
    hudBest: $("hudBest"),
    hudCombo: $("hudCombo"),
    hudNext: $("hudNext"),
    hudPenalty: $("hudPenalty"),
    timerLabel: $("timerLabel"),
    gridContainer: $("gridContainer"),
    gridWrapper: $("gridWrapper"),
    gridSweep: $("gridSweep"),
    restartBtn: $("restartBtn"),
    changeLevelBtn: $("changeLevelBtn"),
    soundToggleBtn: $("soundToggleBtn"),
    // Game over screen
    gameoverTitle: $("gameoverTitle"),
    gameoverTime: $("gameoverTime"),
    rankBadge: $("rankBadge"),
    rankText: $("rankText"),
    rankSub: $("rankSub"),
    rankReveal: $("rankReveal"),
    statCombo: $("statCombo"),
    statPenalties: $("statPenalties"),
    statPenaltyTime: $("statPenaltyTime"),
    gameoverStats: $("gameoverStats"),
    playAgainBtn: $("playAgainBtn"),
    gameoverLevelBtn: $("gameoverLevelBtn"),
    // Particles
    particlesCanvas: $("particlesCanvas"),
  };

  // ─── Audio System (Web Audio API) ───
  let audioCtx = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      // Audio not supported
    }
  }

  function playTone(freq, duration, type = "sine", volume = 0.12) {
    if (!state.soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + duration,
      );
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // ignore audio errors
    }
  }

  function playClickSound() {
    playTone(800, 0.08, "square", 0.06);
  }

  function playCorrectSound() {
    playTone(520 + state.nextNumber * 18, 0.12, "sine", 0.1);
    setTimeout(
      () => playTone(680 + state.nextNumber * 18, 0.1, "sine", 0.07),
      50,
    );
  }

  function playWrongSound() {
    playTone(180, 0.2, "sawtooth", 0.1);
    setTimeout(() => playTone(140, 0.25, "sawtooth", 0.08), 80);
  }

  function playCompleteSound() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, "sine", 0.12), i * 100);
    });
  }

  function playGameOverSound() {
    playTone(300, 0.3, "sawtooth", 0.1);
    setTimeout(() => playTone(200, 0.4, "sawtooth", 0.1), 150);
  }

  // ─── Haptics ───
  function hapticLight() {
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function hapticMedium() {
    if (navigator.vibrate) navigator.vibrate(25);
  }

  function hapticHeavy() {
    if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
  }

  // ─── Storage ───
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      /* ignore */
    }
    return { bestTimes: {}, currentLevel: 1, soundEnabled: true };
  }

  function loadInitialState() {
    const data = loadData();
    state.currentLevel = data.currentLevel || 1;
    state.soundEnabled =
      data.soundEnabled !== undefined ? data.soundEnabled : true;
  }

  function saveData(bestTimes) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bestTimes,
          currentLevel: state.currentLevel,
          soundEnabled: state.soundEnabled,
        }),
      );
    } catch (e) {
      /* ignore */
    }
  }

  function getBestTimes() {
    const data = loadData();
    return data.bestTimes || {};
  }

  function setBestTime(level, time) {
    const bests = getBestTimes();
    if (!bests[level] || time < bests[level]) {
      bests[level] = time;
      saveData(bests);
      return true;
    }
    saveData(bests);
    return false;
  }

  // ─── Utility ───
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTime(seconds) {
    return seconds.toFixed(2);
  }

  function formatBestTime(seconds) {
    if (!seconds) return "—";
    return seconds.toFixed(2) + "s";
  }

  // ─── Screen Management ───
  function showScreen(screenEl) {
    [DOM.startScreen, DOM.gameScreen, DOM.gameOverScreen].forEach((s) => {
      s.classList.remove("active");
    });
    // Small delay for smooth transition
    requestAnimationFrame(() => {
      screenEl.classList.add("active");
    });
  }

  // ─── Particle System ───
  const particles = [];
  let particleCtx = null;

  function initParticles() {
    const canvas = DOM.particlesCanvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particleCtx = canvas.getContext("2d");
  }

  function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
  }

  function spawnCompletionParticles() {
    const colors = ["#00d4ff", "#ff2d95", "#a855f7", "#22d3ee", "#00ff88"];
    for (let i = 0; i < 60; i++) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function updateParticles() {
    if (!particleCtx) return;
    const canvas = DOM.particlesCanvas;
    particleCtx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03; // slight gravity
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      particleCtx.globalAlpha = p.life * 0.8;
      particleCtx.fillStyle = p.color;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      particleCtx.fill();

      // Trail glow
      particleCtx.globalAlpha = p.life * 0.3;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.size * p.life * 2, 0, Math.PI * 2);
      particleCtx.fill();
    }

    particleCtx.globalAlpha = 1;
  }

  // ─── Timer System ───
  function startTimer() {
    state.timerRunning = true;
    state.startTime = performance.now();
    tickTimer();
  }

  function stopTimer() {
    state.timerRunning = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function tickTimer() {
    if (!state.timerRunning) return;

    const now = performance.now();
    state.elapsed = (now - state.startTime) / 1000 + state.penaltyTime;

    const level = LEVELS[state.currentLevel];

    if (level.timeLimit > 0) {
      const remaining = level.timeLimit - state.elapsed;
      DOM.hudTimer.textContent = formatTime(Math.max(0, remaining));

      // Warning states
      DOM.hudTimer.classList.remove("warning", "critical");
      if (remaining <= 5 && remaining > 2) {
        DOM.hudTimer.classList.add("warning");
      } else if (remaining <= 2) {
        DOM.hudTimer.classList.add("critical");
      }

      if (remaining <= 0) {
        gameOver(false);
        return;
      }
    } else {
      DOM.hudTimer.textContent = formatTime(state.elapsed);
    }

    updateParticles();
    state.rafId = requestAnimationFrame(tickTimer);
  }

  // ─── Floating Text ───
  function showFloatingText(element, text, type) {
    const rect = element.getBoundingClientRect();
    const float = document.createElement("div");
    float.className = `floating-text ${type}`;
    float.textContent = text;
    float.style.left = rect.left + rect.width / 2 - 20 + "px";
    float.style.top = rect.top + "px";
    document.body.appendChild(float);
    setTimeout(() => float.remove(), 800);
  }

  // ─── Grid Builder ───
  function buildGrid() {
    const level = LEVELS[state.currentLevel];
    const container = DOM.gridContainer;
    container.innerHTML = "";
    container.className = `grid-container grid-${level.gridSize}`;

    const numbers = shuffleArray(
      Array.from({ length: level.count }, (_, i) => i + 1),
    );

    numbers.forEach((num) => {
      const tile = document.createElement("button");
      tile.className = "tile future";
      tile.dataset.number = num;
      tile.setAttribute("aria-label", `Number ${num}`);

      const span = document.createElement("span");
      span.className = "tile-number";
      span.textContent = num;
      tile.appendChild(span);

      // Add elite/pro effects
      if (state.currentLevel === 3) {
        tile.classList.add("elite-flicker");
        tile.style.animationDelay = `${Math.random() * 3}s`;
      } else if (state.currentLevel === 2) {
        if (Math.random() < 0.3) {
          tile.classList.add("color-distract");
          tile.style.animationDelay = `${Math.random() * 4}s`;
        }
      } else if (state.currentLevel === 4) {
        // Omega effect
        tile.style.animationDelay = `${Math.random() * 2}s`;
      }

      tile.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handleTileTap(tile, num);
      });

      container.appendChild(tile);
    });

    updateTileStates();
  }

  // ─── Grid Shuffle (Omega Mode) ───
  function shuffleGrid() {
    const container = DOM.gridContainer;
    container.classList.add("shifting");
    
    // Play shift sound
    playTone(150, 0.3, "sawtooth", 0.08);
    setTimeout(() => playTone(1200, 0.1, "sine", 0.05), 100);

    setTimeout(() => {
      const tiles = Array.from(container.children);
      // Only shuffle uncompleted tiles logic could go here, but for chaos
      // let's shuffle physically all tiles but keep their state visually
      
      // Shuffle DOM order
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        container.appendChild(tiles[j]);
      }
      
      container.classList.remove("shifting");
    }, 200);
  }

  // ─── Tile State Updates ───
  function updateTileStates() {
    const tiles = DOM.gridContainer.querySelectorAll(".tile");
    tiles.forEach((tile) => {
      const num = parseInt(tile.dataset.number);
      tile.classList.remove("next-target", "future", "completed");

      if (num < state.nextNumber) {
        tile.classList.add("completed");
      } else if (num === state.nextNumber) {
        tile.classList.add("next-target");
      } else {
        tile.classList.add("future");
      }
    });

    DOM.hudNext.textContent = state.nextNumber;
  }

  // ─── Tile Tap Handler ───
  function handleTileTap(tile, number) {
    if (!state.gameActive) return;

    initAudio();

    // Start timer on first tap
    if (!state.timerRunning && number === 1) {
      startTimer();
    }

    if (number === state.nextNumber) {
      // Correct tap
      hapticLight();
      playCorrectSound();

      state.combo++;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;

      // Correct flash before transition
      tile.classList.add("correct-flash");
      setTimeout(() => tile.classList.remove("correct-flash"), 250);

      state.nextNumber++;

      // Combo display
      DOM.hudCombo.textContent = `×${state.combo}`;
      if (state.combo >= 3) {
        DOM.hudCombo.classList.add("active");
        showFloatingText(tile, `×${state.combo}`, "combo");
        setTimeout(() => DOM.hudCombo.classList.remove("active"), 300);
      }
      DOM.hudCombo.classList.add("combo-pop");
      setTimeout(() => DOM.hudCombo.classList.remove("combo-pop"), 300);

      updateTileStates();

      const level = LEVELS[state.currentLevel];

      // Check completion
      if (state.nextNumber > level.count) {
        gameComplete();
      } else if (state.currentLevel === 4 && (state.nextNumber - 1) % 6 === 0) {
        // Omega Shift Mechanic: Shuffle every 6 taps
        shuffleGrid();
      }
    } else if (number >= state.nextNumber) {
      // Wrong tap
      hapticMedium();
      playWrongSound();

      state.combo = 0;
      DOM.hudCombo.textContent = "×0";

      const level = LEVELS[state.currentLevel];
      state.penaltyCount++;
      state.penaltyTime += level.penalty;

      DOM.hudPenalty.textContent = `+${state.penaltyTime.toFixed(1)}s`;
      DOM.hudPenalty.classList.add("penalty-flash");
      setTimeout(() => DOM.hudPenalty.classList.remove("penalty-flash"), 400);

      showFloatingText(tile, `+${level.penalty.toFixed(1)}s`, "penalty");

      tile.classList.add("wrong");
      setTimeout(() => tile.classList.remove("wrong"), 400);
    }
  }

  // ─── Game States ───
  function startGame() {
    initAudio();

    state.nextNumber = 1;
    state.timerRunning = false;
    state.startTime = 0;
    state.elapsed = 0;
    state.penalties = 0;
    state.penaltyTime = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.penaltyCount = 0;
    state.gameActive = true;

    const level = LEVELS[state.currentLevel];
    DOM.hudLevel.textContent = level.name;

    const bests = getBestTimes();
    DOM.hudBest.textContent = formatBestTime(bests[state.currentLevel]);

    DOM.hudTimer.textContent =
      level.timeLimit > 0 ? formatTime(level.timeLimit) : "0.00";
    DOM.hudTimer.classList.remove("warning", "critical");
    DOM.timerLabel.textContent = level.timeLimit > 0 ? "REMAINING" : "TIME";
    DOM.hudCombo.textContent = "×0";
    DOM.hudNext.textContent = "1";
    DOM.hudPenalty.textContent = "+0.0s";

    buildGrid();
    showScreen(DOM.gameScreen);
  }

  function gameComplete() {
    state.gameActive = false;
    stopTimer();

    hapticHeavy();
    playCompleteSound();

    // Sweep animation
    DOM.gridSweep.classList.remove("active");
    void DOM.gridSweep.offsetWidth; // reflow
    DOM.gridSweep.classList.add("active");

    // Particles
    spawnCompletionParticles();
    updateParticles();
    // Keep particle animation running for a bit
    let particleFrames = 0;
    function animateParticles() {
      updateParticles();
      particleFrames++;
      if (particleFrames < 120 && particles.length > 0) {
        requestAnimationFrame(animateParticles);
      }
    }
    requestAnimationFrame(animateParticles);

    const finalTime = state.elapsed;
    const isNewBest = setBestTime(state.currentLevel, finalTime);

    setTimeout(() => showGameOver(true, finalTime, isNewBest), 600);
  }

  function gameOver(success) {
    state.gameActive = false;
    stopTimer();

    if (!success) {
      hapticHeavy();
      playGameOverSound();
      const level = LEVELS[state.currentLevel];
      showGameOver(false, level.timeLimit, false);
    }
  }

  function showGameOver(success, time, isNewBest) {
    // Title
    DOM.gameoverTitle.textContent = success
      ? "SEQUENCE COMPLETE"
      : "TIME EXPIRED";
    DOM.gameoverTitle.className =
      "gameover-title " + (success ? "success" : "failure");

    // Time
    DOM.gameoverTime.textContent = formatTime(time) + "s";
    DOM.gameoverTime.className =
      "gameover-time" + (success ? "" : " failure-time");

    // Rank
    if (success) {
      const rank = getRank(time);
      DOM.rankBadge.className = "rank-badge " + rank.cssClass;
      DOM.rankText.textContent = rank.name;
      DOM.rankSub.textContent = rank.sub;
      DOM.rankReveal.style.display = "block";

      if (isNewBest) {
        const newBestEl = document.createElement("span");
        newBestEl.className = "new-best";
        newBestEl.textContent = "★ NEW BEST TIME ★";
        DOM.rankSub.after(newBestEl);
      }
    } else {
      DOM.rankReveal.style.display = "none";
    }

    // Stats
    DOM.statCombo.textContent = `×${state.maxCombo}`;
    DOM.statPenalties.textContent = state.penaltyCount;
    DOM.statPenaltyTime.textContent = `+${state.penaltyTime.toFixed(1)}s`;

    // Reset animations
    DOM.rankReveal.style.animation = "none";
    DOM.gameoverStats.style.animation = "none";
    void DOM.rankReveal.offsetWidth;
    DOM.rankReveal.style.animation = "";
    DOM.gameoverStats.style.animation = "";

    const actionsEl = document.querySelector(".gameover-actions");
    if (actionsEl) {
      actionsEl.style.animation = "none";
      void actionsEl.offsetWidth;
      actionsEl.style.animation = "";
    }

    showScreen(DOM.gameOverScreen);
  }

  function getRank(time) {
    for (const rank of RANKS) {
      if (time < rank.threshold) return rank;
    }
    return RANKS[RANKS.length - 1];
  }

  // ─── UI Updates ───
  function updateBestTimesDisplay() {
    const bests = getBestTimes();
    for (let i = 1; i <= 4; i++) {
      if (DOM.bestTimes[i]) {
        DOM.bestTimes[i].textContent = formatBestTime(bests[i]);
      }
    }
  }

  function updateSoundButton() {
    const btn = DOM.soundToggleBtn;
    btn.classList.toggle("sound-enabled", state.soundEnabled);
    btn.classList.toggle("sound-disabled", !state.soundEnabled);
  }

  function selectLevel(level) {
    state.currentLevel = level;
    DOM.levelBtns.forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.level) === level);
    });
    // Persist selection
    const bests = getBestTimes();
    saveData(bests);
  }

  function goToStart() {
    stopTimer();
    state.gameActive = false;
    particles.length = 0; // Clear particles

    // Remove any leftover floating text or new-best elements
    document
      .querySelectorAll(".floating-text, .new-best")
      .forEach((el) => el.remove());

    updateBestTimesDisplay();
    selectLevel(state.currentLevel);
    showScreen(DOM.startScreen);
  }

  // ─── Event Listeners ───
  function initEvents() {
    // Level selection
    DOM.levelBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        playClickSound();
        hapticLight();
        selectLevel(parseInt(btn.dataset.level));
      });
    });

    // Play
    DOM.playBtn.addEventListener("click", () => {
      playClickSound();
      hapticLight();
      startGame();
    });

    // Restart
    DOM.restartBtn.addEventListener("click", () => {
      playClickSound();
      hapticLight();
      startGame();
    });

    // Change level from game
    DOM.changeLevelBtn.addEventListener("click", () => {
      playClickSound();
      hapticLight();
      goToStart();
    });

    // Sound toggle
    DOM.soundToggleBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      updateSoundButton();
      if (state.soundEnabled) playClickSound();
      hapticLight();
      const bests = getBestTimes();
      saveData(bests);
    });

    // Play again
    DOM.playAgainBtn.addEventListener("click", () => {
      playClickSound();
      hapticLight();
      startGame();
    });

    // Change level from game over
    DOM.gameoverLevelBtn.addEventListener("click", () => {
      playClickSound();
      hapticLight();
      goToStart();
    });

    // Resize handler
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (DOM.particlesCanvas) {
          DOM.particlesCanvas.width = window.innerWidth;
          DOM.particlesCanvas.height = window.innerHeight;
        }
      }, 150);
    });

    // Prevent context menu on long press
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".tile")) {
        e.preventDefault();
      }
    });

    // Prevent double-tap zoom on iOS
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false },
    );
  }

  // ─── Ambient Background Animation ───
  function initAmbientParticles() {
    if (!particleCtx) return;
    // Spawn a few ambient particles on the background
    function spawnAmbient() {
      if (particles.length < 15) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.2 - Math.random() * 0.3,
          life: 1,
          decay: 0.003 + Math.random() * 0.004,
          size: 1 + Math.random() * 1.5,
          color: ["#00d4ff", "#ff2d95", "#a855f7", "#22d3ee"][
            Math.floor(Math.random() * 4)
          ],
        });
      }
    }

    function ambientLoop() {
      spawnAmbient();
      updateParticles();
      if (!state.timerRunning) {
        requestAnimationFrame(ambientLoop);
      }
    }

    // Only run ambient when not in game
    setInterval(() => {
      if (!state.timerRunning && !state.gameActive) {
        requestAnimationFrame(ambientLoop);
      }
    }, 2000);

    ambientLoop();
  }

  // ─── Initialize ───
  function init() {
    // Load saved data
    loadInitialState();

    // Setup UI
    updateBestTimesDisplay();
    selectLevel(state.currentLevel);
    updateSoundButton();

    // Init systems
    initParticles();
    initEvents();
    initAmbientParticles();

    // Show start screen
    showScreen(DOM.startScreen);
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
