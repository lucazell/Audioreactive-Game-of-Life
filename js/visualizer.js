// Visualizer - Handles all visual rendering with performance optimizations
class Visualizer {
    constructor(gameLogic, audioManager) {
        this.gameLogic = gameLogic;
        this.audioManager = audioManager;
        this.cellSize = 4;
        this.showGrid = true;
        this.showTrails = true;
        this.colorMode = true;
        
        // Performance optimizations
        this.colorCache = new Map();
        this.lastGridUpdate = 0;
        this.gridNeedsRedraw = true;
        
        // Pre-calculated colors for better performance
        this.baseColors = {
            r: 100,
            g: 100,
            b: 100
        };
    }
    
    preCalculateColors() {
        // Pre-calculate some common color combinations
        this.colorCache.clear();
        for (let i = 0; i < 10; i++) {
            const key = `${i}_${i}_${i}`;
            this.colorCache.set(key, color(100 + i * 15, 100 + i * 15, 100 + i * 15));
        }
    }
    
    drawGrid() {
        this.gameLogic.population = 0;
        
        // Only draw grid lines if enabled and not too many cells
        if (this.showGrid && this.cellSize > 2) {
            stroke(50, 50, 70, 80);
            strokeWeight(0.3);
            
            // Draw fewer grid lines for performance
            const gridSpacing = Math.max(1, floor(8 / this.cellSize));
            
            // Vertical lines
            for (let i = 0; i <= this.gameLogic.cols; i += gridSpacing) {
                line(i * this.cellSize, 0, i * this.cellSize, height);
            }
            
            // Horizontal lines
            for (let j = 0; j <= this.gameLogic.rows; j += gridSpacing) {
                line(0, j * this.cellSize, width, j * this.cellSize);
            }
        }
        
        // Optimize cell drawing
        noStroke();
        
        // Batch similar operations
        const aliveCells = [];
        for (let i = 0; i < this.gameLogic.cols; i++) {
            for (let j = 0; j < this.gameLogic.rows; j++) {
                if (this.gameLogic.grid[i][j] === 1) {
                    this.gameLogic.population++;
                    aliveCells.push({x: i * this.cellSize, y: j * this.cellSize, i, j});
                }
            }
        }
        
        // Draw all alive cells
        this.drawCells(aliveCells);
    }
    
    drawCells(cells) {
        if (this.colorMode) {
            // Calculate colors once per frame
            const bassLevel = this.audioManager.bassLevel || 0;
            const midLevel = this.audioManager.midLevel || 0;
            const highLevel = this.audioManager.highLevel || 0;
            
            const baseR = map(bassLevel, 0, 1, 100, 255);
            const baseG = map(midLevel, 0, 1, 100, 255);
            const baseB = map(highLevel, 0, 1, 100, 255);
            
            // Draw cells with optimized coloring
            cells.forEach(cell => {
                // Simplified color variation
                const r = baseR + sin(frameCount * 0.02 + cell.i * 0.2) * 20;
                const g = baseG + cos(frameCount * 0.02 + cell.j * 0.2) * 20;
                const b = baseB + sin(frameCount * 0.02 + (cell.i + cell.j) * 0.2) * 20;
                
                fill(r, g, b, 220);
                
                // Only add glow for very high audio levels to improve performance
                const highAudioLevel = bassLevel > 0.7 || midLevel > 0.7 || highLevel > 0.7;
                if (highAudioLevel && this.cellSize > 3) {
                    // Simplified glow effect
                    fill(r, g, b, 80);
                    rect(cell.x - 1, cell.y - 1, this.cellSize + 2, this.cellSize + 2);
                    fill(r, g, b, 220);
                }
                
                rect(cell.x, cell.y, this.cellSize, this.cellSize);
            });
        } else {
            // Monochrome mode - much faster
            fill(255, 255, 255, 200);
            cells.forEach(cell => {
                rect(cell.x, cell.y, this.cellSize, this.cellSize);
            });
        }
    }
    
    updateFrequencyBars() {
        // Use requestAnimationFrame for smoother updates
        const bassBar = document.getElementById('bassBar');
        const midBar = document.getElementById('midBar');
        const highBar = document.getElementById('highBar');
        
        if (bassBar && midBar && highBar) {
            const bassHeight = (this.audioManager.bassLevel * 100) + '%';
            const midHeight = (this.audioManager.midLevel * 100) + '%';
            const highHeight = (this.audioManager.highLevel * 100) + '%';
            
            bassBar.style.height = bassHeight;
            midBar.style.height = midHeight;
            highBar.style.height = highHeight;
        }
    }
    
    setCellSize(newSize) {
        this.cellSize = newSize;
        
        // Recalculate grid dimensions
        const newCols = floor(width / this.cellSize);
        const newRows = floor(height / this.cellSize);
        
        this.gameLogic.resizeGrid(newCols, newRows);
        this.preCalculateColors(); // Recalculate colors for new size
    }
    
    setShowGrid(show) {
        this.showGrid = show;
    }
    
    setShowTrails(show) {
        this.showTrails = show;
    }
    
    setColorMode(enabled) {
        this.colorMode = enabled;
        if (!enabled) {
            // Clear color cache when switching to monochrome
            this.colorCache.clear();
        }
    }
}