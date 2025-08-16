// Game Logic - Handles Conway's Game of Life rules and grid management
class GameLogic {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = this.make2DArray(cols, rows);
        this.generation = 0;
        this.population = 0;
        this.currentGenre = 'adaptive';
        
        // Genre presets
        this.genrePresets = {
            adaptive: {
                bassMultiplier: 1.0,
                midMultiplier: 1.0,
                highMultiplier: 1.0,
                mutationRate: 0.01,
                birthThreshold: 0.3
            },
            electronic: {
                bassMultiplier: 1.5,
                midMultiplier: 1.2,
                highMultiplier: 1.8,
                mutationRate: 0.02,
                birthThreshold: 0.25
            },
            classical: {
                bassMultiplier: 0.8,
                midMultiplier: 1.4,
                highMultiplier: 1.0,
                mutationRate: 0.005,
                birthThreshold: 0.35
            },
            rock: {
                bassMultiplier: 1.3,
                midMultiplier: 1.1,
                highMultiplier: 1.2,
                mutationRate: 0.015,
                birthThreshold: 0.3
            },
            jazz: {
                bassMultiplier: 1.0,
                midMultiplier: 1.3,
                highMultiplier: 1.1,
                mutationRate: 0.01,
                birthThreshold: 0.32
            },
            ambient: {
                bassMultiplier: 0.9,
                midMultiplier: 0.8,
                highMultiplier: 1.4,
                mutationRate: 0.008,
                birthThreshold: 0.28
            }
        };
    }
    
    make2DArray(cols, rows) {
        let arr = new Array(cols);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = new Array(rows);
            for (let j = 0; j < arr[i].length; j++) {
                arr[i][j] = 0;
            }
        }
        return arr;
    }
    
    updateGrid(audioManager) {
        let next = this.make2DArray(this.cols, this.rows);
        const preset = this.genrePresets[this.currentGenre];
        
        // Apply genre modifiers to audio levels
        const bassLevel = audioManager.bassLevel * preset.bassMultiplier;
        const midLevel = audioManager.midLevel * preset.midMultiplier;
        const highLevel = audioManager.highLevel * preset.highMultiplier;
        
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                let neighbors = this.countNeighbors(this.grid, i, j);
                let state = this.grid[i][j];
                
                // Audio-reactive rules
                let survivalMin = 2;
                let survivalMax = 3;
                let birthCount = 3;
                
                // Mid frequencies affect survival rules
                if (midLevel > 0.3) {
                    survivalMin = 2 - floor(midLevel * 2);
                    survivalMax = 3 + floor(midLevel * 2);
                    survivalMin = max(survivalMin, 1);
                    survivalMax = min(survivalMax, 8);
                }
                
                // Bass frequencies increase birth rate
                if (bassLevel > preset.birthThreshold) {
                    birthCount = 3 - floor(bassLevel * 2);
                    birthCount = max(birthCount, 1);
                }
                
                // Apply Conway's rules with audio modifications
                if (state === 1) {
                    if (neighbors < survivalMin || neighbors > survivalMax) {
                        next[i][j] = 0; // Cell dies
                    } else {
                        next[i][j] = 1; // Cell survives
                    }
                } else {
                    if (neighbors === birthCount) {
                        next[i][j] = 1; // Cell is born
                    }
                }
                
                // High frequencies create mutations
                if (highLevel > 0.4 && random() < preset.mutationRate * highLevel) {
                    next[i][j] = 1 - next[i][j]; // Flip state
                }
                
                // Random births based on bass level
                if (bassLevel > 0.6 && random() < bassLevel * 0.02) {
                    next[i][j] = 1;
                }
            }
        }
        
        this.grid = next;
        this.generation++;
    }
    
    countNeighbors(grid, x, y) {
        let sum = 0;
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                let col = (x + i + this.cols) % this.cols;
                let row = (y + j + this.rows) % this.rows;
                sum += grid[col][row];
            }
        }
        sum -= grid[x][y];
        return sum;
    }
    
    randomizeGrid() {
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j] = random() > 0.8 ? 1 : 0;
            }
        }
        this.generation = 0;
    }
    
    clearGrid() {
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j] = 0;
            }
        }
        this.generation = 0;
    }
    
    toggleCell(x, y) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.grid[x][y] = 1 - this.grid[x][y];
        }
    }

    // Set the state of a cell directly (used for drawing/erasing)
    setCellState(x, y, state) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.grid[x][y] = state;
        }
    }
    
    setGenre(genre) {
        this.currentGenre = genre;
    }
    
    resizeGrid(newCols, newRows) {
        let newGrid = this.make2DArray(newCols, newRows);

        // Copy existing cells and randomize new ones
        for (let i = 0; i < newCols; i++) {
            for (let j = 0; j < newRows; j++) {
                if (i < this.cols && j < this.rows) {
                    newGrid[i][j] = this.grid[i][j];
                } else {
                    newGrid[i][j] = random() > 0.8 ? 1 : 0;
                }
            }
        }

        this.cols = newCols;
        this.rows = newRows;
        this.grid = newGrid;
    }
}
