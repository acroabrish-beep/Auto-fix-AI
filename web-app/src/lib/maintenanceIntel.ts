import { VehicleProfile, ServiceRecord, DiagnosticSession } from '../types';

export interface MaintenanceReminder {
  id: string;
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  reason: string;
}

export interface HealthScoreResult {
  score: number | null;
  status: 'optimal' | 'fair' | 'attention' | 'unknown';
  label: string;
}

export const calculateVehicleHealth = (
  vehicle: VehicleProfile,
  services: ServiceRecord[],
  diagnostics: DiagnosticSession[]
): HealthScoreResult => {
  if (services.length === 0 && diagnostics.length === 0) {
    return { score: null, status: 'unknown', label: 'Not enough data' };
  }

  let score = 100;

  // Deduct based on diagnostic activity (unresolved issues)
  const activeDiagnostics = diagnostics.filter(d => d.status === 'active').length;
  score -= activeDiagnostics * 15;

  // Deduct based on lack of service history vs mileage
  // Assuming a rough check: every 10k km should have at least 1 service record
  const expectedServices = Math.floor(vehicle.mileage / 10000);
  if (expectedServices > services.length) {
    const missing = expectedServices - services.length;
    score -= Math.min(missing * 10, 40);
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score));

  let status: HealthScoreResult['status'] = 'optimal';
  if (score < 50) status = 'attention';
  else if (score < 80) status = 'fair';

  return {
    score,
    status,
    label: status === 'optimal' ? 'Optimal' : status === 'fair' ? 'Fair' : 'Attention Needed'
  };
};

export const generateReminders = (
  vehicle: VehicleProfile,
  services: ServiceRecord[],
  diagnostics: DiagnosticSession[]
): MaintenanceReminder[] => {
  const reminders: MaintenanceReminder[] = [];

  // Check for recent oil change
  const oilChanges = services.filter(s => s.serviceType.toLowerCase().includes('oil'));
  if (oilChanges.length > 0) {
    const lastOil = new Date(oilChanges[0].date);
    const monthsAgo = (new Date().getTime() - lastOil.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo > 6) {
      reminders.push({
        id: 'oil-overdue',
        type: 'warning',
        title: 'Oil Service Recommended',
        message: `Last oil service was ${Math.floor(monthsAgo)} months ago.`,
        reason: 'Regular oil changes extend engine life.'
      });
    }
  } else {
    reminders.push({
      id: 'no-service-history',
      type: 'info',
      title: 'No Service History',
      message: 'Service history is limited.',
      reason: 'Recording maintenance helps track your vehicle\'s health score.'
    });
  }

  // Check for active diagnostics
  if (diagnostics.some(d => d.status === 'active')) {
    reminders.push({
      id: 'active-diagnostic',
      type: 'critical',
      title: 'Active Diagnostic Issue',
      message: 'Your vehicle has unresolved diagnostic activity.',
      reason: 'AI analysis identified potential faults that require attention.'
    });
  }

  return reminders;
};
