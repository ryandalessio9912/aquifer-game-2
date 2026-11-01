
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("level");
const collectedText = document.getElementById("collected");
const message = document.getElementById("message");

const startBtn = document.getElementById("startBtn");
const releaseBtn = document.getElementById("releaseBtn");
const restartBtn = document.getElementById("restartBtn");
const nextBtn = document.getElementById("nextBtn");

const SIZE = 10;
const COLS = 40;
const ROWS = 56;
const GOAL = 70;
const MAX_LEVEL = 3;

const SOURCE = { x: 17, y: 0, w: 6, h: 5 };
const TANK = { x: 15, y: 51, w: 10, h: 5 };

let level = 1;
let grid = [];
let particles = [];
let rocks = [];
let digging = false;
let started = false;
let released = false;
let finished = false;
let collected = 0;
let lost = 0;
let emitted = 0;
let frame = 0;
let animationId = null;

const TOTAL_WATER = 100;

// Different rock layouts for each level.
const levelRocks = [
  [
    [9, 16, 3],
    [29, 17, 3],
    [19, 27, 4],
    [8, 37, 3],
    [31, 39, 3]
  ],
  [
    [8, 14, 4],
    [28, 14, 4],
    [19, 23, 4],
    [9, 33, 4],
    [29, 35, 4],
    [20, 44, 3]
  ],
  [
    [10, 12, 4],
    [28, 12, 4],
    [19, 21, 5],
    [7, 30, 4],
    [32, 31, 4],
    [19, 40, 4],
    [9, 46, 3],
    [30, 46, 3]
  ]
];

function isSource(x, y) {
  return x >= SOURCE.x && x < SOURCE.x + SOURCE.w &&
         y >= SOURCE.y && y < SOURCE.y + SOURCE.h;
}

function isTank(x, y) {
  return x >= TANK.x && x < TANK.x + TANK.w &&
         y >= TANK.y && y < TANK.y + TANK.h;
}

function inside(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
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

  particles = [];
  rocks = levelRocks[level - 1];

  collected = 0;
  lost = 0;
  emitted = 0;
  frame = 0;

  started = false;
  released = false;
  finished = false;
  digging = false;

  // Create the open area above the dirt.
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < COLS; x++) {
      grid[y][x] = 0;
    }
  }

  // Make the tank area empty.
  for (let y = TANK.y; y < ROWS; y++) {
    for (let x = TANK.x; x < TANK.x + TANK.w; x++) {
      grid[y][x] = 0;
    }
  }

  // Place rocks.
  for (const [rx, ry, radius] of rocks) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const distance = Math.hypot(x - rx, y - ry);

        if (distance <= radius) {
          grid[y][x] = 2;
        }
      }
    }
  }

  levelText.textContent = level;
  collectedText.textContent = "0%";

  message.textContent = "Press Start Game to begin!";
  startBtn.disabled = false;
  releaseBtn.disabled = true;
  nextBtn.hidden = true;

  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sky/background.
  ctx.fillStyle = "#9bdcf4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dirt and rocks.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 1) {
        ctx.fillStyle = "#795038";
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      }

      if (grid[y][x] === 2) {
        ctx.fillStyle = "#666666";
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      }
    }
  }

  // Grass line.
  ctx.fillStyle = "#438d45";
  ctx.fillRect(0, 60, canvas.width, 5);

  // Water source.
  ctx.fillStyle = "#303b42";
  ctx.fillRect(
    SOURCE.x * SIZE,
    5,
    SOURCE.w * SIZE,
    48
  );

  ctx.fillStyle = "#21a9ec";
  ctx.fillRect(
    SOURCE.x * SIZE + 5,
    15,
    SOURCE.w * SIZE - 10,
    32
  );

  ctx.fillStyle = "white";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("WATER", 200, 12);

  // Collection tank.
  ctx.fillStyle = "#252b30";
  ctx.fillRect(
    TANK.x * SIZE,
    TANK.y * SIZE,
    TANK.w * SIZE,
    TANK.h * SIZE
  );

  const fillHeight = (collected / TOTAL_WATER) *
    TANK.h * SIZE;

  ctx.fillStyle = "#20b6ef";
  ctx.fillRect(
    TANK.x * SIZE + 4,
    (TANK.y + TANK.h) * SIZE - fillHeight,
    TANK.w * SIZE - 8,
    fillHeight
  );

  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.fillText(
    "TANK",
    (TANK.x + TANK.w / 2) * SIZE,
    (TANK.y + 2.5) * SIZE
  );

  // Moving water particles.
  ctx.fillStyle = "#14a9fa";

  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(
      p.x * SIZE + SIZE / 2,
      p.y * SIZE + SIZE / 2,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function dig(x, y) {
  if (!started || released || finished) return;

  // Remove a small circular area of dirt.
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

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();

  const x = (event.clientX - rect.left) *
    (canvas.width / rect.width);

  const y = (event.clientY - rect.top) *
    (canvas.height / rect.height);

  return {
    x: Math.floor(x / SIZE),
    y: Math.floor(y / SIZE)
  };
}

function handleDig(event) {
  const position = pointerPosition(event);
  dig(position.x, position.y);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!started || released) return;

  digging = true;
  canvas.setPointerCapture(event.pointerId);
  handleDig(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (digging) {
    handleDig(event);
  }
});

canvas.addEventListener("pointerup", () => {
  digging = false;
});

canvas.addEventListener("pointercancel", () => {
  digging = false;
});

function canMove(x, y) {
  return inside(x, y) && grid[y][x] === 0;
}

function moveWater() {
  frame++;

  // Release water gradually.
  if (frame % 3 === 0 && emitted < TOTAL_WATER) {
    particles.push({
      x: SOURCE.x + Math.floor(SOURCE.w / 2),
      y: SOURCE.y + SOURCE.h,
      stuck: 0
    });

    emitted++;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Water reaches the tank.
    if (isTank(p.x, p.y)) {
      collected++;
      particles.splice(i, 1);
      continue;
    }

    // Try downward, then diagonal movement.
    const directions = [
      [0, 1],
      [-1, 1],
      [1, 1]
    ];

    let moved = false;

    for (const [dx, dy] of directions) {
      const nx = p.x + dx;
      const ny = p.y + dy;

      if (canMove(nx, ny)) {
        p.x = nx;
        p.y = ny;
        p.stuck = 0;
        moved = true;
        break;
      }
    }

    // If blocked, try moving sideways.
    if (!moved) {
      const sides = Math.random() < 0.5
        ? [-1, 1]
        : [1, -1];

      for (const dx of sides) {
        if (canMove(p.x + dx, p.y)) {
          p.x += dx;
          moved = true;
          p.stuck = 0;
          break;
        }
      }
    }

    if (!moved) {
      p.stuck++;

      if (p.stuck > 35) {
        lost++;
        particles.splice(i, 1);
      }
    }
  }

  collectedText.textContent = collected + "%";

  if (emitted === TOTAL_WATER && particles.length === 0) {
    endLevel();
    return;
  }

  draw();
  animationId = requestAnimationFrame(moveWater);
}

function endLevel() {
  finished = true;
  released = false;
  animationId = null;

  if (collected >= GOAL) {
    if (level < MAX_LEVEL) {
      message.textContent =
        "Level complete! You collected " +
        collected + "% of the water!";

      nextBtn.hidden = false;
    } else {
      message.textContent =
        "Congratulations! You completed Aquifer!";
    }
  } else {
    message.textContent =
      "Not enough water reached the tank. " +
      "You collected " + collected +
      "%. Try again!";
  }

  draw();
}

startBtn.addEventListener("click", () => {
  started = true;
  startBtn.disabled = true;
  releaseBtn.disabled = false;

  message.textContent =
    "Drag through the dirt to create a path. Avoid rocks!";
});

releaseBtn.addEventListener("click", () => {
  if (!started || released || finished) return;

  released = true;
  releaseBtn.disabled = true;

  message.textContent = "Water released!";

  moveWater();
});

restartBtn.addEventListener("click", () => {
  makeLevel();
});

nextBtn.addEventListener("click", () => {
  if (level < MAX_LEVEL) {
    level++;
    makeLevel();
  }
});

// Load the first level.
makeLevel();
