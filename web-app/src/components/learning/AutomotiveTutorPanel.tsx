import React, { useEffect, useMemo, useState } from 'react';
import { generateChatReply } from '../../services/ai/chat';

type Props = {
  courseTitle: string;
  scenario: string;
  readings: { rpm: number; speed: number; coolantTemp: number; batteryVoltage: number };
};

const SYSTEMS = [
  { id: 'battery', en: 'Battery & starting', am: 'ባትሪ እና ማስነሻ ሲስተም', detail: 'Battery, terminals, starter motor, starter relay and cranking circuit.' },
  { id: 'charging', en: 'Charging system', am: 'የቻርጅ ሲስተም', detail: 'Alternator, regulator, battery charging circuit and warning lamp.' },
  { id: 'ignition', en: 'Ignition system', am: 'የኢግኒሽን ሲስተም', detail: 'Ignition coil, spark plugs, crankshaft sensor and ignition timing.' },
  { id: 'lighting', en: 'Lighting & signals', am: 'መብራት እና ሲግናል', detail: 'Headlamps, tail lamps, indicators, fuses, relays and switches.' },
  { id: 'engine', en: 'Engine management', am: 'የኤንጂን ኮንትሮል', detail: 'ECU, sensors, actuators, fuel injection and live data.' },
  { id: 'sensors', en: 'Sensors & actuators', am: 'ሴንሰሮች እና አክቹዌተሮች', detail: 'Input signals, output control, reference voltage, ground and signal tests.' },
  { id: 'obd', en: 'OBD-II diagnostics', am: 'የOBD-II ዲያግኖስቲክ', detail: 'Diagnostic connector, DTC codes, freeze-frame and scan-tool workflow.' },
  { id: 'safety', en: 'Wiring & safety', am: 'ዋየሪንግ እና ደህንነት', detail: 'Wiring diagrams, continuity, voltage drop, fuses and safe isolation.' },
];

export const AutomotiveTutorPanel: React.FC<Props> = ({ courseTitle, scenario, readings }) => {
  const [selected, setSelected] = useState(SYSTEMS[0]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('ሰላም! የምትማረውን ኮርስ እና የመኪናውን ሲስተም መሠረት አድርጌ እመራሃለሁ። ከላይ አንድ ሲስተም ምረጥ ወይም ጥያቄ ጠይቅ።');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [voiceStatus, setVoiceStatus] = useState('');
  const SpeechRecognitionCtor = useMemo(() => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition, []);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) { setVoiceStatus('ይህ ብራውዘር የድምፅ ማንበብን አይደግፍም።'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'am-ET';
    utterance.rate = 0.88;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setVoiceStatus('የአማርኛ ድምፅ በዚህ መሣሪያ ላይ ላይገኝ ይችላል።'); };
    const voices = window.speechSynthesis.getVoices();
    const amVoice = voices.find(v => v.lang.toLowerCase().startsWith('am'));
    if (amVoice) utterance.voice = amVoice;
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (text = question) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setQuestion('');
    try {
      const reply = await generateChatReply(prompt,
        'You are AutoFix AI, a careful automotive electrical and electronics instructor. Teach in clear, natural Ethiopian Amharic. Keep standard technical terms in English followed by a correct Amharic explanation. Use short numbered steps, ask one checking question, and adapt to the learner. Never claim simulated readings are real. Never advise unsafe live high-voltage work. Context: course=' + courseTitle + '; selected vehicle system=' + selected.en + ' (' + selected.am + '); system details=' + selected.detail + '; simulation scenario=' + scenario + '; simulated readings=' + JSON.stringify(readings) + '. Explain only what is relevant to this course and selected system.');
      setAnswer(reply);
    } catch (error: any) {
      setAnswer('AI Tutor አሁን ምላሽ መስጠት አልቻለም። የAppwrite chat-ai ግንኙነትን እና የመግቢያ ሁኔታን ያረጋግጡ። ' + (error?.message || ''));
    } finally { setBusy(false); }
  };

  const startVoice = () => {
    if (!SpeechRecognitionCtor) { setVoiceStatus('የድምፅ ጥያቄ በዚህ ብራውዘር አይደገፍም። Chrome ይጠቀሙ ወይም ጽሑፍ ይጻፉ።'); return; }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'am-ET';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setVoiceStatus('እየሰማሁ ነው...'); };
    recognition.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript || ''; setQuestion(transcript); setVoiceStatus('የተሰማው ጥያቄ ተቀብሏል።'); void ask(transcript); };
    recognition.onerror = () => { setVoiceStatus('ድምፁን መለየት አልተቻለም። Microphone permission ያረጋግጡ።'); setListening(false); };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return <section className="mt-8 rounded-2xl border border-cyan-300/20 bg-[#101b24] p-5 sm:p-7">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">AUTOFIX AI • INTERACTIVE TRAINING</p>
        <h2 className="mt-1 text-xl font-bold text-white">የመኪና ሲስተሞች እና AI አስተማሪ</h2>
        <p className="mt-1 text-sm text-slate-400">ኮርስ፦ {courseTitle}</p></div>
      <span className="rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-200">Educational simulation</span>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
      <div>
        <div className="rounded-xl border border-white/10 bg-[#0a1118] p-4">
          <p className="mb-3 text-sm font-semibold text-white">የመኪና ሲስተም ምረጥ</p>
          <svg viewBox="0 0 620 290" role="img" aria-label="Interactive top view vehicle systems diagram" className="w-full">
            <path d="M130 72 Q145 30 210 24 L410 24 Q475 30 490 72 L525 112 L525 205 Q515 245 465 253 L155 253 Q105 245 95 205 L95 112 Z" fill="#243746" stroke="#8ba7b9" strokeWidth="4"/>
            <path d="M190 48 L430 48 L462 100 L158 100 Z" fill="#527084" stroke="#a8c2d0" strokeWidth="3"/>
            <path d="M158 110 L462 110 L462 184 L158 184 Z" fill="#15232e" stroke="#718b9b" strokeWidth="3"/>
            <path d="M180 195 L440 195 L420 232 L200 232 Z" fill="#527084" stroke="#a8c2d0" strokeWidth="3"/>
            <rect x="65" y="88" width="42" height="66" rx="12" fill="#0b0f13" stroke="#78909c" strokeWidth="3"/><rect x="513" y="88" width="42" height="66" rx="12" fill="#0b0f13" stroke="#78909c" strokeWidth="3"/>
            <rect x="65" y="180" width="42" height="56" rx="12" fill="#0b0f13" stroke="#78909c" strokeWidth="3"/><rect x="513" y="180" width="42" height="56" rx="12" fill="#0b0f13" stroke="#78909c" strokeWidth="3"/>
            <g fontSize="14" fontWeight="700" textAnchor="middle" fill="#e6f5ff">
              <circle cx="225" cy="74" r="24" fill="#0e7490" stroke="#67e8f9" strokeWidth="3"/><text x="225" y="79">ECU</text>
              <circle cx="395" cy="74" r="24" fill="#0e7490" stroke="#67e8f9" strokeWidth="3"/><text x="395" y="79">12V</text>
              <circle cx="310" cy="145" r="28" fill="#155e75" stroke="#67e8f9" strokeWidth="3"/><text x="310" y="150">OBD</text>
              <circle cx="225" cy="215" r="22" fill="#155e75" stroke="#67e8f9" strokeWidth="3"/><text x="225" y="220">IGN</text>
              <circle cx="395" cy="215" r="22" fill="#155e75" stroke="#67e8f9" strokeWidth="3"/><text x="395" y="220">ALT</text>
            </g>
            <text x="310" y="278" textAnchor="middle" fill="#94a3b8" fontSize="12">የማስተማሪያ ሥዕል ነው — እውነተኛ የመኪና 3D ሞዴል አይደለም</text>
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SYSTEMS.map(system => <button key={system.id} onClick={() => setSelected(system)} className={'rounded-lg border p-3 text-left text-sm transition ' + (selected.id === system.id ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30')}>
            <span className="block font-semibold">{system.am}</span><span className="mt-1 block text-xs text-slate-500">{system.en}</span>
          </button>)}
        </div>
        <div className="mt-3 rounded-lg bg-cyan-950/40 p-3 text-sm text-cyan-100"><strong>{selected.en}</strong><p className="mt-1 text-cyan-100/80">{selected.detail}</p>
          <button onClick={() => { setCompleted(prev => prev.includes(selected.id) ? prev : [...prev, selected.id]); void ask('Teach me this system step by step: ' + selected.en + '. Give a safe workshop procedure, tools, expected test results, and a short question.'); }} className="mt-3 rounded-lg bg-cyan-300 px-4 py-2 font-bold text-slate-950">ይህን ሲስተም አስተምረኝ</button>
          {completed.includes(selected.id) && <span className="ml-3 text-xs text-emerald-300">የተጀመረ</span>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-[#0a1118] p-4">
        <h3 className="font-bold text-white">Amharic AI Tutor</h3>
        <div className="my-3 min-h-44 flex-1 whitespace-pre-wrap rounded-lg bg-[#15232e] p-4 text-sm leading-7 text-slate-200">{answer}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => speak(answer)} disabled={speaking} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">መልሱን አንብብ 🔊</button>
          <button onClick={() => window.speechSynthesis?.cancel()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300">ድምፅ አቁም</button>
          <button onClick={startVoice} disabled={listening || busy} className="rounded-lg border border-emerald-300/30 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50">{listening ? 'እየሰማ ነው...' : '🎙 በድምፅ ጠይቅ'}</button>
        </div>
        {voiceStatus && <p className="mt-2 text-xs text-amber-200">{voiceStatus}</p>}
        <form onSubmit={e => { e.preventDefault(); void ask(); }} className="mt-3 flex gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="ጥያቄህን በአማርኛ ጻፍ..." className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#15232e] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"/>
          <button disabled={busy || !question.trim()} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? '...' : 'ላክ'}</button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">የድምፅ መለየትና ማንበብ በብራውዘር/መሣሪያ የአማርኛ ድጋፍ ላይ ይመረኮዛል።</p>
      </div>
    </div>
  </section>;
};
