import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Loading } from '../components/ui/Loading';
import { ErrorState } from '../components/ui/Error';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ServiceRecordForm } from '../components/vehicles/ServiceRecordForm';
import { vehiclesService } from '../services/database/vehicles';
import { serviceHistoryService } from '../services/database/serviceHistory';
import { diagnosticsService } from '../services/database/diagnostics';
import { useAuth } from '../contexts/AuthContext';
import { useStorage } from '../hooks/useStorage';
import { VehicleProfile, ServiceRecord, DiagnosticSession } from '../types';
import {
  ArrowLeft,
  Car,
  Activity,
  Calendar,
  Wrench,
  Trash2,
  Edit3,
  Plus,
  ChevronRight,
  Brain,
  Trash,
  FileText,
  ExternalLink,
  ImageIcon,
  History as HistoryIcon
} from 'lucide-react';
import { MaintenanceTimeline } from '../components/vehicles/MaintenanceTimeline';

export const VehicleDetails = () => {
// ... existing imports ...
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getFilePreview, getFileView, BUCKETS } = useStorage();

  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingService, setIsAddingService] = useState(false);

  const fetchData = async () => {
    if (!vehicleId || !user) return;
    setLoading(true);
    try {
      // 1. Fetch vehicle profile
      const userVehicles = await vehiclesService.listUserVehicles(user.$id);
      const target = userVehicles.find(v => v.$id === vehicleId);

      if (!target) throw new Error('Vehicle not found');
      setVehicle(target);

      // 2. Fetch history in parallel
      const [serviceData, diagnosticData] = await Promise.all([
        serviceHistoryService.listVehicleRecords(vehicleId),
        diagnosticsService.listUserSessions(user.$id) // Filtered locally for now, or add vehicle query support
      ]);

      setServices(serviceData);
      setDiagnostics(diagnosticData.filter(d => d.vehicleId === vehicleId));

    } catch (err: any) {
      setError(err.message || 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vehicleId, user]);

  const handleDeleteVehicle = async () => {
    if (!vehicleId || !window.confirm('Are you sure you want to delete this vehicle? All history will be lost.')) return;
    try {
      await vehiclesService.deleteVehicle(vehicleId);
      navigate('/vehicles');
    } catch (err) {
      alert('Failed to delete vehicle');
    }
  };

  const handleAddService = async (data: any) => {
    if (!user || !vehicleId) return;
    try {
      await serviceHistoryService.addRecord(user.$id, data);
      setIsAddingService(false);
      fetchData();
    } catch (err) {
      alert('Failed to add service record');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await serviceHistoryService.deleteRecord(id);
      fetchData();
    } catch (err) {
      alert('Failed to delete record');
    }
  };

  if (loading) return <Loading message="Opening vehicle profile..." />;
  if (error || !vehicle) return <ErrorState message={error || 'Vehicle not found'} onRetry={() => navigate('/vehicles')} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
           onClick={() => navigate('/vehicles')}
           className="flex items-center gap-2 text-slate-500 hover:text-brand-blue transition-colors mb-8 font-bold"
        >
           <ArrowLeft className="w-4 h-4" /> Back to Garage
        </button>

        <div className="grid lg:grid-cols-3 gap-12">
           {/* Sidebar: Vehicle Identity */}
           <div className="space-y-8">
              <div className="bg-white rounded-3xl border shadow-xl p-8 sticky top-24">
                 {vehicle.imageFileId ? (
                   <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6 shadow-md border">
                      <img src={getFilePreview(BUCKETS.VEHICLES, vehicle.imageFileId)} alt="Vehicle" className="w-full h-full object-cover" />
                   </div>
                 ) : (
                   <div className="w-20 h-20 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mb-6">
                      <Car className="w-10 h-10" />
                   </div>
                 )}
                 <h1 className="text-3xl font-extrabold text-brand-navy mb-2">{vehicle.make} {vehicle.model}</h1>
                 <p className="text-slate-500 mb-8 font-medium">{vehicle.year} • {vehicle.fuelType}</p>

                 <div className="space-y-6">
                    <div className="flex justify-between items-center text-sm py-3 border-b">
                       <span className="text-slate-400 uppercase tracking-tighter font-bold">Engine</span>
                       <span className="text-brand-navy font-bold">{vehicle.engine}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm py-3 border-b">
                       <span className="text-slate-400 uppercase tracking-tighter font-bold">Mileage</span>
                       <span className="text-brand-navy font-bold">{vehicle.mileage.toLocaleString()} KM</span>
                    </div>
                    <div className="flex justify-between items-center text-sm py-3">
                       <span className="text-slate-400 uppercase tracking-tighter font-bold">Health</span>
                       <Badge className="bg-green-500">Optimal</Badge>
                    </div>
                 </div>

                 <div className="mt-12 flex flex-col gap-3">
                    <Button
                      className="w-full py-6 gap-2"
                      onClick={() => navigate('/diagnostics', { state: { vehicleId: vehicle.$id } })}
                    >
                       <Brain className="w-5 h-5" /> Start AI Diagnostic
                    </Button>
                    <div className="flex gap-2">
                       <Button variant="outline" className="flex-1 gap-2">
                          <Edit3 className="w-4 h-4" /> Edit
                       </Button>
                       <Button variant="outline" className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-100" onClick={handleDeleteVehicle}>
                          <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                 </div>
              </div>
           </div>

           {/* Main Content: History */}
           <div className="lg:col-span-2 space-y-12">
              <section>
                 <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-3">
                       <HistoryIcon className="w-6 h-6 text-brand-blue" /> Technical History
                    </h2>
                    <Button size="sm" variant="secondary" className="gap-2" onClick={() => setIsAddingService(true)}>
                       <Plus className="w-4 h-4" /> Add Record
                    </Button>
                 </div>

                 {isAddingService && (
                   <div className="mb-12 bg-white p-8 rounded-3xl border shadow-lg animate-in slide-in-from-top-4 duration-300">
                      <h3 className="text-xl font-bold mb-6">New Maintenance Record</h3>
                      <ServiceRecordForm
                        vehicleId={vehicleId!}
                        onSubmit={handleAddService}
                        onCancel={() => setIsAddingService(false)}
                        loading={loading}
                      />
                   </div>
                 )}

                 <MaintenanceTimeline services={services} diagnostics={diagnostics} />
              </section>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
