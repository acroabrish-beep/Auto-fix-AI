import { Models } from 'appwrite';

export type UserRole = 'student' | 'mechanic' | 'teacher' | 'vehicle_owner' | 'admin' | 'global_admin' | 'tvet_admin' | 'department_admin' | 'instructor' | 'garage_admin';

export interface User extends Models.User<Models.Preferences> {
  role?: UserRole;
}

export interface UserProfile extends Models.Document {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  avatarFileId?: string;
  preferredLanguage: string;
  institutionId?: string;
  departmentId?: string;
  garageId?: string;
  phone?: string;
  specialization?: string;
  status?: string;
}

export interface Department extends Models.Document {
  name: string;
  institutionId: string;
  headId: string;
}

export interface Program extends Models.Document {
  name: string;
  departmentId: string;
  institutionId: string;
  level: string;
}

export interface LearningModule extends Models.Document {
  programId?: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail?: string;
  content?: string;
  /** Duration label stored in the `duration` attribute, e.g. "45 min". */
  duration?: string;
  /** Legacy fallback used when `duration` is absent. */
  estimatedMinutes?: number;
  /** Optional â€” the current collection has no publish flag. */
  isPublished?: boolean;
  /** JSON string containing translations for all languages: { en: { title, description, content }, am: { ... }, om: { ... }, sid: { ... } } */
  translations?: string;
}

export interface LearningProgress extends Models.Document {
  userId: string;
  moduleId: string;
  progressPercent: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
}

// Interactive automotive lab definitions.
export interface LabExercise {
  id: string;
  moduleId: string;
  title: string;
  objective: string;
  scenario: FaultScenarioKey;
  steps: LabStep[];
  passScore: number;
}

export interface LabStep {
  instruction: string;
  requiredAction: 'mode' | 'range' | 'probes' | 'interpretation';
  expectedMode?: MultimeterMode;
  expectedRange?: number;
  acceptableRange?: { min: number; max: number };
  hint: string;
  points: number;
}

export type MultimeterMode = 'dc_voltage' | 'resistance' | 'continuity';

export interface MultimeterReading {
  voltage?: number;
  resistance?: number;
  continuity?: boolean;
  noise: number;
  rawValue: number;
}

export interface LabAttemptInput {
  userId: string;
  moduleId: string;
  exerciseId: string;
  score: number;
  durationSec: number;
  mistakes: number;
  passed: boolean;
  completedAt: string;
}

export interface LabAttempt extends Models.Row {
  userId: string;
  moduleId: string;
  exerciseId: string;
  score: number;
  durationSec: number;
  mistakes: number;
  passed: boolean;
  completedAt: string;
}

// Educational sample values only; these are not live vehicle measurements.
export const FAULT_SCENARIOS = {
  healthy: {
    batteryResting: 12.6,
    crankingVoltage: 10.2,
    chargingVoltage: 14.4,
    description: 'Healthy battery and charging system',
  },
  weakBattery: {
    batteryResting: 12.2,
    crankingVoltage: 9.8,
    chargingVoltage: 13.5,
    description: 'Weak battery - low resting voltage',
  },
  badAlternator: {
    batteryResting: 12.5,
    crankingVoltage: 10.1,
    chargingVoltage: 12.8,
    description: 'Bad alternator - low charging voltage',
  },
  looseTerminal: {
    batteryResting: 12.3,
    crankingVoltage: 9.5,
    chargingVoltage: 13.2,
    description: 'Loose terminal - possible intermittent connection',
  },
} as const;

export type FaultScenarioKey = keyof typeof FAULT_SCENARIOS;

export interface VehicleProfile extends Models.Document {
  userId: string;
  institutionId?: string;
  make: string;
  model: string;
  /** Stored as a string in the `vehicles` collection. */
  year: number | string;
  engine?: string;
  /** Not stored by the current `vehicles` collection; kept optional for legacy UI. */
  fuelType?: string;
  /** Not stored by the current `vehicles` collection; kept optional for legacy UI. */
  mileage?: number;
  notes?: string;
  imageFileId?: string;
}

/**
 * Vehicle saved from the free-text "Add Vehicle" form.
 * Stored in the `vehicles` collection.
 */
export interface UserVehicle extends Models.Document {
  userId: string;
  make: string;
  model: string;
  year: string;
  engine?: string;
}

export interface PossibleCause {
  title: string;
  description: string;
  probability: number;
}

export interface RecommendedCheck {
  title: string;
  description: string;
  toolsRequired?: string[];
}

export interface DiagnosticResponse {
  summary: string;
  possibleCauses: PossibleCause[];
  recommendedChecks: RecommendedCheck[];
  nextSteps: string[];
  safetyNotes: string[];
  confidence: number;
  disclaimer: string;
}

export interface DiagnosticRequest {
  vehicleId: string;
  description: string;
  symptoms: string[];
  timing: string;
  warningLights: string[];
  recentRepairs?: string;
}

export interface DiagnosticSession extends Models.Document {
  userId: string;
  institutionId?: string;
  vehicleId: string;
  description: string;
  aiResponse: string;
  // Parsed/client-side fields (derived from the stored attributes above)
  userInput: string;
  requestData: DiagnosticRequest;
  result: DiagnosticResponse;
  status: 'active' | 'resolved';
}

export interface School extends Models.Document {
  name: string;
  location: string;
  adminId: string;
  status: string;
}

export interface Garage extends Models.Document {
  name: string;
  location: string;
  ownerId: string;
  status: string;
}

export interface CourseMaterial extends Models.Document {
  title: string;
  description: string;
  fileId: string;
  bucketId: string;
  courseId: string;
  institutionId: string;
  instructorId: string;
}

export interface Submission extends Models.Document {
  assignmentId: string;
  institutionId?: string;
  studentId: string;
  studentName: string;
  content: string;
  status: 'pending' | 'graded';
  grade: string;
  feedback: string;
  submittedAt: string;
}

export interface Assignment extends Models.Document {
  title: string;
  description: string;
  courseId: string;
  instructorId: string;
  institutionId?: string;
  dueDate: string;
}

export interface Certificate extends Models.Document {
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  issueDate: string;
  certificateUrl: string;
}

export interface Payment extends Models.Document {
  institutionId: string;
  amount: string;
  date: string;
  status: string;
}

export interface ServiceRequest extends Models.Document {
  title: string;
  description: string;
  vehicleId: string;
  garageId: string;
  status: string;
  createdAt: string;
  assignedMechanicId?: string;
  finalCost?: string;
  notes?: string;
}

export interface AuditLog extends Models.Document {
  actorId: string;
  action: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface Application extends Models.Document {
  type: 'school' | 'garage';
  applicantId: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface RepairGuide extends Models.Document {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  steps: string[]; // JSONB-like array of steps
  safetyNotes?: string;
  requiredTools?: string[];
  /** Optional estimated time to complete the procedure; UI falls back to 30 when absent. */
  estimatedMinutes?: number;
}

export interface ServiceRecord extends Models.Document {
  userId: string;
  vehicleId: string;
  serviceType: string;
  description?: string;
  mileage?: number;
  cost?: number;
  provider?: string;
  date: string;
  notes?: string;
  attachmentFileId?: string;
}

export interface ChatRecord extends Models.Document {
  userId: string;
  userMessage: string;
  aiResponse: string;
}

export interface DiagnosticResult {
  symptoms: string[];
  possible_causes: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: 'electrical' | 'mechanical' | 'diagnostics' | 'electronics';
  level: 'beginner' | 'intermediate' | 'advanced';
}


