// Audio Manager - Handles all audio-related functionality
class AudioManager {
    constructor() {
        this.sound = null;
        this.fft = null;
        this.amplitude = null;
        this.isPlaying = false;
        this.audioLoaded = false;
        this.audioSensitivity = 1;
        
        // Audio analysis variables
        this.bassLevel = 0;
        this.midLevel = 0;
        this.highLevel = 0;
        
        this.initializeAudio();
    }
    
    initializeAudio() {
        // Initialize FFT and amplitude analyzer
        this.fft = new p5.FFT(0.8, 512);
        this.amplitude = new p5.Amplitude();
    }
    
    loadAudioFile(file) {
        if (this.sound) {
            this.sound.stop();
        }
        
        this.sound = loadSound(file, () => {
            this.audioLoaded = true;
            
            // Connect audio to analyzers
            this.fft.setInput(this.sound);
            this.amplitude.setInput(this.sound);
            
            console.log('Audio loaded successfully');
            
            // Enable controls
            document.getElementById('playPause').disabled = false;
            document.getElementById('stop').disabled = false;
        });
    }
    
    analyzeAudio() {
        if (!this.audioLoaded || !this.isPlaying) return;
        
        let spectrum = this.fft.analyze();
        
        // Reset levels
        this.bassLevel = 0;
        this.midLevel = 0;
        this.highLevel = 0;
        
        // Bass frequencies (20-250 Hz)
        for (let i = 0; i < spectrum.length / 8; i++) {
            this.bassLevel += spectrum[i];
        }
        this.bassLevel /= (spectrum.length / 8);
        this.bassLevel = map(this.bassLevel, 0, 255, 0, 1);
        
        // Mid frequencies (250-4000 Hz)
        for (let i = spectrum.length / 8; i < spectrum.length / 2; i++) {
            this.midLevel += spectrum[i];
        }
        this.midLevel /= (spectrum.length / 2 - spectrum.length / 8);
        this.midLevel = map(this.midLevel, 0, 255, 0, 1);
        
        // High frequencies (4000+ Hz)
        for (let i = spectrum.length / 2; i < spectrum.length; i++) {
            this.highLevel += spectrum[i];
        }
        this.highLevel /= (spectrum.length / 2);
        this.highLevel = map(this.highLevel, 0, 255, 0, 1);
        
        // Apply sensitivity multiplier
        this.bassLevel *= this.audioSensitivity;
        this.midLevel *= this.audioSensitivity;
        this.highLevel *= this.audioSensitivity;
    }
    
    play() {
        if (!this.audioLoaded) return;
        
        this.sound.play();
        this.isPlaying = true;
    }
    
    pause() {
        if (!this.audioLoaded) return;
        
        this.sound.pause();
        this.isPlaying = false;
    }
    
    stop() {
        if (!this.audioLoaded) return;
        
        this.sound.stop();
        this.isPlaying = false;
    }
    
    setVolume(volume) {
        if (this.sound) {
            this.sound.setVolume(volume);
        }
    }
    
    setSensitivity(sensitivity) {
        this.audioSensitivity = sensitivity;
    }
    
    getAudioLevel() {
        return this.audioLoaded && this.isPlaying ? this.amplitude.getLevel() : 0;
    }
}