/**
 * Simple Audio Engine using Web Audio API
 */
class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type, duration, volume = 0.1) {
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

    playPass() {
        this.playTone(200, 'sine', 0.2, 0.1);
    }

    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.1), i * 150);
        });
    }

    playLa() {
        // A sharp "shout" sound
        this.playTone(600, 'sawtooth', 0.1, 0.15);
        setTimeout(() => this.playTone(400, 'sawtooth', 0.2, 0.1), 50);
    }
}

const AudioPlayer = new SoundEngine();
if (typeof module !== 'undefined') {
    module.exports = AudioPlayer;
}
