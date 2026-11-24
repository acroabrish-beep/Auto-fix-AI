# AutoFix AI — Stage 2.2: Read-Only Verification (Pre-Implementation)

## 1. Current Authentication and Profile Model (Inspection Only)

### Appwrite JWT Authentication
- **Verified via**: `fetch(`${endpoint}/account`, { headers: { 'X-Appwrite-JWT': jwt } })`
- **User ID extracted from**: `account.$id` (the verified Appwrite user ID)
- **Never trusted**: client-supplied user IDs, institution IDs, department IDs, or roles
- **Profile lookup**: `findProfile(userId)` → queries `profiles` collection by `userId`
- **Profile by email**: `findProfileByEmail(email)` → queries `profiles` collection by `email`

### Profile Model (from `types/index.ts`)
```typescript
export interface UserProfile extends Models.Document {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;  // 'student' | 'mechanic' | 'teacher' | 'vehicle_owner' | 'admin' | 'global_admin' | 'tvet_admin' | 'department_admin' | 'instructor' | 'garage_admin'
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
```

### Key Authorization Constraints (from `diagnostic-ai/index.js`)
- **`LEARNING_ROLES`**: student, instructor, teacher, department_admin, global_admin, tvet_admin, admin
- **`MATERIAL_MANAGER_ROLES`**: instructor, teacher, department_admin, global_admin, tvet_admin, admin
- **`SELF_ACTIONS`**: ensure_my_profile, update_my_profile
- **`MANAGED_PROFILE_ROLES`**: 
  - tvet_admin: [instructor, student]
  - department_admin: [instructor, student]
  - garage_admin: [mechanic]
- **Critical rule**: "Clients may not write role, institutionId, departmentId, garageId or status."
- **Profile data is server-owned**: "using the server API key" — client cannot modify these fields

### Diagnostic Function Entry Point
- **Function**: `diagnostic-ai` 
- **Runtime**: Appwrite Functions (Node.js)
- **Endpoint**: `https://fra.cloud.appwrite.io/v1`
- **Authentication**: `verifyCaller(req.headers)` → JWT from `x-appwrite-user-jwt` header
- **Authentication check**: Returns 401 if JWT missing/invalid

### Current Diagnostic Flow (from `diagnostic-ai/index.js` lines 1049-1142)
1. Check JWT authentication → 401 if failed
2. Load caller profile → 500 if profile not found, 403 if no profile
3. Handle actions: `ensure_my_profile`, `update_my_profile`, `create_managed_profile`
4. Material actions: list/create/update/get_course_material_file
5. Admin actions: only `global_admin` permitted
6. Admin actions: enroll_in_course, get_enrolled_courses, etc.
7. Error handling: status codes 400, 403, 404, 500

### Rate Limiting
- **NOT present** in the diagnostic-ai function
- **NOT present** in the chat-ai function as a persistent store (though Stage 2.3.15/2.3.16 added atomic TablesDB rate limiter)
- **No per-user rate limiting** in the diagnostic function

### Current Authorization Model
- **Role-based**: `allowedRoles={['role']}` in `ProtectedRoute` (App.tsx)
- **Institution scoping**: Enrollments have `institutionId` and `departmentId`
- **Profile scoping**: `findProfile(userId)` looks up by verified userId
- **Never trust**: client-supplied userId, institutionId, departmentId, or role

---

## 2. Virtual Lab Simulation Integration Points

### Existing VirtualLab.tsx features (from Stage 2.1)
- Simulation state: `{ rpm, speed, coolantTemp, batteryVoltage, isRunning }`
- 5 scenarios: normal, weakBattery, overheating, chargingFault, sensorFault
- Start/Pause/Reset controls
- `renderReading` helper for 4 vehicle readings
- Disclaimer: "SIMULATED DATA — NOT REAL OBD-II READINGS"
- Safety rules (3 rules)
- Sequence steps (01, 02, 03)

### Data that could be supplied to AI diagnosis:
- **Current readings**: rpm, speed, coolantTemp, batteryVoltage
- **Scenario identification**: From moduleId or selected scenario
- **Test results**: From `testVoltage()` (battery voltage with tone) or `readObdCodes()` (P0301)
- **Safety metadata**: Tone (green/amber), disclaimer text

### How AI diagnosis could integrate:
1. User selects "I need help" in Virtual Lab
2. Current simulation readings are packaged into a diagnostic payload
3. Payload sent to `diagnostic-ai` function `runDiagnostic()`
4. AI returns structured JSON: summary, possibleCauses, recommendedChecks, nextSteps, safetyNotes, confidence, disclaimer
5. Results displayed to student with proper disclaimer

### Required additions for safe integration:
- **Server-side authorization** before AI call
- **Per-user rate limiting** (persistent, not in-memory)
- **Input validation** on diagnostic payload
- **Error handling** for missing/invalid profile data
- **Cross-institution/cross-department access denial**

---

## 3. Required Changes for Stage 2.2

### 1. Server-Side Institution/Department Authorization
**Must NOT trust**: client-supplied userId, institutionId, departmentId, or role
**MUST**: Derive identity from verified JWT only
**Enforce**: On every relevant data access

**Implementation approach**:
- In `diagnostic-ai/index.js` `runDiagnostic()` or the entrypoint
- After JWT verification, load the verified profile
- Check that required fields (institutionId, departmentId) exist
- Deny access if missing or if cross-institution/department attempt

### 2. Persistent Per-User Rate Limiting
**Current state**: No rate limiting in diagnostic-ai
**Requirement**: Persistent (not in-memory), using existing suitable resource
**Option A**: Use existing Appwrite TablesDB (if available from Stage 2.3.15/2.3.16/2.3.17)
**Option B**: If database schema change required → STOP and propose migration separately
**Constraint**: "Do not use in-memory rate limiting as a production solution"

**Assessment**: From earlier stages, the `chat-ai` function has a TablesDB-based rate limiter with `incrementRowColumn` and `max: 30`. The diagnostic-ai function does NOT have this. We could:
- Reuse the existing TablesDB `chat-ai-rate-limits` table (if created in Stage 2.3.6+)
- Or disallow until a migration is proposed

**Assessment**: The diagnostic-ai function's `profiles` collection and `enrollments` collection exist. We could potentially add rate limiting to the profiles collection, but this would require a schema change. **BLOCKED** until migration is approved.

### 3. Request-Size Limits and Input Validation
**Current state**: 
- `text(payload?.action, 100)` — limits action to 100 chars
- `text(value, maxLength = 255)` — general sanitization
- No payload size limit for diagnostic requests

**Required**:
- Maximum payload size (e.g., 10KB for diagnostic requests)
- Validation of `vehicleId`, `description`, `symptoms`, `warningLights`, `timing`
- Type/format checks on all fields

### 3. Safe Error Handling and Response Validation
**Current state**:
- Various error throws with status codes
- `httpError(message, statusCode = 400)` helper
- `friendlyErrorMessage()` for fallback
- Some JSON parsing fallback logic

**Required**:
- Consistent error response format
- No sensitive error details leaked to client
- Graceful fallback when AI provider fails
- Proper status codes (400, 401, 403, 429, 500)

### 4. Tests Required
- Unauthenticated requests → 401
- Authenticated requests → 200 with diagnostic result
- Cross-institution access attempts → 403
- Cross-department access attempts → 403
- Missing or invalid profile scope → 403
- Rate-limit enforcement → 429
- Oversized and malformed requests → 400

### 3. TypeScript, Build, and Tests
- `tsc -p web-app/tsconfig.json --noEmit` — must pass
- `npx vite build` — must pass
- Existing tests (35/35) must continue passing
- New tests for the above scenarios

---

## 4. Decision: BLOCKED — Requires Schema Change for Rate Limiting

**Critical finding**: Persistent per-user rate limiting requires a database schema change to add rate-limit tracking to the diagnostic-ai function's data model.

**Current resources available**:
- `profiles` collection: userId, role, institutionId, departmentId, etc.
- `enrollments` collection: studentId, courseId, institutionId, departmentId
- `chat-ai-rate-limits` table: exists from Stage 2.3.6+ (TablesDB)

**Option analysis**:
- **Option A**: Add rate-limit fields to existing `profiles` collection → Schema modification required
- **Option B**: Use existing `chat-ai-rate-limits` TablesDB table → May not be appropriate for diagnostic function
- **Option C**: Skip rate limiting for this stage → SECURITY RISK, violates "do not use in-memory rate limiting as a production solution"
- **Option D**: Propose separate migration for rate-limit schema → BLOCKED per instructions

**Decision**: **BLOCKED** — Cannot implement persistent per-user rate limiting without a schema change. The exact required change is:

> **Required migration**: Add `rateLimitCount` (integer, default 0) and `rateLimitWindowEnd` (datetime) fields to the `profiles` collection, or create a new `diagnostic_rate_limits` collection with `userId`, `count`, `windowEnd` fields.

**Without this schema change**, implementing rate limiting would either:
- Be in-memory (violates "do not use in-memory rate limiting as a production solution")
- Be nonexistent (security gap)
- Require inventing database fields (violates "Do not invent database fields")

---

## 5. Recommendation

**Stage 2.2: BLOCKED** — Requires separate schema migration approval before any code changes can be made for rate limiting.

**Alternative path**: Proceed with objectives 1, 3, 4, and 5 (authorization, input validation, error handling, tests) while deferring objective 2 (persistent rate limiting) to a later stage with the required migration.

**Next step**: Submit the required schema migration for approval, then return to Stage 2.2 implementation.