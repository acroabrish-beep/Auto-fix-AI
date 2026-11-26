import type { MultimeterMode } from '../../types';

export type LabInterpretation = 'normal' | 'low' | null;

export interface LabAnswer {
  mode: MultimeterMode;
  range: number;
  probesConnected: boolean;
  interpretation: LabInterpretation;
}

export function isCorrectLabAnswer(step: number, answer: LabAnswer): boolean {
  switch (step) {
    case 0:
      return answer.mode === 'dc_voltage';
    case 1:
      return answer.range === 20;
    case 2:
      return answer.probesConnected;
    case 3:
      return answer.interpretation === 'low';
    default:
      return false;
  }
}

/**
 * Educational threshold for a rested 12V lead-acid battery.
 * This is not a substitute for a real battery load or conductance test.
 */
export function classifyRestingBatteryVoltage(voltage: number): 'low' | 'normal' {
  if (!Number.isFinite(voltage) || voltage < 0) {
    throw new RangeError('Battery voltage must be a finite non-negative number.');
  }

  return voltage < 12.4 ? 'low' : 'normal';
}
