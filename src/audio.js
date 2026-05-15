/**
 * Simple Audio Engine using Web Audio API
 */
class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.soundMode = 0; // 0: All, 1: SFX Only, 2: None
        this.bgm = null;
    }

    setSoundMode(mode) {
        this.soundMode = parseInt(mode);
        if (this.bgm) {
            // BGM is only audible in Mode 0
            this.bgm.muted = (this.soundMode !== 0);
        }
    }

    playBGM() {
        if (!this.bgm) {
            this.bgm = new Audio('src/assets/mp3/Cards_On_The_Line.mp3');
            this.bgm.loop = true;
            this.bgm.volume = 0.4;
            this.bgm.muted = (this.soundMode !== 0);
        }

        this.bgm.play().catch(err => {
            console.log("BGM autoplay prevented, waiting for interaction...");
            const startBGM = () => {
                if (this.bgm) this.bgm.play();
                window.removeEventListener('mousedown', startBGM);
                window.removeEventListener('keydown', startBGM);
            };
            window.addEventListener('mousedown', startBGM);
            window.addEventListener('keydown', startBGM);
        });
    }

    playTone(freq, type, duration, volume = 0.1) {
        if (this.soundMode === 2) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playCardSelect() {
        this.playTone(800, 'sine', 0.05, 0.05);
    }

    playCardPlay() {
        this.playTone(400, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(600, 'triangle', 0.1, 0.05), 50);
    }

    playPass(persona = 'you') {
        if (this.soundMode === 2) return;

        // Always play SFX (Tone)
        this.playTone(200, 'sine', 0.2, 0.1);

        // Play Voice only in Mode 0 (All)
        if (this.soundMode !== 0) return;

        const personaKey = persona.toLowerCase().split(' ')[0];
        const audioPath = `src/assets/mp3/pass_${personaKey}.mp3`;

        const audio = new Audio(audioPath);
        audio.play().catch(err => {
            console.warn(`Failed to play character-specific Pass (${audioPath}):`, err);
        });
    }

    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.1), i * 150);
        });
    }

    playLa(persona = 'you') {
        if (this.soundMode === 2) return;

        // Always play SFX (Tone)
        this.playTone(600, 'sawtooth', 0.1, 0.15);
        setTimeout(() => this.playTone(400, 'sawtooth', 0.2, 0.1), 50);

        // Play Voice only in Mode 0 (All)
        if (this.soundMode !== 0) return;
        
        const personaKey = persona.toLowerCase().split(' ')[0];
        const audioPath = `src/assets/mp3/la_${personaKey}.mp3`;
        
        const audio = new Audio(audioPath);
        audio.play().catch(err => {
            console.warn(`Failed to play character-specific La (${audioPath}):`, err);
        });
    }
}

const AudioPlayer = new SoundEngine();
if (typeof module !== 'undefined') {
    module.exports = AudioPlayer;
}

