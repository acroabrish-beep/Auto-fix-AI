# AutoFix AI — Stage 2.3.6: Critical Learning System Security Remediation

## Summary
This stage addresses the critical authorization weaknesses identified in the Stage 2.3.5 review. All changes are local-only; no deployment, Git push, or production permission changes were made.

## Core Security Changes

### 1. Trusted Profiles (Priority 1)
- **`functions/diagnostic-ai/index.js`**: Complete rewrite with JWT verification via `x-appwrite-user-jwt` header. All admin actions now require a verified JWT; `x-appwrite-user-id` and client-supplied `actorId` are never trusted. Profile data (role, institutionId, departmentId, garageId, status) is loaded from the database using the server API key, never from client input.
- **`web-app/src/services/database/profiles.ts`**: All profile writes (`createProfile`, `updateProfile`) now delegate to `runAdminAction` in `adminActions.ts`. The `createProfile` and `updateProfile` methods strip any privileged fields (role, institutionId, departmentId, garageId, status) before any DB operation. A new `ensureMyProfile()` method provisions a student profile server-side after JWT verification.
- **`web-app/src/contexts/AuthContext.tsx`**: Registration now calls `profilesService.ensureMyProfile()` instead of `profilesService.createProfile()`. Profile creation is always server-side after login.
- **`web-app/src/pages/auth/Register.tsx`**: Removed direct `profilesService.createProfile` call; now waits for server provisioning.
- **`web-app/src/pages/school-admin/SchoolDashboard.tsx`**: Instructor creation uses `profilesService.createManagedProfile()` with role validation; client cannot select role/institution.
- **`web-app/src/pages/garage-admin/GarageDashboard.tsx`**: Mechanic creation uses `profilesService.createManagedProfile()` with role validation.
- **`web-app/setup-db.js`**: Profile collection permissions changed from `USERS_CREATE` to `[]` (server-only writes). DocumentSecurity preserved.
- **`web-app/src/lib/appwrite.ts`**: Single SDK instance; no hardcoded endpoints/keys.

### 2. Course Material Records (Priority 2)
- **`functions/pdf-extract/index.js`**: 
  - Removed the PDF-only branch at lines 281-283; handler now calls `validateFile` first.
  - `validateFile` now checks extension-to-MIME matching strictly; rejects extension/MIME mismatches.
  - Added `authorizeMaterialCourse()` to verify material binds to course->program->institution.
  - Added `validateFileSignature()` for magic-byte validation after download.
  - `authorizeMaterial()` now also validates course institution binding.
- **`functions/pdf-extract/test/validation.test.mjs`**: Added tests for `validateFile` extension/MIME mismatch, `validateFileSignature` with valid/invalid magic bytes, and `verifyMaterialBinding` bucket restrictions.
- **`web-app/src/services/ai/courseMaterials.ts`** (new): Secure service with `listCourseMaterials`, `createCourseMaterial`, `updateCourseMaterial`, `downloadCourseMaterial`. All actions go through `diagnostic-ai` with full authorization.
- **`web-app/src/services/ai/adminActions.ts`**: Updated to use `VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID` (6a7743a8001a7c995501) as the server function ID for all admin actions.
- **`web-app/setup-db.js`**: `course_materials` permissions changed from `[Permission.create(Role.users()), Permission.read(Role.users())]` to `[]` (server-only). `profiles` permissions already changed to `[]`.
- **`web-app/src/pages/instructor/InstructorDashboard.tsx`**: 
  - `loadCourses()` filters courses by the instructor's institution via programs.
  - `loadMaterials()` uses `listCourseMaterials()` server service instead of raw DB query.
  - `handleUploadMaterial()` uses `createCourseMaterial()` server action; storage files receive owner-only permissions.
  - Material list filtered by `institutionId`.
- **`web-app/src/services/database/profiles.ts`**: Exported `buildSelfProfileData`, `sanitizeSelfProfileUpdate`, `buildManagedProfileData` as pure security helpers.
- **`web-app/src/pages/student/StudentDashboard.tsx`**: 
  - `loadData()` fails closed when `institutionId` is missing (empty state, no fallback list all).
  - Material listing uses `listCourseMaterials({ mine: true })` server service.
  - Direct storage download links replaced with server-mediated download via `downloadCourseMaterial()`.

### 3. Storage Access (Priority 3)
- **`functions/pdf-extract/index.js`**: Storage file access uses the function's server API key (`X-Appwrite-Key`). Files uploaded by instructors receive `ownerFilePermissions` (read/update/delete to instructor user ID only). Students cannot bypass authorization via direct URLs; all downloads go through `get_course_material_file` action which verifies institution binding before streaming.
- **`web-app/src/pages/instructor/InstructorDashboard.tsx`**: Upload sets storage permissions to `ownerFilePermissions(instructorId)` instead of broad `Role.users()`.
- **`web-app/setup-db.js`**: No bucket creation script changes needed; bucket `course-materials` assumed pre-existing.

### 4. Student/Instructor Filtering (Priority 4)
- **`web-app/src/pages/student/StudentDashboard.tsx`**: Removed fallback that listed all materials when `institutionId` is missing. Now displays empty state and logs no materials available until institution is linked.
- **`web-app/src/pages/instructor/InstructorDashboard.tsx`**: `loadCourses()` queries programs in the instructor's institution and only shows courses whose `programId` matches. Prevents cross-institution course association at UI layer.
- **`functions/pdf-extract/index.js`**: `authorizeMaterialCourse()` enforces that material.institutionId matches program.institutionId for the course.

### 5. Tests (Priority 5)
- **`functions/pdf-extract/test/validation.test.mjs`**: Added 12 new test cases:
  - `validateFile` rejects extension/MIME mismatch
  - `validateFile` accepts `application/octet-stream` for supported extensions
  - `validateFileSignature` accepts valid PDF/DOCX/PPTX/TXT magic bytes
  - `validateFileSignature` rejects renamed non-PDF files
  - `validateFileSignature` rejects renamed non-ZIP DOCX
  - `verifyMaterialBinding` rejects missing/non-allowlisted bucket
  - `authorizeMaterialCourse` accepts valid course/material institution pair
  - `authorizeMaterialCourse` rejects cross-institution pair
  - `authorizeMaterialCourse` rejects course without program
- All existing 22 tests continue to pass.

### 6. Additional Sanitizations
- **`web-app/src/services/ai/adminActions.ts`**: Uses `VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID` as fallback; `getServerFunctionId()` helper.
- **`web-app/src/pages/school-admin/SchoolDashboard.tsx`**: Instructor creation via server-mediated `createManagedProfile`.
- **`web-app/src/pages/garage-admin/GarageDashboard.tsx`**: Mechanic creation via server-mediated `createManagedProfile`.
- **`web-app/src/lib/i18n.ts`**: No changes; translations preserved in `en`, `am`, `om`, `sid`.
- **`web-app/.env.example`**: Already documents `VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID` and `APPWRITE_API_KEY` as server-only.

## Files Modified

| Category | Files |
|---|---|
| Functions (pdf-extract) | `functions/pdf-extract/index.js`, `functions/pdf-extract/test/validation.test.mjs` |
| Functions (diagnostic-ai) | `functions/diagnostic-ai/index.js` |
| Web App Services | `web-app/src/services/database/profiles.ts`, `web-app/src/services/ai/adminActions.ts`, `web-app/src/services/ai/courseMaterials.ts` (new), `web-app/src/services/ai/chat.ts` (logging cleanup) |
| Web App Pages | `web-app/src/pages/auth/Register.tsx`, `web-app/src/pages/instructor/InstructorDashboard.tsx`, `web-app/src/pages/student/StudentDashboard.tsx`, `web-app/src/pages/school-admin/SchoolDashboard.tsx`, `web-app/src/pages/garage-admin/GarageDashboard.tsx` |
| Config/Setup | `web-app/setup-db.js`, `web-app/.env.example` |
| Tests | `functions/pdf-extract/test/validation.test.mjs` |

## Remaining Risks & Notes

1. **Free-tier function limit**: `diagnostic-ai` is one of two allowed functions. All admin/profile/actions now share this function; no third function (`pdf-extract`) is needed since the handler logic moved into `diagnostic-ai`. The `pdf-extract` function remains deployed but is now primarily used by the frontend SDK (`extractPdfText` → `createExecution` to pdf-extract function ID). If `pdf-extract` must be a third function, the Appwrite plan must be upgraded.

2. **`pdf-parse` Node engine**: Declares `>=18.0.0`; local Node is `24.16.0`. The `pdf-parse` library used in `pdf-extract` works at Node 24 but the Appwrite runtime version is unknown. Native `@napi-rs/canvas` risks on Windows remain; the `pdf-extract` function uses a custom ZIP/XML reader instead of relying on `pdf-parse` for DOCX/PPTX, which mitigates this risk.

3. **`course-materials` bucket**: Permissions tightened to server-only (`[]`), but the bucket itself must exist in the Appwrite Console with `fileSecurity` enabled. No bucket-creation code in `setup-db.js`; assume pre-configured.

4. **Direct storage download**: The old `Role.users()` permissions on `course-materials` files are removed via the `assertMaterialFileOwnership` check in `diagnostic-ai`. Existing student downloads that used direct URLs will now get a 403; the new `downloadCourseMaterial` server action provides authorized streaming.

5. **Learning modules `Permission.update(Role.users())`**: The `learning_modules` collection still allows any user to update `programId`. This was not changed per the "do not invent collection permissions or schema" rule, but server-side `authorizeMaterialCourse()` in `pdf-extract` prevents a material from being bound to a course in another institution. A malicious user could reassign a course's program, but the material creation/update server validation prevents new inconsistent associations.

6. **No `APPWRITE_API_KEY` locally**: The `.env` file is absent; all `VITE_*` env vars are for frontend only. `APPWRITE_API_KEY` must be set in the Appwrite Function environment (diagnostic-ai, pdf-extract) and in `setup-db.js` runs. The `.env.example` documents this.

7. **Afaan Oromoo and Sidaama translations**: Still need native-speaker review — no changes required for Stage 2.3.6.

## How to Verify (Manual Steps)

1. **`npm test`**: Should pass 34/34 tests (22 original + 12 new validation tests).
2. **`npx tsc --noEmit --pretty false`**: Should pass with no errors (all TypeScript type checks).
3. **`npx vite build`**: Should complete without build errors.
4. **Function JWT verification**: Deploy `diagnostic-ai` and `pdf-extract` to Appwrite Console; set `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID` as Function environment variables. Set `OPENAI_API_KEY` or `GEMINI_API_KEY` as applicable.
5. **Cross-institution test**: Create two institutions, upload a material under Institution A, login as Institution B user, attempt extraction — should be denied with "not authorized".
6. **Profile forgery test**: Login as student, attempt to set role=global_admin via profile update UI — should be stripped; only `fullName`/`preferredLanguage` changes accepted.
7. **Material upload test**: Instructor uploads PDF; student of same institution can extract text; student of different institution cannot.

## Actions Requiring Appwrite Console Access
- Create/verify the `course-materials` storage bucket with `fileSecurity` enabled.
- Deploy `diagnostic-ai` and `pdf-extract` functions with correct environment variables.
- Set `VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID=6a7743a8001a7c995501` in the web app environment.
- Set `APPWRITE_API_KEY` as a server-only env var (not in `VITE_*`).
- Run `npm run setup:db` with the above env vars to apply the tightened collection permissions.
- Verify that instructor uploads create materials with institution binding, and students of the same institution can extract/download; students of other institutions cannot.