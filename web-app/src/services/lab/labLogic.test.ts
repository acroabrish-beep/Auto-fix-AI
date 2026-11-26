import { describe, expect, it } from 'vitest';
import {
  classifyRestingBatteryVoltage,
  isCorrectLabAnswer,
  type LabAnswer,
} from './labLogic';

const correctAnswer: LabAnswer = {
  mode: 'dc_voltage',
  range: 20,
  probesConnected: true,
  interpretation: 'low',
};

describe('isCorrectLabAnswer', () => {
  it('requires DC voltage mode in step 0', () => {
    expect(isCorrectLabAnswer(0, correctAnswer)).toBe(true);
    expect(isCorrectLabAnswer(0, { ...correctAnswer, mode: 'resistance' })).toBe(false);
  });

  it('requires the 20V range in step 1', () => {
    expect(isCorrectLabAnswer(1, correctAnswer)).toBe(true);
    expect(isCorrectLabAnswer(1, { ...correctAnswer, range: 200 })).toBe(false);
  });

  it('requires connected probes in step 2', () => {
    expect(isCorrectLabAnswer(2, correctAnswer)).toBe(true);
    expect(isCorrectLabAnswer(2, { ...correctAnswer, probesConnected: false })).toBe(false);
  });

  it('requires the low-battery interpretation in step 3', () => {
    expect(isCorrectLabAnswer(3, correctAnswer)).toBe(true);
    expect(isCorrectLabAnswer(3, { ...correctAnswer, interpretation: 'normal' })).toBe(false);
    expect(isCorrectLabAnswer(3, { ...correctAnswer, interpretation: null })).toBe(false);
  });

  it('rejects unknown step numbers', () => {
    expect(isCorrectLabAnswer(4, correctAnswer)).toBe(false);
    expect(isCorrectLabAnswer(-1, correctAnswer)).toBe(false);
  });
});

describe('classifyRestingBatteryVoltage', () => {
  it('classifies the weak-battery training value as low', () => {
    expect(classifyRestingBatteryVoltage(12.2)).toBe('low');
  });

  it('classifies 12.6V as normal for this training exercise', () => {
    expect(classifyRestingBatteryVoltage(12.6)).toBe('normal');
  });

  it('classifies values below 12.4V as low', () => {
    expect(classifyRestingBatteryVoltage(12.39)).toBe('low');
  });

  it('rejects invalid voltage values', () => {
    expect(() => classifyRestingBatteryVoltage(Number.NaN)).toThrow(RangeError);
    expect(() => classifyRestingBatteryVoltage(-1)).toThrow(RangeError);
  });
});
