# AutoFix AI — Stage 1: Read-only Architecture and Integration Assessment

## 1. Current Frontend Framework, Routing, UI Conventions, and Navigation

**Framework**: React (with TypeScript) + Vite build tool
- `package.json` confirms React ecosystem
- `vite.config.ts` for development/build
- `tailwind.config.js` for styling

**Routing**: `react-router-dom` with BrowserRouter
- `App.tsx` defines all routes:
  - Public: `/`, `/login`, `/register`, `/forgot-password`
  - Protected (JWT-authenticated): `/dashboard`, `/learning`, `/learning/:moduleId`, `/lab/:moduleId`, `/diagnostics`, `/diagnostics/history`, `/vehicles`, `/vehicles/add`, `/vehicles/:vehicleId`, `/vehicle-details`, `/settings`, `/repairs`, `/repairs/:guideId`, `/search`
  - Admin roles: `/admin/*` (global_admin), `/school-admin/*` (tvet_admin), `/department-admin/*` (department_admin), `/instructor/*` (instructor), `/student/*` (student), `/garage-admin/*` (garage_admin), `/mechanic/*` (mechanic)
- `ProtectedRoute` component handles role-based access

**UI Component Conventions**:
- Tailwind CSS for styling
- `lucide-react` for icons (Activity, Gauge, BatteryCharging, Zap, ShieldCheck, etc.)
- `react-i18next` for internationalization
- UI components in `web-app/src/components/ui/` (Button, etc.)
- Section components in `web-app/src/sections/`
- Page components in `web-app/src/pages/`
- Consistent dark theme: `bg-[#0b1015]`, `text-slate-100`, etc.

**Key Existing Pages**:
- `VirtualLab.tsx` — Already present! Simulates automotive electrical system readings
- `Diagnostics.tsx` — AI diagnostic service
- `DiagnosticHistory.tsx` — History of diagnostics
- `LearningModule.tsx` — Learning content
- `Learning.tsx` — Learning path
- `Dashboard.tsx` — Main dashboard
- Role-specific dashboards: Student, Instructor, Department Admin, Global Admin, Mechanic, Garage Admin

## 2. Existing Role Handling

**5 Roles defined and handled** (from `types/index.ts` and `App.tsx`):

| Role | Routes | Key Capabilities |
|------|--------|-----------------|
| **student** | `/student/*` | Dashboard, learning modules, virtual lab, diagnostics |
| **instructor** | `/instructor/*` | Dashboard, course materials, enrollment management |
| **department_admin** | `/department-admin/*` | Department-scoped dashboard |
| **global_admin** | `/admin/*` | Institution-wide access |
| **mechanic** | `/mechanic/*` | Garage-focused tools |

**Role mapping from `types/index.ts`**:
```
UserRole = 'student' | 'mechanic' | 'teacher' | 'vehicle_owner' | 'admin' | 'global_admin' | 'tvet_admin' | 'department_admin' | 'instructor' | 'garage_admin'
```

**Authorization scheme** (from `diagnostic-ai/index.js`):
- `LEARNING_ROLES` set: student, instructor, teacher, department_admin, global_admin, tvet_admin, admin
- `MATERIAL_MANAGER_ROLES` set: instructor, teacher, department_admin, global_admin, tvet_admin, admin
- `SELF_ACTIONS` set: ensure_my_profile, update_my_profile
- Profile ownership is strictly server-enforced — client-supplied role/JWT values never trusted
- Course materials scoped to institution
- Enrollments have institution/department scoping
- Admin actions (change_role, suspend_user, etc.) require global_admin

**Role-based route protection** (from `App.tsx`):
- `ProtectedRoute allowedRoles={['student']}` → student routes only
- `ProtectedRoute allowedRoles={['instructor']}` → instructor routes only
- `ProtectedRoute allowedRoles={['department_admin']}` → department admin routes only
- `ProtectedRoute allowedRoles={['global_admin']}` → admin routes only

## 3. Existing LMS Models and Appwrite TablesDB Collections

**Appwrite Collections (from `types/index.ts` and `diagnostic-ai/index.js`)**:

| Collection | Key Fields | Purpose |
|------------|-----------|---------|
| `profiles` | userId, fullName, email, role, institutionId, departmentId, garageId, phone, specialization, status | User profiles with role scoping |
| `learning_modules` | name, departmentId, institutionId, level, thumbnail, isPublished | Course/module catalog |
| `programs` | name, departmentId, institutionId, level | Academic programs |
| `course_materials` | title, description, fileId, bucketId, courseId, institutionId, instructorId | Course material uploads and access |
| `enrollments` | studentId, courseId, institutionId, departmentId, enrolledAt, status | Course enrollments with scoping |
| `audit_logs` | actorId, action, targetId, details, timestamp | Audit trail |
| `applications` | type (school/garage), applicantId, details, status | Institution/garage applications |
| `schools` | name, location, adminId, status | School records |
| `garages` | name, location, ownerId, status | Garage records |
| `assignments` | title, description, courseId, instructorId, institutionId, dueDate | Assignment tracking |
| `certificates` | studentId, studentName, courseId, courseName, issueDate, certificateUrl | Certificate generation |
| `payments` | institutionId, amount, date, status | Payment tracking |
| `service_history` | userId, vehicleId, serviceType, description, mileage, cost, provider, date, notes, attachmentFileId | Service records |
| `user_vehicles` | userId, make, model, year, engine | User's vehicles |
| `vehicles` | make, model, year, engine, fuelType, mileage | Vehicle registry |
| `possible_causes` | title, description, probability | Diagnostic causes |
| `recommended_checks` | title, description, toolsRequired | Recommended diagnostic checks |
| `diagnostic_sessions` | userId, institutionId, vehicleId, description, aiResponse, userInput, requestData, result, status | Diagnostic session tracking |
| `chat_records` | userId, userMessage, aiResponse | Chat history |

**Diagnostic Data Model** (from `types/index.ts`):
- `DiagnosticRequest`: vehicleId, description, symptoms, timing, warningLights, recentRepairs
- `DiagnosticResponse`: summary, possibleCauses (PossibleCause[]), recommendedChecks (RecommendedCheck[]), nextSteps, safetyNotes, confidence, disclaimer
- `PossibleCause`: title, description, probability
- `RecommendedCheck`: title, description, toolsRequired
- `DiagnosticSession`: userId, institutionId, vehicleId, description, aiResponse, userInput, requestData, result, status

**Chat AI** (from `functions/chat-ai/index.js`):
- JWT-verified profiles with server-only writes
- Atomic distributed rate limiter with `incrementRowColumn` and `max: 30`
- Multi-format document extraction with ZIP bomb protection
- Gemini API fallback with clear distinguishability

## 4. Existing AI Tutor and Diagnostic Services

**Diagnostic AI Function** (`functions/diagnostic-ai/index.js`):
- Handles trusted profile provisioning and account-management actions
- Course-material metadata and private file access actions
- Automotive diagnostics: structured JSON responses from Gemini API
- Security: JWT verification, role-based authorization, institution scoping
- `runDiagnostic(payload)`: Sends prompt to Gemini API, returns structured JSON with summary, possible causes, recommended checks, next steps, safety notes, confidence, disclaimer
- Actions: `ensure_my_profile`, `update_my_profile`, `create_managed_profile`, material CRUD, admin actions, enrollment management

**Chat AI Function** (`functions/chat-ai/index.js`):
- Secure proxy between chat UI and OpenAI/Gemini
- JWT verification via Appwrite account API
- Atomic distributed rate limiting with `incrementRowColumn` and `max: 30`
- Window reset logic for 60-second windows
- Multi-format document extraction (PDF→PDF, DOCX→DOCX, PPTX→PPTX, TXT→TXT) with ZIP bomb protection (2 MB/entry, 50 k chars)
- Gemini API fallback with clear distinguishability (successful reply vs. fallback text)
- Privacy: only operational metadata logged, never message content, JWTs, or API keys

**AI Integration Points** (frontend → backend):
- `/api/discuss` — Chat AI endpoint (via chat-ai function)
- `/api/diagnostic` — Diagnostic endpoint (via diagnostic-ai function)
- Both require authenticated Appwrite JWT
- Both enforce rate limiting
- Both return structured data for frontend consumption

## 5. Existing Simulator, Charting Library, or Reusable Gauge Component

**YES — Virtual Lab already present** (`VirtualLab.tsx`):

**Key features**:
- Uses `lucide-react` `Gauge` component for dashboard-style display
- `LabReading` type: `{ titleKey, value, detailKey, tone: 'green' | 'amber' }`
- Simulated readings with `testVoltage()` → `'12.6 V'` (green)
- `readObdCodes()` → `'P0301'` (amber)
- Gauge display: `{'reading?.value ?? '---'}` in large font
- Test buttons: Battery voltage test, OBD code reader
- Safety section with 3 safety rules
- Sequence steps (01, 02, 03)
- Output display with CheckCircle2/Zap icons
- Multimeter diagram with probe status

**Current simulated data** (hardcoded, not real OBD-II):
- Battery voltage: `'12.6 V'` (green/tone=healthy)
- OBD code: `'P0301'` (amber/tone=caution)
- Values are clearly labeled as simulated/test data

**Other charting/gauge context**:
- No external charting libraries (Chart.js, etc.) — only `lucide-react` Gauge icon
- All simulations are client-side, hardcoded values
- No real hardware integration

## 5. Proposed Virtual Lab Architecture (Fitting Current Codebase)

**Architecture: Enhance existing VirtualLab.tsx without replacing**

The existing `VirtualLab.tsx` provides an excellent foundation. The proposed architecture enhances it while preserving all existing systems:

### Core Principles:
1. **Preserve existing `VirtualLab.tsx`** — keep current structure, only add new fault scenarios
2. **Leverage existing role-based access** — `/lab/:moduleId` already protected by `ProtectedRoute`
3. **Use existing AI diagnostic services** — integrate with `diagnostic-ai` function for fault analysis
4. **Use existing state management** — React `useState` for reading state, `useTranslation` for i18n
5. **Use existing styling conventions** — Tailwind CSS, lucide-react icons, dark theme

### Enhanced Virtual Lab Structure:

```
VirtualLab Module Space (/lab/:moduleId)
├── Module Header (title, intro, online badge) — already present
├── Dashboard Section — already present (Gauge + multimeter diagram)
├── Test Controls — already present (Battery voltage test, OBD code reader)
├── Output Display — already present (CheckCircle2/Zap with title/detail)
├── Safety Section — already present (3 safety rules)
├── Sequence Steps — already present (01, 02, 03)
├── Fault Scenarios (NEW) — 4 scenarios with simulated data
│   1. Weak Battery — voltage ~11.8V, amber tone
│   2. Overheating — temperature simulation, amber tone
│   3. Charging-System Fault — voltage variation, amber tone
│   4. Sensor Fault — intermittent readings, amber tone
├── Guided Diagnosis — NEW — hints, feedback, "I need help" button
├── Student Progress Tracking — conditional (see Section 7)
└── Instructor Assessment — conditional (see Section 7)
```

### Integration Points:
- **AI Diagnostics**: When user selects "I need help", call `diagnostic-ai` `runDiagnostic` with current symptoms
- **Rate Limiting**: Shared `chat-ai` rate limiter persists across Function instances
- **Auth**: JWT verified via ` ProtectedRoute` — same as other pages
- **Data Persistence**: `DiagnosticSession` collection could track progress (existing model)

## 6. Minimal First Release

### Core Features (already partially present in VirtualLab.tsx):

1. **RPM Simulation** — Tachometer-style display with simulated RPM value
2. **Vehicle Speed Simulation** — Speedometer-style display with simulated speed value
3. **Coolant Temperature Simulation** — Temperature gauge with realistic range
4. **Battery Voltage Simulation** — Already present (12.6 V green, can add 11.8V amber)
5. **Clearly Labeled Simulated Data** — All values labeled as "SIMULATED" or "TEST MODE"
6. **Four Educational Fault Scenarios**:
   - Weak Battery — voltage below threshold, warning indicators
   - Overheating — temperature above threshold, warning indicators
   - Charging-System Fault — voltage not charging properly
   - Sensor Fault — intermittent/erratic readings
7. **Guided Diagnosis with Hints and Feedback**:
   - "I need help" button → calls diagnostic-ai function
   - Hints available per scenario
   - Feedback on user's diagnostic choices
8. **Student Progress and Instructor Assessment**:
   - Only if existing authorization/data models safely support them
   - `DiagnosticSession` collection already tracks sessions
   - `enrollments` collection tracks course enrollment
   - `learning_progress` collection tracks module progress
   - Can build on existing models without compromising security

### Minimal Implementation Scope:

**Files likely to change** (minor enhancements, not replacements):
- `web-app/src/pages/VirtualLab.tsx` — Add fault scenario logic, hints, feedback
- `web-app/src/types/index.ts` — Add fault scenario types if needed
- `functions/diagnostic-ai/index.js` — May add new action or extend `runDiagnostic`
- `web-app/src/components/ui/` — May add new button variants
- `web-app/src/sections/` — May add new section components

**Tests required**:
- Existing tests from stages 2.3.6–2.3.18 should continue passing
- New tests for fault scenario behavior
- New tests for hint/feedback interaction
- New tests for AI diagnostic integration

**Security considerations** (no new risks introduced):
- All existing JWT verification remains in place
- Rate limiter unchanged
- Role-based access unchanged
- No new API endpoints that bypass authorization
- Simulated data clearly labeled (never represented as real OBD-II)
- AI diagnostic integration follows same security patterns as existing `/api/diagnostic`

## 7. Phased Implementation Plan

### Phase 1: Enhance Virtual Lab (Weeks 1-2)
**Files to modify**:
- `web-app/src/pages/VirtualLab.tsx` — Add 4 fault scenarios, gauge updates, hint/feedback UI
- `web-app/src/types/index.ts` — Add types for fault scenarios if needed (likely not needed, use existing patterns)

**Features**:
- 4 fault scenarios with simulated gauge values
- "Test component" buttons for each scenario
- "I need help" → calls diagnostic-ai with scenario-specific prompt
- Hints available per scenario
- Feedback on diagnostic choices
- Clear "SIMULATED" labels on all values

**Tests**:
- Existing test suite passes (35/35)
- Manual testing of each fault scenario
- AI diagnostic integration test (mock Gemini API)

**Security considerations**:
- No changes to auth/rate limiter/authorization
- Simulated values clearly marked
- AI diagnostic follows existing patterns

### Phase 2: Student Progress & Instructor Assessment (Weeks 3-4) — *Only if models safely support*
**Files to modify**:
- `web-app/src/types/index.ts` — Add `learning_progress` fields if needed
- `functions/diagnostic-ai/index.js` — May add `record_diagnostic_session` action
- `web-app/src/pages/student/StudentDashboard.tsx` — Add progress tracking
- `web-app/src/pages/instructor/InstructorDashboard.tsx` — Add assessment views

**Features**:
- Track which fault scenarios student completed
- Instructor can view student diagnostic history
- Progress percentages per module
- Assessment feedback from instructor

**Tests**:
- Existing test suite passes
- New tests for progress tracking
- New tests for instructor assessment views

**Security considerations**:
- Existing role-based access controls apply
- Student can only view own progress
- Instructor can only view students in their department/course
- No data leakage between roles

### Phase 3: Charting Library Integration (Optional, Weeks 5-6)
**Files to modify**:
- `web-app/src/components/` — Add Chart.js or similar component
- `VirtualLab.tsx` — Integrate gauges with charting library

**Features**:
- Replace `lucide-react` Gauge with animated Chart.js gauges
- Real-time simulation updates
- Historical data tracking visualization

**Tests**:
- Existing test suite passes
- Chart rendering tests
- Data update tests

**Security considerations**:
- No new security risks (charting is purely client-side visualization)
- Existing auth/rate limiter still apply

## 8. Risks and Gaps

### Identified Risks:
1. **Virtual Lab already exists** but may need enhanced fault scenarios — LOW risk, foundation is solid
2. **AI diagnostic integration** — need to ensure Gemini API key is configured — MEDIUM risk (configured in function env)
3. **Role-based access** must not be bypassed — LOW risk, existing scheme is thorough
4. **Simulated data not confused with real OBD-II** — LOW risk, clear labeling already in place
5. **Rate limiter** must persist across Function instances — LOW risk, already verified atomic

### Identified Gaps:
1. **Only 1 fault scenario currently implemented** (battery test) — need 3 more (overheating, charging-system, sensor)
2. **No guided diagnosis flow** — "I need help" button needs AI integration
3. **No progress tracking** — student completion data not persisted beyond session
4. **Instructor assessment views** not present — would need new dashboard enhancements

### Recommendations:
1. **Start with Phase 1** — Enhance existing VirtualLab.tsx with 4 fault scenarios and guided diagnosis
2. **Leverage existing AI diagnostic service** — `diagnostic-ai` function already has structured response format
3. **Build on existing data models** — `DiagnosticSession`, `enrollments`, `learning_progress` already exist
4. **Preserve all current authorization** — No changes to role checks or JWT verification
5. **Clear labeling** — All simulated values must have "SIMULATED" or "TEST MODE" disclaimer

## 8. Next Stage Recommendation

**Proceed to Stage 2** — Implement Phase 1 enhancements to Virtual Lab with:
- 4 educational fault scenarios with simulated gauge values
- "I need help" → diagnostic-ai integration with hints and feedback
- Clear "SIMULATED" labeling on all values
- Maintain all existing role-based access and rate limiting

No files should be modified, deleted, or created for this assessment phase. The report is based entirely on read-only inspection of the existing codebase.