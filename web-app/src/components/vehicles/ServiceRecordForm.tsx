import React, { useState, useRef } from 'react';
import { ServiceRecord } from '../../types';
import { Button } from '../ui/Button';
import { Loader2, Calendar, Paperclip, X, FileText } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';

interface ServiceRecordFormProps {
  vehicleId: string;
  initialData?: Partial<ServiceRecord>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const ServiceRecordForm: React.FC<ServiceRecordFormProps> = ({
  vehicleId,
  initialData,
  onSubmit,
  onCancel,
  loading
}) => {
  const { uploadFile, BUCKETS } = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFileId, setAttachmentFileId] = useState(initialData?.attachmentFileId || '');
  const [uploadingFile, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    vehicleId,
    serviceType: initialData?.serviceType || 'Maintenance',
    description: initialData?.description || '',
    mileage: initialData?.mileage || 0,
    cost: initialData?.cost || 0,
    provider: initialData?.provider || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    notes: initialData?.notes || ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const response = await uploadFile(BUCKETS.SERVICE_RECEIPTS, file);
      setAttachmentFileId(response.$id);
    } catch (err) {
      alert('File upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'mileage' || name === 'cost' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...formData, attachmentFileId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Service Type</label>
          <select
            name="serviceType"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none bg-white"
            value={formData.serviceType}
            onChange={handleChange}
          >
            <option>Oil Change</option>
            <option>Brake Service</option>
            <option>Tire Rotation</option>
            <option>Battery Replacement</option>
            <option>Engine Diagnostic</option>
            <option>General Maintenance</option>
            <option>Repair</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
             <Calendar className="w-4 h-4" /> Date
          </label>
          <input
            name="date"
            type="date"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            value={formData.date}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Short Description</label>
        <input
          name="description"
          required
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
          placeholder="Brief summary of work done"
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Mileage</label>
          <input
            name="mileage"
            type="number"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            value={formData.mileage}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Cost</label>
          <input
            name="cost"
            type="number"
            step="0.01"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            value={formData.cost}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Provider</label>
          <input
            name="provider"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
            placeholder="Service center name"
            value={formData.provider}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center justify-between">
           <span>Notes</span>
           <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-brand-blue hover:underline flex items-center gap-1 font-bold"
           >
              <Paperclip className="w-3 h-3" /> Attach Receipt
           </button>
        </label>

        {attachmentFileId && (
          <div className="mb-3 p-3 bg-slate-50 rounded-xl border flex items-center justify-between">
             <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase">
                <FileText className="w-4 h-4 text-brand-blue" /> Document Attached
             </div>
             <button type="button" onClick={() => setAttachmentFileId('')} className="text-red-500 hover:text-red-600">
                <X className="w-4 h-4" />
             </button>
          </div>
        )}
        {uploadingFile && <div className="mb-3 text-xs text-brand-blue animate-pulse font-bold">Uploading attachment...</div>}

        <textarea
          name="notes"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none min-h-[100px]"
          placeholder="Additional details, parts used, etc."
          value={formData.notes}
          onChange={handleChange}
        />
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />

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
          {initialData?.$id ? 'Update Record' : 'Save Record'}
        </Button>
      </div>
    </form>
  );
};
