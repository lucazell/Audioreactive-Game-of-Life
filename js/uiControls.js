// UI Controls - Handles all user interface interactions
class UIControls {
    constructor(audioManager, gameLogic, visualizer) {
        this.audioManager = audioManager;
        this.gameLogic = gameLogic;
        this.visualizer = visualizer;

        // Hinweis-Element referenzieren
        this.uploadHint = document.getElementById('uploadHint');

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
        }
    }

    // Methode, um Hinweis auszublenden
    hideUploadHint() {
        if (this.uploadHint) {
            this.uploadHint.classList.add('hidden');
        }
    }
}
