// p5.js Game of Life with audio reactivity
let cellSize = 10;
let cols, rows;
let grid;
let running = false;
let generation = 0;
let audioIn, amplitude;

function setup() {
  const canvas = createCanvas(901, 433);
  canvas.parent('p5-holder');

  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  grid = make2DArray(cols, rows);

  audioIn = new p5.AudioIn();
  audioIn.start();
  amplitude = new p5.Amplitude();
  amplitude.setInput(audioIn);

  noStroke();
  fill(0);

  select('#buttonRun').mousePressed(toggleRun);
  select('#buttonStep').mousePressed(stepOnce);
  select('#buttonClear').mousePressed(clearGrid);
}

function draw() {
  background(0);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j]) fill(0, 255, 0);
      else fill(30);
      rect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }

  if (running) {
    stepOnce();
  }

  let level = amplitude.getLevel();
  if (level > 0.1) {
    for (let k = 0; k < 5; k++) {
      let x = floor(random(cols));
      let y = floor(random(rows));
      grid[x][y] = 1;
    }
  }

  updateStats();
}

function mouseDragged() {
  let i = floor(mouseX / cellSize);
  let j = floor(mouseY / cellSize);
  if (i >= 0 && i < cols && j >= 0 && j < rows) {
    grid[i][j] = 1;
  }
}

function make2DArray(c, r) {
  let arr = new Array(c);
  for (let i = 0; i < c; i++) {
    arr[i] = new Array(r).fill(0);
  }
  return arr;
}

function stepOnce() {
  let next = make2DArray(cols, rows);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let state = grid[i][j];
      let sum = countNeighbors(grid, i, j);
      if (state === 0 && sum === 3) {
        next[i][j] = 1;
      } else if (state === 1 && (sum < 2 || sum > 3)) {
        next[i][j] = 0;
      } else {
        next[i][j] = state;
      }
    }
  }
  grid = next;
  generation++;
}

function countNeighbors(arr, x, y) {
  let sum = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      let col = (x + i + cols) % cols;
      let row = (y + j + rows) % rows;
      sum += arr[col][row];
    }
  }
  sum -= arr[x][y];
  return sum;
}

function toggleRun() {
  running = !running;
  select('#buttonRun').value(running ? 'Stop' : 'Run');
}

function clearGrid() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      grid[i][j] = 0;
    }
  }
  generation = 0;
}

function updateStats() {
  let live = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j]) live++;
    }
  }
  select('#generation').html(generation);
  select('#livecells').html(live);
}

