import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { vehiclesService } from '../../services/database/vehicles';
import { useAuth } from '../../contexts/AuthContext';
import { VehicleProfile, DiagnosticRequest } from '../../types';
import { Button } from '../ui/Button';
import { Car, ChevronRight, AlertCircle } from 'lucide-react';

interface DiagnosticFormProps {
  onSubmit: (request: DiagnosticRequest) => Promise<any>;
  loading: boolean;
}

export const DiagnosticForm: React.FC<DiagnosticFormProps> = ({ onSubmit, loading }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [vehicles, setVehicles] = useState<VehicleProfile[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(location.state?.vehicleId || '');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [warningLights, setWarningLights] = useState<string[]>([]);
  const [timing, setTiming] = useState('Recently');

  useEffect(() => {
    if (user) {
      vehiclesService.listUserVehicles(user.$id).then(setVehicles);
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;

    onSubmit({
      vehicleId: selectedVehicleId,
      description,
      symptoms,
      timing,
      warningLights
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 lg:p-12 rounded-3xl shadow-xl border">
      <div>
        <h3 className="text-xl font-bold text-brand-navy mb-6 flex items-center gap-2">
          <Car className="w-6 h-6 text-brand-teal" /> 1. Select Vehicle
        </h3>
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vehicles.map((v) => (
              <button
                key={v.$id}
                type="button"
                onClick={() => setSelectedVehicleId(v.$id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  selectedVehicleId === v.$id
                  ? 'border-brand-blue bg-brand-blue/5'
                  : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="font-bold text-slate-900">{v.make} {v.model}</div>
                <div className="text-xs text-slate-500">{v.year} • {v.engine}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed text-center">
            <p className="text-slate-500 mb-4">No vehicles added to your profile.</p>
            <Button variant="outline" size="sm" type="button">Add Vehicle First</Button>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-xl font-bold text-brand-navy mb-6">2. Describe the Problem</h3>
        <textarea
          required
          className="w-full min-h-[150px] p-6 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-blue outline-none text-slate-700 placeholder:text-slate-400"
          placeholder="Example: My car makes a loud grinding noise when I apply the brakes, specifically from the front left wheel..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="pt-8 border-t border-slate-100 grid md:grid-cols-2 gap-12">
         <div>
            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">When did it start?</label>
            <select
              className="w-full p-4 rounded-xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-brand-blue"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
            >
               <option>Recently</option>
               <option>A few days ago</option>
               <option>More than a week ago</option>
               <option>Intermittent problem</option>
            </select>
         </div>
         <div>
            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Warning Lights</label>
            <div className="flex flex-wrap gap-3">
               {['Check Engine', 'ABS', 'Battery', 'Oil', 'Brake'].map(light => (
                 <button
                    key={light}
                    type="button"
                    onClick={() => {
                      setWarningLights(prev =>
                        prev.includes(light) ? prev.filter(l => l !== light) : [...prev, light]
                      )
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      warningLights.includes(light)
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                 >
                    {light}
                 </button>
               ))}
            </div>
         </div>
      </div>

      <div className="pt-12">
        <Button
          type="submit"
          size="lg"
          className="w-full py-8 text-xl shadow-xl shadow-brand-blue/20"
          disabled={loading || !selectedVehicleId || !description}
        >
          {loading ? 'Analyzing...' : 'Start AI Diagnostic'} <ChevronRight className="ml-2 w-6 h-6" />
        </Button>
        <p className="text-center text-slate-400 text-xs mt-6 flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" /> informational guidance only
        </p>
      </div>
    </form>
  );
};
