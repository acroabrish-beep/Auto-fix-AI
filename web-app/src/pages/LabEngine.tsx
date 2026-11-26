import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BatteryCharging,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import {
  FAULT_SCENARIOS,
  type FaultScenarioKey,
  type MultimeterMode,
} from '../types';
import { labService } from '../services/lab/labService';
import { isCorrectLabAnswer } from '../services/lab/labLogic';

type StepResult = {
  correct: boolean;
  message: string;
};

const TOTAL_STEPS = 4;
const POINTS_PER_STEP = 25;

export function LabEngine() {
  const { moduleId: routeModuleId } = useParams<{ moduleId: string }>();
  const moduleId = routeModuleId || 'engine-basics';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [scenarioKey, setScenarioKey] =
    useState<FaultScenarioKey>('weakBattery');
  const [mode, setMode] = useState<MultimeterMode>('dc_voltage');
  const [range, setRange] = useState(20);
  const [probesConnected, setProbesConnected] = useState(false);
  const [interpretation, setInterpretation] = useState<'normal' | 'low' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<StepResult | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const scenario = FAULT_SCENARIOS[scenarioKey];

  const simulatedVoltage = useMemo(
    () => scenario.batteryResting,
    [scenario]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  const steps = [
    {
      title: t('lab.step_mode', { defaultValue: 'Select the multimeter mode' }),
      instruction: t('lab.step_mode_instruction', {
        defaultValue: 'Choose DC voltage to measure the battery voltage.',
      }),
      hint: t('lab.hint_mode', {
        defaultValue: 'Battery voltage is measured using DC voltage mode.',
      }),
    },
    {
      title: t('lab.step_range', { defaultValue: 'Choose the measurement range' }),
      instruction: t('lab.step_range_instruction', {
        defaultValue: 'Choose a range suitable for a 12-volt vehicle battery.',
      }),
      hint: t('lab.hint_range', {
        defaultValue: 'A 20V DC range is suitable for a 12V battery.',
      }),
    },
    {
      title: t('lab.step_probes', { defaultValue: 'Connect the probes' }),
      instruction: t('lab.step_probes_instruction', {
        defaultValue: 'Connect the red probe to positive and the black probe to negative.',
      }),
      hint: t('lab.hint_probes', {
        defaultValue: 'Red goes to positive (+); black goes to negative (-).',
      }),
    },
    {
      title: t('lab.step_interpretation', {
        defaultValue: 'Interpret the simulated reading',
      }),
      instruction: t('lab.step_interpretation_instruction', {
        defaultValue: 'The displayed battery voltage is below the normal resting range. What does this indicate?',
      }),
      hint: t('lab.hint_interpretation', {
        defaultValue: 'A healthy rested 12V battery is commonly around 12.6V. A lower value may indicate a weak battery.',
      }),
    },
  ];

  const finish = async (finalScore: number, finalMistakes: number) => {
    setCompleted(true);
    setSaving(true);
    setSaveMessage('');

    if (!user?.$id) {
      setSaveMessage(
        t('lab.sign_in_to_save', {
          defaultValue: 'Sign in to save this lab attempt to your account.',
        })
      );
      setSaving(false);
      return;
    }

    try {
      const response = await labService.saveLabAttempt({
        userId: user.$id,
        moduleId,
        exerciseId: 'engine-basics-battery-test',
        score: finalScore,
        durationSec: Math.floor((Date.now() - startedAt) / 1000),
        mistakes: finalMistakes,
        passed: finalScore >= 75,
        completedAt: new Date().toISOString(),
      });

      setSavedOffline(response.offline);
      setSaveMessage(
        response.offline
          ? t('lab.saved_offline', {
              defaultValue: 'Attempt saved on this device. Online sync is still needed.',
            })
          : t('lab.saved_online', {
              defaultValue: 'Your attempt was saved to your account.',
            })
      );
    } catch (error) {
      console.error('Could not save lab attempt:', error);
      setSaveMessage(
        t('lab.save_failed', {
          defaultValue: 'The attempt could not be saved. Please try again later.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const checkAnswer = async () => {
    if (completed || saving) return;

    let correct = false;
    let message = '';

    switch (currentStep) {
      case 0:
        correct = isCorrectLabAnswer(0, { mode, range, probesConnected, interpretation });
        message = correct
          ? t('lab.correct_mode', { defaultValue: 'Correct: DC voltage mode.' })
          : t('lab.incorrect_mode', { defaultValue: 'Incorrect. Select DC voltage mode.' });
        break;

      case 1:
        correct = isCorrectLabAnswer(1, { mode, range, probesConnected, interpretation });
        message = correct
          ? t('lab.correct_range', { defaultValue: 'Correct: 20V range.' })
          : t('lab.incorrect_range', { defaultValue: 'Choose the 20V range.' });
        break;

      case 2:
        correct = isCorrectLabAnswer(2, { mode, range, probesConnected, interpretation });
        message = correct
          ? t('lab.correct_probes', { defaultValue: 'Correct: probes connected.' })
          : t('lab.incorrect_probes', {
              defaultValue: 'Connect the probes before continuing.',
            });
        break;

      case 3:
        correct = isCorrectLabAnswer(3, { mode, range, probesConnected, interpretation });
        message = correct
          ? t('lab.correct_interpretation', {
              defaultValue: 'Correct: the reading indicates a potentially weak battery.',
            })
          : t('lab.incorrect_interpretation', {
              defaultValue: 'Review the reading. It is below the normal resting voltage.',
            });
        break;
    }

    setResult({ correct, message });

    if (!correct) {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      return;
    }

    const nextScore = score + POINTS_PER_STEP;
    setScore(nextScore);

    if (currentStep === TOTAL_STEPS - 1) {
      await finish(nextScore, mistakes);
    } else {
      setCurrentStep((step) => step + 1);
    }
  };

  const resetExercise = () => {
    setScenarioKey('weakBattery');
    setMode('dc_voltage');
    setRange(20);
    setProbesConnected(false);
    setInterpretation(null);
    setCurrentStep(0);
    setScore(0);
    setMistakes(0);
    setElapsedSec(0);
    setStartedAt(Date.now());
    setResult(null);
    setCompleted(false);
    setSaving(false);
    setSavedOffline(false);
    setSaveMessage('');
  };

  const passed = score >= 75;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">
            {t('lab.title', { defaultValue: 'Automotive Interactive Lab' })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {t('lab.engine_basics', { defaultValue: 'Engine Electrical Basics' })}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('lab.battery_exercise', {
              defaultValue: 'Battery voltage testing exercise',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <Clock3 size={17} />
          <span>{Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}</span>
        </div>
      </header>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <ShieldCheck size={19} className="mt-0.5 shrink-0" />
          <p>
            {t('lab.simulation_notice', {
              defaultValue:
                'Educational simulation only. These values are not real vehicle measurements or OBD-II data.',
            })}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">
            {t('lab.progress', { defaultValue: 'Exercise progress' })}
          </h2>
          <span className="text-sm text-slate-600">
            {completed ? TOTAL_STEPS : currentStep + 1} / {TOTAL_STEPS}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${(completed ? TOTAL_STEPS : currentStep) / TOTAL_STEPS * 100}%`,
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>{t('lab.score', { defaultValue: 'Score' })}: {score}/100</span>
          <span>{t('lab.mistakes', { defaultValue: 'Mistakes' })}: {mistakes}</span>
        </div>
      </section>

      {!completed ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BatteryCharging className="text-blue-600" size={22} />
              <h2 className="text-lg font-semibold text-slate-900">
                {t('lab.virtual_multimeter', { defaultValue: 'Virtual Multimeter' })}
              </h2>
            </div>

            <div className="rounded-lg bg-slate-900 p-5 text-center text-green-400">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                {t('lab.simulated_reading', { defaultValue: 'Simulated reading' })}
              </p>
              <p className="my-2 font-mono text-4xl font-bold">
                {simulatedVoltage.toFixed(1)} V
              </p>
              <p className="text-xs text-slate-400">
                {t('lab.battery_resting_voltage', {
                  defaultValue: 'Battery resting voltage',
                })}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {t('lab.multimeter_mode', { defaultValue: 'Multimeter mode' })}
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as MultimeterMode)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value="dc_voltage">DC Voltage (V?)</option>
                  <option value="resistance">Resistance (?)</option>
                  <option value="continuity">Continuity</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t('lab.measurement_range', { defaultValue: 'Measurement range' })}
                <select
                  value={range}
                  onChange={(event) => setRange(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value={2}>2V</option>
                  <option value={20}>20V</option>
                  <option value={200}>200V</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">
                {t('lab.probe_connections', { defaultValue: 'Probe connections' })}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  {probesConnected
                    ? t('lab.probes_connected', { defaultValue: 'Red: + / Black: -' })
                    : t('lab.probes_disconnected', { defaultValue: 'Probes disconnected' })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProbesConnected((value) => !value)}
                >
                  {probesConnected
                    ? t('lab.disconnect_probes', { defaultValue: 'Disconnect' })
                    : t('lab.connect_probes', { defaultValue: 'Connect probes' })}
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-600">
              {t('lab.step', { defaultValue: 'STEP' })} {currentStep + 1}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {steps[currentStep].title}
            </h2>
            <p className="mt-3 text-slate-700">{steps[currentStep].instruction}</p>

            {currentStep === 3 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setInterpretation('normal')}
                  className={`rounded-lg border p-4 text-left ${
                    interpretation === 'normal'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                >
                  {t('lab.normal_reading', { defaultValue: 'Normal battery condition' })}
                </button>
                <button
                  type="button"
                  onClick={() => setInterpretation('low')}
                  className={`rounded-lg border p-4 text-left ${
                    interpretation === 'low'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                >
                  {t('lab.low_reading', { defaultValue: 'Potentially weak battery' })}
                </button>
              </div>
            )}

            {result && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
                  result.correct
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
                role="status"
              >
                {result.correct ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
                <span>{result.message}</span>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              <strong>{t('lab.hint', { defaultValue: 'Hint' })}: </strong>
              {steps[currentStep].hint}
            </div>

            <div className="mt-5 flex flex-wrap justify-between gap-3">
              <Button type="button" variant="outline" onClick={resetExercise}>
                <RotateCcw size={16} className="mr-2" />
                {t('lab.reset', { defaultValue: 'Reset exercise' })}
              </Button>
              <Button type="button" onClick={checkAnswer} disabled={saving}>
                {t('lab.check_answer', { defaultValue: 'Check answer' })}
              </Button>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          {passed ? (
            <CheckCircle2 className="mx-auto text-green-600" size={48} />
          ) : (
            <CircleAlert className="mx-auto text-amber-600" size={48} />
          )}
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            {t('lab.exercise_complete', { defaultValue: 'Exercise complete' })}
          </h2>
          <p className="mt-2 text-slate-600">
            {t('lab.final_score', { defaultValue: 'Your score' })}: {score}/100
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {passed
              ? t('lab.passed', { defaultValue: 'You passed this exercise.' })
              : t('lab.not_passed', { defaultValue: 'Try again to improve your score.' })}
          </p>

          {saving && (
            <p className="mt-4 text-sm text-slate-600">
              {t('lab.saving', { defaultValue: 'Saving your attempt...' })}
            </p>
          )}
          {saveMessage && (
            <p className="mt-4 text-sm text-slate-600" role="status">
              {savedOffline ? <Zap className="mr-1 inline" size={15} /> : null}
              {saveMessage}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={resetExercise}>
              <RotateCcw size={16} className="mr-2" />
              {t('lab.try_again', { defaultValue: 'Try again' })}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
              {t('lab.back_dashboard', { defaultValue: 'Back to dashboard' })}
            </Button>
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500">
        {t('lab.scenario_label', { defaultValue: 'Training scenario' })}: {scenario.description}
      </p>
    </main>
  );
}

export default LabEngine;
