import confetti from 'canvas-confetti';

/**
 * Lanza un estallido de confeti elegante y discreto estilo Stripe/Vercel
 * cuando se concluye una OC, se liquida un contrarecibo o se completa una meta.
 */
export function triggerCelebrationConfetti() {
  try {
    // Ráfaga 1: Izquierda
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
      disableForReducedMotion: true,
    });

    // Ráfaga 2: Derecha
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
      disableForReducedMotion: true,
    });
  } catch (err) {
    // Si canvas-confetti no está disponible o falla, fallar silenciosamente
  }
}
