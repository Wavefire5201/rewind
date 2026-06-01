import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/utils/haptics';

export interface UseAutoCaptureOptions {
  enabled: boolean;
  alignmentScore: number;
  alignmentThreshold?: number;
  requiredFrames?: number;
  cooldownMs?: number;
  onCapture: () => void;
}

export interface UseAutoCaptureResult {
  progress: number;
  isInCooldown: boolean;
  stableFrames: number;
}

const HOLD_BEFORE_DECAY_MS = 500;

export function useAutoCapture({
  enabled,
  alignmentScore,
  alignmentThreshold = 0.7,
  requiredFrames = 10,
  cooldownMs = 2000,
  onCapture,
}: UseAutoCaptureOptions): UseAutoCaptureResult {
  const [stableFrames, setStableFrames] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);

  const stableFramesRef = useRef(0);
  const isInCooldownRef = useRef(false);
  const lastAlignedRef = useRef<number | null>(null);
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clearDecayTimer = useCallback(() => {
    if (decayTimerRef.current !== null) {
      clearTimeout(decayTimerRef.current);
      decayTimerRef.current = null;
    }
  }, []);

  const enterCooldown = useCallback(() => {
    isInCooldownRef.current = true;
    setIsInCooldown(true);
    stableFramesRef.current = 0;
    setStableFrames(0);
    firedRef.current = false;

    setTimeout(() => {
      isInCooldownRef.current = false;
      setIsInCooldown(false);
    }, cooldownMs);
  }, [cooldownMs]);

  useEffect(() => {
    if (!enabled || isInCooldownRef.current) return;

    const isAligned = alignmentScore >= alignmentThreshold;

    if (isAligned) {
      clearDecayTimer();
      lastAlignedRef.current = Date.now();

      const next = stableFramesRef.current + 1;
      stableFramesRef.current = next;
      setStableFrames(next);

      // Graduated haptic feedback as alignment improves
      if (next === 1) {
        haptics.alignment(alignmentScore);
      }

      if (next >= requiredFrames && !firedRef.current) {
        firedRef.current = true;
        haptics.success();
        onCapture();
        enterCooldown();
      }
    } else {
      // Alignment broken — hold for HOLD_BEFORE_DECAY_MS then decay
      if (stableFramesRef.current > 0 && decayTimerRef.current === null) {
        decayTimerRef.current = setTimeout(() => {
          decayTimerRef.current = null;
          stableFramesRef.current = 0;
          setStableFrames(0);
        }, HOLD_BEFORE_DECAY_MS);
      }
    }
  }, [alignmentScore, enabled, alignmentThreshold, requiredFrames, onCapture, enterCooldown, clearDecayTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDecayTimer();
    };
  }, [clearDecayTimer]);

  const progress = Math.min(1, stableFrames / requiredFrames);

  return { progress, isInCooldown, stableFrames };
}
