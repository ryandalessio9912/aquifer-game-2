const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("level");
const collectedText = document.getElementById("collected");
const goalText = document.getElementById("goal");
const message = document.getElementById("message");
const progressBar = document.getElementById("progressBar");
const milestoneContainer =
  document.getElementById("milestoneContainer");
const celebration = document.getElementById("celebration");

const difficultySelect =
  document.getElementById("difficulty");

const startBtn = document.getElementById("startBtn");
const releaseBtn = document.getElementById("releaseBtn");
const restartBtn = document.getElementById("restartBtn");
const nextBtn = document.getElementById("nextBtn");

const SIZE = 10;
const COLS = 40;
const ROWS = 56;
const MAX_LEVEL = 3;

const SOURCE = { x: 20, y: 5 };
const TANK = { x: 20, y: 51, w: 10, h: 5 };

const difficultyGoals = {
  easy: 50,
  normal: 70,
  hard: 90
};

const milestones = [
  { value: 25, text: "25% collected! Great start!" },
  { value: 50, text: "Halfway there! Keep going!" },
  { value: 75, text: "75% collected! Almost there!" }
];

const levelRocks = [
  [[9, 16, 3], [29, 17, 3], [19, 27, 4],
   [8, 37, 3], [31, 39, 3]],
  [[8, 14, 4], [28, 14, 4], [19, 23, 4],
   [9, 33, 4], [29, 35, 4], [20, 44, 3]],
  [[10, 12, 4], [28, 12, 4], [19, 21, 5],
   [7, 30, 4], [32, 31, 4], [19, 40, 4]]
];

let level = 1;
let GOAL = 70;
let grid = [];
let started = false;
let released = false;
let finished = false;
let digging = false;
let collected = 0;
let path = [];
let pathIndex = 0;
let delivered = 0;
let deliverable = 0;
let animationId = null;
let shownMilestones = new Set();
let audioContext = null;

function playSound(type) {
  try {
    const AudioClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioClass) return;

    if (!audioContext) {
      audioContext = new AudioClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const sounds = {
      click: [440, 0.08],
      collect: [660, 0.10],
      win: [880, 0.35],
      lose: [220, 0.30]
    };

    const [frequency, duration] = sounds[type];

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(
      0.12, audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001, audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.log("Audio unavailable:", error);
  }
}

function inside(x, y) {
  return x >= 0 && x < COLS &&
         y >= 0 && y < ROWS;
}

function isTank(x, y) {
  return x >= TANK.x - TANK.w / 2 &&
         x < TANK.x + TANK.w / 2 &&
         y >= TANK.y && y < ROWS;
}

function makeLevel() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  grid = Array.from(
    { length: ROWS },
    () => Array(COLS).fill(1)
  );

  // Open the space above the dirt.
  for (let y = 0; y < 6; y++) {
    grid[y].fill(0);
  }

  // Open the collection tank.
  for (let y = TANK.y; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isTank(x, y)) grid[y][x] = 0;
    }
  }

  // Add rocks that cannot be removed.
  for (const [rx, ry, radius] of levelRocks[level - 1]) {
    for (let y = 6; y < TANK.y; y++) {
      for (let x = 0; x < COLS; x++) {
        if (Math.hypot(x - rx, y - ry) <= radius) {
          grid[y][x] = 2;
        }
      }
    }
  }

  started = false;
  released = false;
  finished = false;
  digging = false;

  collected = 0;
  delivered = 0;
  deliverable = 0;
  path = [];
  pathIndex = 0;
  shownMilestones.clear();

  levelText.textContent = level;
  goalText.textContent = GOAL + "%";
  collectedText.textContent = "0%";
  progressBar.style.width = "0%";

  milestoneContainer.replaceChildren();
  celebration.hidden = true;
  nextBtn.hidden = true;

  startBtn.disabled = false;
  releaseBtn.disabled = true;
  difficultySelect.disabled = false;

  message.textContent = "Press Start Game to begin!";

  draw();
}

function draw() {
  ctx.clearRect(0, 0, 400, 560);

  ctx.fillStyle = "#9bdcf4";
  ctx.fillRect(0, 0, 400, 560);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 1) {
        ctx.fillStyle = "#795038";
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      } else if (grid[y][x] === 2) {
        ctx.fillStyle = "#666666";
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      }
    }
  }

  // Grass.
  ctx.fillStyle = "#438d45";
  ctx.fillRect(0, 60, 400, 5);

  // Water source.
  ctx.fillStyle = "#303b42";
  ctx.fillRect(170, 5, 60, 48);

  ctx.fillStyle = "#21a9ec";
  ctx.fillRect(175, 15, 50, 32);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "12px Arial";
  ctx.fillText("WATER", 200, 12);

  // Collection tank.
  ctx.fillStyle = "#252b30";
  ctx.fillRect(150, 510, 100, 50);

  const fillHeight = collected / 100 * 50;

  ctx.fillStyle = "#20b6ef";
  ctx.fillRect(154, 560 - fillHeight, 92, fillHeight);

  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.fillText("TANK", 200, 538);

  // Animated water particle.
  if (released && !finished && path.length > 0) {
    const p = path[Math.min(pathIndex, path.length - 1)];

    ctx.fillStyle = "#00b8ff";
    ctx.beginPath();
    ctx.arc(
      p.x * SIZE + 5,
      p.y * SIZE + 5,
      5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function dig(x, y) {
  if (!started || released || finished) return;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;

      if (!inside(nx, ny)) continue;
      if (Math.hypot(dx, dy) > 2) continue;

      if (grid[ny][nx] === 1) {
        grid[ny][nx] = 0;
      }
    }
  }

  draw();
}

function getPointer(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: Math.floor(
      (event.clientX - rect.left) *
      canvas.width / rect.width / SIZE
    ),
    y: Math.floor(
      (event.clientY - rect.top) *
      canvas.height / rect.height / SIZE
    )
  };
}

function handleDig(event) {
  const p = getPointer(event);
  dig(p.x, p.y);
}

canvas.addEventListener("pointerdown", event => {
  if (!started || released) return;

  digging = true;
  canvas.setPointerCapture(event.pointerId);
  handleDig(event);
});

canvas.addEventListener("pointermove", event => {
  if (digging) handleDig(event);
});

canvas.addEventListener("pointerup", () => {
  digging = false;
});

canvas.addEventListener("pointercancel", () => {
  digging = false;
});

// Find a tunnel from the source to the tank.
function findPath() {
  const queue = [SOURCE];
  const visited = new Set(["20,5"]);
  const parents = new Map();
  let head = 0;

  const directions = [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1]
  ];

  while (head < queue.length) {
    const current = queue[head++];
    const key = `${current.x},${current.y}`;

    if (isTank(current.x, current.y)) {
      const result = [];
      let currentKey = key;

      while (currentKey) {
        const [x, y] = currentKey.split(",").map(Number);
        result.push({ x, y });
        currentKey = parents.get(currentKey);
      }

      return result.reverse();
    }

    for (const [dx, dy] of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nextKey = `${nx},${ny}`;

      if (!inside(nx, ny)) continue;
      if (grid[ny][nx] !== 0) continue;
      if (visited.has(nextKey)) continue;

      visited.add(nextKey);
      parents.set(nextKey, key);
      queue.push({ x: nx, y: ny });
    }
  }

  return [];
}

function addMilestone(text) {
  const element = document.createElement("div");
  element.className = "milestone";
  element.textContent = text;

  milestoneContainer.appendChild(element);
}

function updateScore() {
  collectedText.textContent = collected + "%";
  progressBar.style.width = collected + "%";

  for (const milestone of milestones) {
    if (collected >= milestone.value &&
        !shownMilestones.has(milestone.value)) {

      shownMilestones.add(milestone.value);
      addMilestone(milestone.text);
      playSound("collect");
    }
  }
}

function animateWater() {
  if (finished) return;

  if (pathIndex < path.length - 1) {
    pathIndex++;
  } else {
    // Deliver water in batches after reaching the tank.
    delivered = Math.min(deliverable, delivered + 2);
    collected = delivered;
    updateScore();

    if (delivered >= deliverable) {
      endLevel();
      return;
    }
  }

  draw();
  animationId = requestAnimationFrame(animateWater);
}

function releaseWater() {
  if (!started || released || finished) return;

  playSound("click");
  released = true;
  releaseBtn.disabled = true;
  difficultySelect.disabled = true;

  path = findPath();
  pathIndex = 0;

  if (path.length === 0) {
    message.textContent =
      "No path to the tank! Try digging another tunnel.";
    endLevel();
    return;
  }

  // Longer tunnels lose more water.
  // The shortest straight route is about 47 cells.
  const extraDistance = Math.max(0, path.length - 47);
  deliverable = Math.max(0, 100 - extraDistance * 2);

  message.textContent = "Water is flowing!";
  animateWater();
}

function endLevel() {
  finished = true;
  released = false;
  animationId = null;

  if (collected >= GOAL) {
    playSound("win");

    celebration.hidden = false;

    if (level < MAX_LEVEL) {
      message.textContent =
        "Success! You collected " + collected +
        "% of the water!";
      nextBtn.hidden = false;
    } else {
      message.textContent =
        "Congratulations! You completed Aquifer!";
    }
  } else {
    playSound("lose");

    message.textContent =
      "You collected " + collected +
      "%. You need " + GOAL +
      "% to win. Try again!";
  }

  draw();
}

startBtn.addEventListener("click", () => {
  playSound("click");

  started = true;
  startBtn.disabled = true;
  releaseBtn.disabled = false;
  difficultySelect.disabled = true;

  message.textContent =
    "Drag through the dirt to connect the water to the tank!";
});

releaseBtn.addEventListener("click", releaseWater);

restartBtn.addEventListener("click", () => {
  playSound("click");
  makeLevel();
});

nextBtn.addEventListener("click", () => {
  playSound("click");

  if (level < MAX_LEVEL) {
    level++;
    makeLevel();
  }
});

difficultySelect.addEventListener("change", () => {
  playSound("click");

  GOAL = difficultyGoals[difficultySelect.value];
  level = 1;
  makeLevel();

  message.textContent =
    difficultySelect.value.toUpperCase() +
    " mode selected! Collect " +
    GOAL + "% to win.";
});

makeLevel();
