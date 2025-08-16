// UI Controls - Handles all user interface interactions
class UIControls {
    constructor(audioManager, gameLogic, visualizer) {
        this.audioManager = audioManager;
        this.gameLogic = gameLogic;
        this.visualizer = visualizer;

        // Hinweis-Element referenzieren
        this.uploadHint = document.getElementById('uploadHint');

        // Icons for fullscreen toggle
        this.fullscreenIcon = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>`;
        this.exitFullscreenIcon = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 3 3 3 3 9"></polyline>
                <polyline points="15 21 21 21 21 15"></polyline>
                <line x1="3" y1="3" x2="10" y2="10"></line>
                <line x1="21" y1="21" x2="14" y2="14"></line>
            </svg>`;

        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Audio file input
        const fileInput = document.getElementById('audioFile');
        fileInput.addEventListener('change', (e) => {
            this.handleAudioFile(e);
            this.hideUploadHint();                    // Hinweis ausblenden, wenn Datei gewählt
        });
        
        // Playback controls
        const playBtn = document.getElementById('playPause');
        playBtn.addEventListener('click', () => {
            this.togglePlayback();
            this.hideUploadHint();                    // Hinweis ausblenden, wenn Play gedrückt
        });
        
        // Volume control
        document.getElementById('volume').addEventListener('input', (e) => {
            this.audioManager.setVolume(parseFloat(e.target.value));
        });
        
        // Cell size control
        document.getElementById('cellSize').addEventListener('input', (e) => {
            const cellSize = parseInt(e.target.value);
            document.getElementById('cellSizeValue').textContent = cellSize;
            this.visualizer.setCellSize(cellSize);
        });
        
        // Sensitivity control
        document.getElementById('sensitivity').addEventListener('input', (e) => {
            const sensitivity = parseFloat(e.target.value);
            document.getElementById('sensitivityValue').textContent = sensitivity.toFixed(1);
            this.audioManager.setSensitivity(sensitivity);
        });
        
        // Genre selection
        document.getElementById('genreSelect').addEventListener('change', (e) => {
            this.gameLogic.setGenre(e.target.value);
        });
        
        // Visual toggles
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.visualizer.setShowGrid(e.target.checked);
        });
        
        document.getElementById('showTrails').addEventListener('change', (e) => {
            this.visualizer.setShowTrails(e.target.checked);
        });
        
        document.getElementById('colorMode').addEventListener('change', (e) => {
            this.visualizer.setColorMode(e.target.checked);
        });
        
        // Action buttons
        document.getElementById('randomize').addEventListener('click', () => {
            this.gameLogic.randomizeGrid();
        });
        
        document.getElementById('clear').addEventListener('click', () => {
            this.gameLogic.clearGrid();
        });
        
        document.getElementById('export').addEventListener('click', () => {
            this.exportCanvas();
        });

        // Fullscreen toggle button
        const fullscreenBtn = document.getElementById('fullscreenToggle');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
            fullscreenBtn.innerHTML = this.fullscreenIcon;
        }

        // Update icon and canvas sizing when fullscreen state changes
        document.addEventListener('fullscreenchange', () => {
            const btn = document.getElementById('fullscreenToggle');
            if (btn) {
                btn.innerHTML = document.fullscreenElement ? this.exitFullscreenIcon : this.fullscreenIcon;
            }
            windowResized();

        document.getElementById('fullscreenToggle').addEventListener('click', () => {
            this.toggleFullscreen();

        });
    }
    
    handleAudioFile(event) {
        const file = event.target.files[0];
        if (file) {
            this.audioManager.loadAudioFile(file);
        }
    }
    
    togglePlayback() {
        if (!this.audioManager.audioLoaded) return;
        
        if (this.audioManager.isPlaying) {
            this.audioManager.pause();
            document.getElementById('playPause').innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                </svg>
            `;
        } else {
            this.audioManager.play();
            document.getElementById('playPause').innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
            `;
        }
    }
    
    exportCanvas() {
        saveCanvas('audio-reactive-game-of-life', 'png');
    }

    toggleFullscreen() {
        const container = document.getElementById('gameOfLife');
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            }
            resizeCanvas(window.innerWidth, window.innerHeight);
            const cols = floor(width / this.visualizer.cellSize);
            const rows = floor(height / this.visualizer.cellSize);
            this.gameLogic.resizeGrid(cols, rows);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            windowResized();
        }
        container.classList.toggle('fullscreen');

        const btn = document.getElementById('fullscreenToggle');
        if (btn) {
            btn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
        }
    }
    
    updateStats() {
        document.getElementById('generation').textContent = this.gameLogic.generation;
        document.getElementById('population').textContent = this.gameLogic.population;
        document.getElementById('audioLevel').textContent = 
            (this.audioManager.getAudioLevel() * 100).toFixed(1) + '%';
    }
    
    handleMouseClick(mouseX, mouseY) {
        if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
            let col = floor(mouseX / this.visualizer.cellSize);
            let row = floor(mouseY / this.visualizer.cellSize);
            this.gameLogic.toggleCell(col, row);
        }
    }

    // Continuously draw cells while the mouse is dragged
    handleMouseDrag(mouseX, mouseY) {
        if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
            let col = floor(mouseX / this.visualizer.cellSize);
            let row = floor(mouseY / this.visualizer.cellSize);
            this.gameLogic.setCellState(col, row, 1);
        }
    }
    
    handleKeyPress(key) {
        if (key === ' ') {
            this.togglePlayback();
        } else if (key === 'r' || key === 'R') {
            this.gameLogic.randomizeGrid();
        } else if (key === 'c' || key === 'C') {
            this.gameLogic.clearGrid();
        } else if (key === 'e' || key === 'E') {
            this.exportCanvas();
        } else if (key === 'g' || key === 'G') {
            const gridToggle = document.getElementById('showGrid');
            gridToggle.checked = !gridToggle.checked;
            this.visualizer.setShowGrid(gridToggle.checked);
        } else if (key === 't' || key === 'T') {
            const trailToggle = document.getElementById('showTrails');
            trailToggle.checked = !trailToggle.checked;
            this.visualizer.setShowTrails(trailToggle.checked);
        } else if (key === 'm' || key === 'M') {
            const colorToggle = document.getElementById('colorMode');
            colorToggle.checked = !colorToggle.checked;
            this.visualizer.setColorMode(colorToggle.checked);
        } else if (key === 'f' || key === 'F') {
            this.toggleFullscreen();
        }
    }

    // Methode, um Hinweis auszublenden
    hideUploadHint() {
        if (this.uploadHint) {
            this.uploadHint.classList.add('hidden');
        }
    }
}
