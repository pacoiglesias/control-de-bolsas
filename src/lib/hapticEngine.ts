/**
 * Motor Háptico y Sonoro Universal para BOLSAS ELEMENTAL ERP
 * 
 * Proporciona respuesta táctil (vibración en móviles) y efectos sonoros
 * sintetizados en tiempo real mediante Web Audio API nativo (100% offline, 0 dependencias).
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'cash' | 'warning' | 'error';

/**
 * Dispara una vibración háptica en dispositivos móviles compatibles
 */
export function triggerHaptic(type: HapticType = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 40, 25]);
        break;
      case 'cash':
        navigator.vibrate([20, 50, 20, 50, 35]);
        break;
      case 'warning':
        navigator.vibrate([30, 40, 30]);
        break;
      case 'error':
        navigator.vibrate([50, 40, 50, 40, 70]);
        break;
    }
  } catch {
    // Ignorar si el navegador restringe la vibración
  }
}

/**
 * Sonido de caja registradora / cobro exitoso
 */
export function playCashSound() {
  triggerHaptic('cash');
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tono 1 (Ding agudo campana)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tono 2 (Brillo moneda)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1567.98, now + 0.05); // G6
    osc2.frequency.exponentialRampToValueAtTime(2093.00, now + 0.15); // C7
    gain2.gain.setValueAtTime(0.18, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.debug('Audio muted:', e);
  }
}

/**
 * Sonido de confirmación / éxito
 */
export function playSuccessSound() {
  triggerHaptic('success');
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.debug('Audio muted:', e);
  }
}

/**
 * Sonido sutil de toque interactivo / botón
 */
export function playSoftClick() {
  triggerHaptic('light');
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    console.debug('Audio muted:', e);
  }
}

/**
 * Disparo combinado de acción interactiva
 */
export function triggerActionFeedback(action: 'tap' | 'open' | 'success' | 'cash' | 'warn') {
  switch (action) {
    case 'cash':
      playCashSound();
      break;
    case 'success':
      playSuccessSound();
      break;
    case 'warn':
      triggerHaptic('warning');
      break;
    case 'tap':
    case 'open':
    default:
      playSoftClick();
      break;
  }
}
