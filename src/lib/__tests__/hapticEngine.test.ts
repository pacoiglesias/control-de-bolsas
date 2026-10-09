import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerHaptic,
  playCashSound,
  playSuccessSound,
  playSoftClick,
  triggerActionFeedback,
} from '../hapticEngine';

describe('hapticEngine Unit Tests', () => {
  let originalNavigator: any;
  let originalAudioContext: any;
  let vibrateMock: any;

  beforeEach(() => {
    vibrateMock = vi.fn();
    originalNavigator = global.navigator;
    originalAudioContext = (global as any).AudioContext;

    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: vibrateMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    (global as any).AudioContext = originalAudioContext;
  });

  it('triggers haptic patterns for all supported types', () => {
    triggerHaptic('light');
    expect(vibrateMock).toHaveBeenCalledWith(10);

    triggerHaptic('medium');
    expect(vibrateMock).toHaveBeenCalledWith(25);

    triggerHaptic('heavy');
    expect(vibrateMock).toHaveBeenCalledWith(45);

    triggerHaptic('success');
    expect(vibrateMock).toHaveBeenCalledWith([15, 40, 25]);

    triggerHaptic('cash');
    expect(vibrateMock).toHaveBeenCalledWith([20, 50, 20, 50, 35]);

    triggerHaptic('warning');
    expect(vibrateMock).toHaveBeenCalledWith([30, 40, 30]);

    triggerHaptic('error');
    expect(vibrateMock).toHaveBeenCalledWith([50, 40, 50, 40, 70]);
  });

  it('handles environment when navigator.vibrate throws or does not exist', () => {
    vibrateMock.mockImplementation(() => {
      throw new Error('Not allowed');
    });
    expect(() => triggerHaptic('light')).not.toThrow();

    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(() => triggerHaptic('heavy')).not.toThrow();
  });

  it('executes audio synthesis routines with mocked Web Audio API', () => {
    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockAudioCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn(() => ({ ...mockOscillator })),
      createGain: vi.fn(() => ({ ...mockGain })),
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
    };

    (global as any).AudioContext = vi.fn(() => mockAudioCtx);

    expect(() => playCashSound()).not.toThrow();
    expect(() => playSuccessSound()).not.toThrow();
    expect(() => playSoftClick()).not.toThrow();

    expect(() => triggerActionFeedback('cash')).not.toThrow();
    expect(() => triggerActionFeedback('success')).not.toThrow();
    expect(() => triggerActionFeedback('warn')).not.toThrow();
    expect(() => triggerActionFeedback('tap')).not.toThrow();
    expect(() => triggerActionFeedback('open')).not.toThrow();
  });
});
