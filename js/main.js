// Main application file
let audioManager;
let gameLogic;
let visualizer;
let uiControls;
let canvas;

function setup() {
    // Create canvas that fills its container
    canvas = createCanvas(800, 600);
    canvas.parent('gameOfLife');
    
    // Make canvas responsive
    windowResized();
    
    // Initialize all components
    audioManager = new AudioManager();
    
    const cols = floor(width / 4); // Default cell size
    const rows = floor(height / 4);
    gameLogic = new GameLogic(cols, rows);
    
    visualizer = new Visualizer(gameLogic, audioManager);
    uiControls = new UIControls(audioManager, gameLogic, visualizer);
    
    // Randomize initial state
    gameLogic.randomizeGrid();
    
    // Set frame rate for better performance
    frameRate(60);
    
    // Pre-calculate some values for performance
    visualizer.preCalculateColors();
}

function draw() {
    // Only update when necessary
    if (!audioManager.isPlaying && frameCount % 30 !== 0) {
        return; // Skip unnecessary frames when not playing
    }
    
    // Handle trail effect more efficiently
    if (visualizer.showTrails) {
        fill('#18181B10'); // Slightly more opaque for better trails
        noStroke();
        rect(0, 0, width, height);
    } else {
        background('#18181B'); // Solid background
    }
    
    // Analyze audio only when playing
    if (audioManager.isPlaying) {
        audioManager.analyzeAudio();
    }
    
    // Draw the game grid
    visualizer.drawGrid();
    
    // Update game logic less frequently for better performance
    if (audioManager.isPlaying && frameCount % 5 === 0) {
        gameLogic.updateGrid(audioManager);
    }
    
    // Update UI elements less frequently
    if (frameCount % 10 === 0) {
        visualizer.updateFrequencyBars();
        uiControls.updateStats();
    }
}

function windowResized() {
    const container = document.getElementById('gameOfLife');
    if (container) {
        const isFullscreen = document.fullscreenElement === container;
        const containerWidth = isFullscreen ? window.innerWidth : container.offsetWidth;
        const containerHeight = isFullscreen ? window.innerHeight : Math.min(600, window.innerHeight * 0.6);

        resizeCanvas(containerWidth, containerHeight);

        // Update grid dimensions when canvas resizes
        if (visualizer) {
            const cols = floor(width / visualizer.cellSize);
            const rows = floor(height / visualizer.cellSize);
            gameLogic.resizeGrid(cols, rows);
        }
    }
}

// Global p5.js event handlers
function mousePressed() {
    uiControls.handleMouseClick(mouseX, mouseY);
}

function mouseDragged() {
    uiControls.handleMouseDrag(mouseX, mouseY);
}

function keyPressed() {
    uiControls.handleKeyPress(key);
}
