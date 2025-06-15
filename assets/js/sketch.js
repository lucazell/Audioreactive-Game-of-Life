const game = p => {
  const cellSize = 10;
  let cols, rows;
  let grid = [];
  let running = false;
  let generation = 0;
  let audioIn, amp;

  p.setup = () => {
    const canvas = p.createCanvas(901, 433);
    canvas.parent('p5-holder');

    cols = Math.floor(p.width / cellSize);
    rows = Math.floor(p.height / cellSize);
    grid = makeGrid(cols, rows);

    audioIn = new p5.AudioIn();
    audioIn.start();
    amp = new p5.Amplitude();
    amp.setInput(audioIn);

    p.noStroke();
    p.select('#buttonRun').mousePressed(toggleRun);
    p.select('#buttonStep').mousePressed(stepOnce);
    p.select('#buttonClear').mousePressed(clearGrid);
  };

  p.draw = () => {
    p.background(0);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        p.fill(grid[i][j] ? 'lime' : '#1e1e1e');
        p.rect(i * cellSize, j * cellSize, cellSize, cellSize);
      }
    }

    if (running) stepOnce();

    if (amp.getLevel() > 0.1) {
      for (let k = 0; k < 5; k++) {
        const x = p.floor(p.random(cols));
        const y = p.floor(p.random(rows));
        grid[x][y] = 1;
      }
    }

    updateStats();
  };

  p.mouseDragged = () => {
    const i = p.floor(p.mouseX / cellSize);
    const j = p.floor(p.mouseY / cellSize);
    if (i >= 0 && i < cols && j >= 0 && j < rows) grid[i][j] = 1;
  };

  const makeGrid = (c, r) => Array.from({ length: c }, () => Array(r).fill(0));

  const stepOnce = () => {
    const next = makeGrid(cols, rows);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const state = grid[i][j];
        const sum = countNeighbors(i, j);
        next[i][j] = state === 0 && sum === 3 ? 1 :
          (state === 1 && (sum < 2 || sum > 3) ? 0 : state);
      }
    }
    grid = next;
    generation++;
  };

  const countNeighbors = (x, y) => {
    let sum = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const col = (x + i + cols) % cols;
        const row = (y + j + rows) % rows;
        sum += grid[col][row];
      }
    }
    return sum - grid[x][y];
  };

  const toggleRun = () => {
    running = !running;
    p.select('#buttonRun').html(running ? 'Stop' : 'Run');
  };

  const clearGrid = () => {
    grid = makeGrid(cols, rows);
    generation = 0;
  };

  const updateStats = () => {
    let live = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j]) live++;
      }
    }
    p.select('#generation').html(generation);
    p.select('#livecells').html(live);
  };
};

new p5(game);
