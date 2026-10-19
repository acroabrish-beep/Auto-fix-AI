import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

export const SafetyNotice: React.FC = () => {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl my-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-amber-800 font-bold text-sm uppercase tracking-wide">Safety & Disclaimer</h4>
          <p className="text-amber-700 text-sm leading-relaxed mt-1">
            AI-generated guidance is for educational and troubleshooting purposes only.
            Automotive repair can be dangerous. Always follow manufacturer procedures,
            wear appropriate safety gear, and consult a qualified technician when necessary.
          </p>
        </div>
      </div>
    </div>
  );
};

export const AIConfigurationNotice: React.FC = () => (
  <div className="bg-slate-100 border border-slate-200 p-8 rounded-3xl text-center max-w-lg mx-auto my-12">
    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
      <Info className="w-6 h-6 text-slate-400" />
    </div>
    <h3 className="text-lg font-bold text-slate-900">AI diagnostics is not configured yet</h3>
    <p className="text-slate-500 text-sm mt-2">
      The server-side AI provider has not been connected. Please contact your administrator or check the Appwrite Function configuration.
    </p>
  </div>
);
