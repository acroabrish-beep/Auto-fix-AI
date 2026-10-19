import React, { useState, useRef } from 'react';
import { VehicleProfile } from '../../types';
import { Button } from '../ui/Button';
import { Loader2, Camera, X } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';

interface VehicleFormProps {
  initialData?: Partial<VehicleProfile>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const VehicleForm: React.FC<VehicleFormProps> = ({ initialData, onSubmit, onCancel, loading }) => {
  const { uploadFile, getFilePreview, BUCKETS } = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFileId, setImageFileId] = useState(initialData?.imageFileId || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    make: initialData?.make || '',
    model: initialData?.model || '',
    year: initialData?.year || new Date().getFullYear(),
    engine: initialData?.engine || '',
    fuelType: initialData?.fuelType || 'Petrol',
    mileage: initialData?.mileage || 0,
    notes: initialData?.notes || ''
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const response = await uploadFile(BUCKETS.VEHICLES, file);
      setImageFileId(response.$id);
    } catch (err) {
      alert('Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'mileage' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...formData, imageFileId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Image Upload Area */}
      <div className="flex justify-center mb-8">
         <div className="relative group">
            <div className="w-40 h-28 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
               {imageFileId ? (
                 <img src={getFilePreview(BUCKETS.VEHICLES, imageFileId)} className="w-full h-full object-cover" alt="Vehicle" />
               ) : (
                 <Camera className="w-8 h-8 text-slate-300" />
               )}
               {uploadingImage && (
                 <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
                 </div>
               )}
            </div>
            <button
               type="button"
               onClick={() => fileInputRef.current?.click()}
               className="absolute -bottom-2 -right-2 p-2 bg-brand-blue text-white rounded-xl shadow-lg border-2 border-white hover:bg-brand-blue/90"
            >
               <Camera className="w-4 h-4" />
            </button>
            {imageFileId && (
               <button
                  type="button"
                  onClick={() => setImageFileId('')}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md border-2 border-white"
               >
                  <X className="w-3 h-3" />
               </button>
            )}
         </div>
      </div>

      <input
         type="file"
         ref={fileInputRef}
         className="hidden"
         accept="image/*"
         onChange={handleImageChange}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Make</label>
          <input
            name="make"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            placeholder="e.g. Toyota"
            value={formData.make}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Model</label>
          <input
            name="model"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            placeholder="e.g. Corolla"
            value={formData.model}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Year</label>
          <input
            name="year"
            type="number"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            value={formData.year}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Fuel Type</label>
          <select
            name="fuelType"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none bg-white"
            value={formData.fuelType}
            onChange={handleChange}
          >
            <option>Petrol</option>
            <option>Diesel</option>
            <option>Electric</option>
            <option>Hybrid</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Mileage (KM)</label>
          <input
            name="mileage"
            type="number"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            value={formData.mileage}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Engine Details</label>
        <input
          name="engine"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
          placeholder="e.g. 1.8L 4-Cylinder"
          value={formData.engine}
          onChange={handleChange}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Notes</label>
        <textarea
          name="notes"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none min-h-[100px]"
          placeholder="Any additional details..."
          value={formData.notes}
          onChange={handleChange}
        />
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {initialData?.$id ? 'Save Changes' : 'Add Vehicle'}
        </Button>
      </div>
    </form>
  );
};
