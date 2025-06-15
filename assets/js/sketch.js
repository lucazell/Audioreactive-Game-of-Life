const game = p => {
  const cellSize = 10;
  let cols, rows;
  let grid = [];
  let running = false;
  let generation = 0;
  let fft, amp, audioSource;
  let hue = 120;

  p.setup = () => {
    const canvas = p.createCanvas(Math.min(900, p.windowWidth * 0.9), Math.min(440, p.windowHeight * 0.6));
    canvas.parent('p5-holder');

    cols = Math.floor(p.width / cellSize);
    rows = Math.floor(p.height / cellSize);
    grid = makeGrid(cols, rows);

    amp = new p5.Amplitude();
    fft = new p5.FFT();

    const mic = new p5.AudioIn();
    mic.start(() => setAudioSource(mic));

    p.noStroke();
    p.select('#buttonRun').mousePressed(toggleRun);
    p.select('#buttonStep').mousePressed(stepOnce);
    p.select('#buttonClear').mousePressed(clearGrid);
    p.select('#buttonExport').mousePressed(() => p.saveCanvas('life', 'png'));
    p.select('#audioFile').elt.addEventListener('change', handleFile);
  };

  p.draw = () => {
    p.background(0);
    reactToSound();

    const aliveColor = p.color(`hsl(${hue}, 80%, 60%)`);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        p.fill(grid[i][j] ? aliveColor : '#1e1e1e');
        p.rect(i * cellSize, j * cellSize, cellSize, cellSize);
      }
    }

    if (running) stepOnce();
    updateStats();
  };

  p.mouseDragged = () => {
    const i = p.floor(p.mouseX / cellSize);
    const j = p.floor(p.mouseY / cellSize);
    if (i >= 0 && i < cols && j >= 0 && j < rows) grid[i][j] = 1;
  };

  p.windowResized = () => {
    const w = Math.min(900, p.windowWidth * 0.9);
    const h = Math.min(440, p.windowHeight * 0.6);
    p.resizeCanvas(w, h);
    cols = Math.floor(p.width / cellSize);
    rows = Math.floor(p.height / cellSize);
    grid = makeGrid(cols, rows);
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

  const reactToSound = () => {
    if (!audioSource) return;
    const level = amp.getLevel();
    const bass = fft.getEnergy('bass');
    const mid = fft.getEnergy('mid');
    const treble = fft.getEnergy('treble');

    if (level > 0.1) spawnRandom(3);
    if (bass > 170) spawnRandom(10);
    if (mid > 170) spawnRandom(5);
    if (treble > 170) killRandom(5);

    hue = (bass + treble) % 360;
  };

  const spawnRandom = n => {
    for (let i = 0; i < n; i++) {
      const x = p.floor(p.random(cols));
      const y = p.floor(p.random(rows));
      grid[x][y] = 1;
    }
  };

  const killRandom = n => {
    for (let i = 0; i < n; i++) {
      const x = p.floor(p.random(cols));
      const y = p.floor(p.random(rows));
      grid[x][y] = 0;
    }
  };

  function handleFile(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const sound = p.loadSound(URL.createObjectURL(file), () => {
      if (audioSource && audioSource.stop) audioSource.stop();
      setAudioSource(sound);
      sound.loop();
    });
  }

  function setAudioSource(src) {
    audioSource = src;
    amp.setInput(src);
    fft.setInput(src);
  }
};

new p5(game);
