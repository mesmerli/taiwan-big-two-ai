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

    playBGM(filename = 'Cards_On_The_Line') {
        const newPath = `src/assets/mp3/${filename}.mp3`;
        
        if (this.bgm) {
            // If already playing the same track, do nothing
            if (this.bgm.src.includes(filename)) return;
            this.bgm.pause();
        }

        this.bgm = new Audio(newPath);
        this.bgm.loop = true;
        this.bgm.volume = 0.4;
        this.bgm.muted = (this.soundMode !== 0);

        this.bgm.play().catch(err => {
            console.log("BGM autoplay prevented or failed, waiting for interaction...");
            const startBGM = () => {
                if (this.bgm) {
                    this.bgm.play().catch(e => console.log("BGM play failed:", e));
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext:", e));
                }
                // Clean up all gesture unlock listeners
                window.removeEventListener('click', startBGM);
                window.removeEventListener('touchstart', startBGM);
                window.removeEventListener('mousedown', startBGM);
                window.removeEventListener('keydown', startBGM);
            };
            window.addEventListener('click', startBGM);
            window.addEventListener('touchstart', startBGM);
            window.addEventListener('mousedown', startBGM);
            window.addEventListener('keydown', startBGM);
        });
    }

    switchBGM(filename) {
        this.playBGM(filename);
    }

    playTone(freq, type, duration, volume = 0.1) {
        if (this.soundMode === 2) return;
        
        // Auto-resume AudioContext if it is suspended in Android WebView
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn("Auto-resume AudioContext failed:", e));
        }

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
        // Change BGM to Sovereign_Ascent when someone wins
        this.switchBGM('Sovereign_Ascent');

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.1), i * 150);
        });
    }

    playLa(persona = 'you') {
        if (this.soundMode === 2) return;

        // Change BGM to Iron_in_the_Gale when someone shouts La
        this.switchBGM('Iron_in_the_Gale');

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

