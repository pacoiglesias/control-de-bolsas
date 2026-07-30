const MUTE_STORAGE_KEY = 'cb-sound-muted';

/**
 * Estado inicial del silencio: respeta lo que el usuario haya elegido antes
 * (persistido en localStorage) y, si nunca lo ha decidido, arranca en
 * silencio para quien pidió al sistema operativo menos movimiento/estímulo
 * (prefers-reduced-motion) — quien pide eso suele querer menos ruido también.
 */
function initialMuted(): boolean {
  try {
    const saved = localStorage.getItem(MUTE_STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* localStorage inaccesible (modo privado, etc.): seguir con el default */
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = initialMuted();

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, m ? '1' : '0');
    } catch {
      /* si no se puede persistir, el silencio sigue funcionando en esta sesión */
    }
  }

  isMuted() {
    return this.muted;
  }

  playSuccess() {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore audio errs */ }
  }

  playCash() {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  }

  playError() {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* ignore */ }
  }

  playNotify() {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore */ }
  }
}

export const sound = new SoundEngine();
