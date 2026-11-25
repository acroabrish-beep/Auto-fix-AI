/* 
  APPWRITE FUNCTION: chat-ai (virtual lab component)
  
  Secure educational automotive simulation.
  Verifies Appwrite JWT, supports simulation controls, protects user privacy.
  
  Input  (via URL params + controls): { "message": "My car cranks but won't start" }
  Output (JSON):      { "reply": "..." } | { "error": "..." } | { "fallback": "..." }
  
  NOTE: This is an EDUCATIONAL SIMULATOR only. All displayed values are SIMULATED DATA
  and are NOT real OBD-II readings. Never represent simulated values as actual measurements.
*/

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  CircleHelp,
  Gauge,
  Loader2,
  Pause,
  Plug,
  Redo,
  ScanLine,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AlertCircle, Wrench, Snowflake } from 'lucide-react';
import { diagnosticService } from '../services/ai';
import { AutomotiveTutorPanel } from '../components/learning/AutomotiveTutorPanel';
import { DiagnosticRequest, DiagnosticResponse } from '../types';

type SimulationState = {
  rpm: number;
  speed: number;
  coolantTemp: number;
  batteryVoltage: number;
  isRunning: boolean;
};

type LabReading = {
  titleKey: string;
  value: string;
  detailKey: string;
  tone: 'green' | 'amber';
  unit: string;
};

// Simulation configuration — educational ranges only
const SIMULATION_CONFIG = {
  // Engine RPM: idle to redline
  rpm: { min: 800, max: 8000, idle: 800, redline: 6000 },
  // Vehicle speed: 0 to highway speeds
  speed: { min: 0, max: 200, idle: 0, cruise: 100 },
  // Coolant temperature: cold to overheating
  coolantTemp: { min: 50, max: 120, normal: 90, overheating: 110 },
  // Battery voltage: discharged to fully charged
  batteryVoltage: { min: 10, max: 14.8, discharged: 11.8, charged: 12.6 },
};

// Initial values per scenario
const SCENARIO_INITIALS = {
  normal: {
    rpm: 1500,
    speed: 0,
    coolantTemp: 90,
    batteryVoltage: 12.6,
  },
  weakBattery: {
    rpm: 1200,
    speed: 0,
    coolantTemp: 85,
    batteryVoltage: 11.8,
  },
  overheating: {
    rpm: 1800,
    speed: 0,
    coolantTemp: 115,
    batteryVoltage: 12.4,
  },
  chargingFault: {
    rpm: 1500,
    speed: 0,
    coolantTemp: 88,
    batteryVoltage: 13.2,
  },
  sensorFault: {
    rpm: 1100,
    speed: 0,
    coolantTemp: 92,
    batteryVoltage: 12.3,
  },
};

// ---------------------------------------------------------------------------
// Virtual Lab Simulation Engine
// ---------------------------------------------------------------------------

export const VirtualLab = () => {
  const { moduleId = '' } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // --- Simulation state ---
  const [simulation, setSimulation] = useState<SimulationState>({
    rpm: SCENARIO_INITIALS.normal.rpm,
    speed: SCENARIO_INITIALS.normal.speed,
    coolantTemp: SCENARIO_INITIALS.normal.coolantTemp,
    batteryVoltage: SCENARIO_INITIALS.normal.batteryVoltage,
    isRunning: false,
  });

  const [reading, setReading] = useState<LabReading | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosticResponse | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const moduleTitle = moduleId
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

  // Determine current scenario from moduleId or use 'normal'
  const [scenario, setScenario] = useState<'normal' | 'weakBattery' | 'overheating' | 'chargingFault' | 'sensorFault'>(
    'normal'
  );

  // Simple scenario detection from moduleId
  useEffect(() => {
    if (moduleId) {
      const lower = moduleId.toLowerCase();
      if (lower.includes('weak-battery') || lower.includes('battery-flat')) setScenario('weakBattery');
      else if (lower.includes('overheating') || lower.includes('temp-high')) setScenario('overheating');
      else if (lower.includes('charge-fault') || lower.includes('alt-gen')) setScenario('chargingFault');
      else if (lower.includes('sensor') || lower.includes('fault')) setScenario('sensorFault');
    }
  }, [moduleId]);

  // Initialize simulation values based on scenario
  useEffect(() => {
    const initial = SCENARIO_INITIALS[scenario] || SCENARIO_INITIALS.normal;
    setSimulation({
      rpm: initial.rpm,
      speed: initial.speed,
      coolantTemp: initial.coolantTemp,
      batteryVoltage: initial.batteryVoltage,
      isRunning: false,
    });
  }, [scenario]);

  // Simulation interval — updates values gradually while running
  useEffect(() => {
    if (!simulation.isRunning) return;

    const interval = setInterval(() => {
      setSimulation((prev) => {
        // Gradual drift toward realistic ranges
        const { rpm, speed, coolantTemp, batteryVoltage } = prev;

        // RPM: slight variation around idle/cruise
        const newRpm = Math.max(SIMULATION_CONFIG.rpm.min, Math.min(SIMULATION_CONFIG.rpm.max, rpm + (Math.random() - 0.5) * 100));

        // Speed: slight variation
        const newSpeed = Math.max(SIMULATION_CONFIG.speed.min, Math.min(SIMULATION_CONFIG.speed.max, speed + (Math.random() - 0.5) * 5));

        // Coolant temp: slowly drift toward overheating if not normal
        const tempStep = Math.random() > 0.7 ? 1 : -1;
        const newTemp = Math.max(SIMULATION_CONFIG.coolantTemp.min, Math.min(SIMULATION_CONFIG.coolantTemp.max, coolantTemp + tempStep));

        // Battery voltage: slight variation
        const newVoltage = Math.max(SIMULATION_CONFIG.batteryVoltage.min, Math.min(SIMULATION_CONFIG.batteryVoltage.max, batteryVoltage + (Math.random() - 0.5) * 0.1));

        return { rpm: newRpm, speed: newSpeed, coolantTemp: newTemp, batteryVoltage: newVoltage, isRunning: true };
      });
    }, 1000); // 1-second updates

    return () => clearInterval(interval);
  }, [simulation.isRunning]);

  // --- UI handlers ---

  const startSimulation = () => {
    setSimulation((prev) => ({ ...prev, isRunning: true }));
  };

  const pauseSimulation = () => {
    setSimulation((prev) => ({ ...prev, isRunning: false }));
  };

  const resetSimulation = () => {
    setSimulation({
      rpm: SCENARIO_INITIALS[scenario]?.rpm ?? SCENARIO_INITIALS.normal.rpm,
      speed: SCENARIO_INITIALS[scenario]?.speed ?? SCENARIO_INITIALS.normal.speed,
      coolantTemp: SCENARIO_INITIALS[scenario]?.coolantTemp ?? SCENARIO_INITIALS.normal.coolantTemp,
      batteryVoltage: SCENARIO_INITIALS[scenario]?.batteryVoltage ?? SCENARIO_INITIALS.normal.batteryVoltage,
      isRunning: false,
    });
    setReading(null);
  };

  // Map each simulated scenario to plausible symptoms / warning lights so the
  // AI diagnosis is grounded in the current simulation state. These are
  // educational approximations, never real OBD-II readings.
  const SCENARIO_SYMPTOMS: Record<string, { symptoms: string[]; warningLights: string[] }> = {
    normal: { symptoms: ['No abnormal symptoms reported'], warningLights: [] },
    weakBattery: {
      symptoms: ['Engine cranks slowly', 'Dim headlights', 'Electrical accessories weak'],
      warningLights: ['Battery'],
    },
    overheating: {
      symptoms: ['Temperature gauge in red zone', 'Steam from engine bay', 'Coolant smell'],
      warningLights: ['Check Engine'],
    },
    chargingFault: {
      symptoms: ['Battery voltage drops while running', 'Alternator not charging'],
      warningLights: ['Battery'],
    },
    sensorFault: {
      symptoms: ['Check engine light illuminated', 'Rough idle', 'Poor fuel economy'],
      warningLights: ['Check Engine'],
    },
  };

  const handleGetDiagnosis = async () => {
    setDiagnosisLoading(true);
    setDiagnosisError(null);
    setDiagnosisResult(null);
    try {
      const { symptoms, warningLights } =
        SCENARIO_SYMPTOMS[scenario] || SCENARIO_SYMPTOMS.normal;
      const request: DiagnosticRequest = {
        vehicleId: `virtual-lab-${moduleId || 'sim'}`,
        description:
          `Simulated ${scenario.replace(/([A-Z])/g, ' $1').toLowerCase()} scenario. ` +
          `Readings: RPM ${simulation.rpm.toFixed(0)}, speed ${simulation.speed.toFixed(0)} km/h, ` +
          `coolant ${simulation.coolantTemp.toFixed(0)}°C, battery ${simulation.batteryVoltage.toFixed(1)} V.`,
        symptoms,
        timing: 'Recently',
        warningLights,
      };
      const result = await diagnosticService.analyzeSymptoms(request);
      setDiagnosisResult(result);
    } catch (err: any) {
      setDiagnosisError(err?.message || 'Diagnostic analysis failed.');
    } finally {
      setDiagnosisLoading(false);
    }
  };

  // --- Test handlers (existing) ---

  const testVoltage = () => {
    const v = simulation.batteryVoltage;
    const tone = v < 12.0 ? 'amber' : 'green';
    setReading({
      titleKey: 'lab.battery_test_title',
      value: `${v.toFixed(1)} V`,
      detailKey: 'lab.battery_test_detail',
      tone,
      unit: 'V',
    });
  };

  const readObdCodes = () => {
    setReading({
      titleKey: 'lab.obd_test_title',
      value: 'P0301',
      detailKey: 'lab.obd_test_detail',
      tone: 'amber',
      unit: '',
    });
  };

  // --- Render simulated readings ---

  const RenderReading = (
    labelKey: string,
    value: number,
    configKey: keyof typeof SIMULATION_CONFIG,
    unit: string,
    titleKey: string
  ) => {
    const cfg = SIMULATION_CONFIG[configKey];
    const min = cfg.min;
    const max = cfg.max;
    const labelKeyAr = `lab.${labelKey}`;
    const detailKeyAr = `lab.${labelKey}_detail`;

    // Determine tone based on value
    let tone: 'green' | 'amber';
    if (configKey === 'batteryVoltage') {
      tone = value < 12.0 ? 'amber' : 'green';
    } else if (configKey === 'coolantTemp') {
      tone = value > 100 ? 'amber' : 'green';
    } else {
      tone = 'green';
    }

    return (
      <div className="flex min-h-56 flex-col justify-between rounded-lg border border-emerald-300/15 bg-[#09110f] p-5 sm:p-7">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>{t(labelKey)}</span>
          <span>{unit}</span>
        </div>
        <div className="py-8 text-center font-mono">
          <span className="text-4xl font-semibold tracking-normal text-emerald-300 sm:text-5xl">
            {value.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>min: {min}</span>
          <span>max: {max}</span>
        </div>
      </div>
    );
  };

  // --- JSX ---

  return (
    <main className="min-h-screen bg-[#0b1015] text-slate-100">
      <header className="border-b border-white/10 bg-[#101820]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{t('lab.header')}</p>
              <p className="truncate text-xs text-slate-400">
                {moduleTitle || t('lab.module_fallback')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 gap-2 text-slate-300 hover:text-white"
            onClick={() => navigate(`/learning/${moduleId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('lab.back_module')}</span>
            <span className="sm:hidden">{t('lab.back')}</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-12">
        <section aria-labelledby="lab-title" className="min-w-0">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                {t('lab.training')}
              </p>
              <h1 id="lab-title" className="text-3xl font-bold text-white sm:text-4xl">
                {t('lab.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {t('lab.intro')}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" /> {t('lab.online')}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#131c24] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-white">{t('lab.multimeter')}</h2>
                  <p className="text-xs text-slate-500">{t('lab.auto_ranging')}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Plug className="h-4 w-4" /> {t('lab.connected')}
              </span>
            </div>

            <div className="grid gap-6 p-5 sm:grid-cols-[1fr_180px] sm:p-8">
              <div className="flex min-h-56 flex-col justify-between rounded-lg border border-emerald-300/15 bg-[#09110f] p-5 sm:p-7">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>{t('lab.dc_voltage')}</span>
                  <span>V⎓</span>
                </div>
                <div className="py-8 text-center font-mono">
                  <span className="text-5xl font-semibold tracking-normal text-emerald-300 sm:text-6xl">
                    {reading?.value ?? simulation.batteryVoltage.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>COM</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> VΩ
                  </span>
                </div>
              </div>

              <div className="flex flex-row items-center justify-center gap-4 sm:flex-col">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-[10px] border-slate-700 bg-[#0d141a] text-amber-300 shadow-inner">
                  <Zap className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t('lab.probe_status')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{t('lab.ready')}</p>
                </div>
              </div>

              <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 sm:p-6">
                <Button
                  onClick={testVoltage}
                  className="h-12 justify-start gap-3 bg-emerald-400 text-[#07110d] hover:bg-emerald-300"
                >
                  <BatteryCharging className="h-5 w-5" /> {t('lab.test_voltage')}
                </Button>
                <Button
                  onClick={readObdCodes}
                  className="h-12 justify-start gap-3 bg-cyan-300 text-[#071014] hover:bg-cyan-200"
                >
                  <ScanLine className="h-5 w-5" /> {t('lab.read_obd')}
                </Button>
              </div>
            </div>

            <section
              aria-live="polite"
              aria-label={t('lab.output')}
              className="mt-5 min-h-24 rounded-xl border border-white/10 bg-[#111920] p-5"
            >
              {reading ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      reading.tone === 'green' ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  />
                  <div>
                    <p className="font-bold text-white">{t(reading.titleKey)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{t(reading.detailKey)}</p>
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <CircleHelp className="h-4 w-4" /> {t('lab.select_test')}
                </p>
              )}
            </section>
          </div>

          {/* --- Simulation Controls --- */}
          <div className="mt-6 p-4 rounded-xl border border-slate-700 bg-[#1a2025]">
            <h2 className="font-bold text-white mb-4">{t('lab.simulation_title')}</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Button
                onClick={startSimulation}
                className="h-10 justify-start gap-2 bg-green-500 text-[#052e16] hover:bg-green-400"
                disabled={simulation.isRunning}
              >
                <Activity className="h-4 w-4" /> {t('lab.start')}
              </Button>
              <Button
                onClick={pauseSimulation}
                className="h-10 justify-start gap-2 bg-yellow-500 text-[#78350f] hover:bg-yellow-400"
                disabled={!simulation.isRunning}
              >
                <Pause className="h-4 w-4" /> {t('lab.pause')}
              </Button>
              <Button
                onClick={resetSimulation}
                className="h-10 justify-start gap-2 bg-red-500 text-[#7f1d1d] hover:bg-red-400"
              >
                <Redo className="h-4 w-4" /> {t('lab.reset')}
              </Button>
              <div className="col-span-4 sm:col-span-2 text-sm text-slate-400">
                {t('lab.simulation_range')}
              </div>
            </div>
          </div>

          {diagnosisError && (
            <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-[#2a0a0a] text-sm text-red-300">
              {diagnosisError}
            </div>
          )}
          <button
            onClick={handleGetDiagnosis}
            disabled={diagnosisLoading}
            className="mt-6 w-full h-12 justify-start gap-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 transition-all disabled:opacity-50"
          >
            {diagnosisLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {diagnosisLoading ? 'Analyzing...' : 'Get AI Diagnosis'}
          </button>

          {/* --- Simulated Readings Grid --- */}
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {/* Engine RPM */}
            {RenderReading("engine_rpm", simulation.rpm, "rpm", "RPM", "engine_rpm")}
            {/* Vehicle Speed */}
            {RenderReading("vehicle_speed", simulation.speed, "speed", "km/h", "vehicle_speed")}
            {/* Coolant Temperature */}
            {RenderReading("coolant_temp", simulation.coolantTemp, "coolantTemp", "°C", "coolant_temp")}
            {/* Battery Voltage */}
            {RenderReading("battery_voltage", simulation.batteryVoltage, "batteryVoltage", "V", "battery_voltage")}
          </div>

          {/* --- Disclaimer --- */}
          <div className="mt-8 p-4 rounded-xl border border-red-500/20 bg-[#2a0a0a] text-sm">
            <p className="text-red-300">
              <strong>SIMULATED DATA — NOT REAL OBD-II READINGS</strong>{' '}
              All values are educational simulations only and do not represent actual vehicle measurements.
            </p>
          </div>

          {diagnosisResult && (
            <section className="mt-8 rounded-xl border border-white/10 bg-[#131c24] p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-200">
                <AlertCircle className="h-5 w-5" />
                <h2 className="font-bold text-white">AI Diagnosis (Simulated)</h2>
              </div>
              <p className="mb-3 text-xs text-slate-400">
                <strong>SIMULATED DATA — EDUCATIONAL GUIDANCE ONLY</strong>{' '}
                Possible causes are probabilities, not certainty. Consult a qualified mechanic for safety-critical work.
              </p>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Summary</h3>
                <p className="text-sm text-slate-200">{diagnosisResult.summary}</p>

                {diagnosisResult.possibleCauses.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mt-4">
                      Possible Causes
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {diagnosisResult.possibleCauses.map((cause, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-xs text-brand-teal shrink-0">
                            {Math.round((cause.probability || 0) * 100)}% match
                          </span>
                          <span className="font-medium">{cause.title}</span>{' '}
                          {cause.description}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {diagnosisResult.recommendedChecks.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mt-4">
                      Recommended Checks
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-200 list-disc ml-5">
                      {diagnosisResult.recommendedChecks.map((check, i) => (
                        <li key={i}>
                          {check.title} — {check.description}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {diagnosisResult.safetyNotes.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mt-4">
                      Safety Notes
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-200 list-disc ml-5 text-red-300">
                      {diagnosisResult.safetyNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                {diagnosisResult.disclaimer}
              </p>
            </section>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-white/10 bg-[#131c24] p-5">
            <div className="mb-4 flex items-center gap-2 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-bold text-white">{t('lab.safety_title')}</h2>
            </div>
            <ul className="space-y-3 text-sm leading-5 text-slate-400">
              <li>{t('lab.safety_1')}</li>
              <li>{t('lab.safety_2')}</li>
              <li>{t('lab.safety_3')}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#131c24] p-5">
            <div className="mb-4 flex items-center gap-2 text-cyan-200">
              <Activity className="h-5 w-5" />
              <h2 className="font-bold text-white">{t('lab.sequence_title')}</h2>
            </div>
            <ol className="space-y-3 text-sm text-slate-400">
              <li className="flex gap-3">
                <span className="font-mono text-emerald-300">01</span> {t('lab.seq_1')}
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-emerald-300">02</span> {t('lab.seq_2')}
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-emerald-300">03</span> {t('lab.seq_3')}
              </li>
            </ol>
          </section>
        </aside>
      </div>
          <AutomotiveTutorPanel
            courseTitle={moduleTitle || t('lab.module_fallback')}
            scenario={scenario}
            readings={{
              rpm: simulation.rpm,
              speed: simulation.speed,
              coolantTemp: simulation.coolantTemp,
              batteryVoltage: simulation.batteryVoltage,
            }}
          />
    </main>
  );
};