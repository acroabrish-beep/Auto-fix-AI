# Stage 2.3.6 Final Checklist

## Completed Items

### Priority 1 — Trusted profiles
- [x] `diagnostic-ai` verifies JWT for all actions; `x-appwrite-user-id` and client `actorId` never trusted
- [x] Profile creation/update strips role/institutionId/departmentId/garageId/status
- [x] `profilesService.ensureMyProfile()` provisions student profile after login
- [x] Register calls server provisioning; `profilesService.createProfile` removed from browser
- [x] School dashboard uses `createManagedProfile()` with role validation
- [x] Garage dashboard uses `createManagedProfile()` with role validation

### Priority 2 — Course material records
- [x] `pdf-extract` handler removed PDF-only branch; supports all 4 formats
- [x] `validateFile` checks extension-to-MIME matching strictly; rejects mismatches
- [x] `authorizeMaterialCourse()` verifies material binds to correct course institution
- [x] `courseMaterials.ts` service: secure list/create/update/download via `diagnostic-ai`
- [x] `setup-db.js`: `profiles` and `course_materials` permissions set to `[]` (server-only)
- [x] Instructor dashboard filters courses by institution; upload uses server action

### Priority 3 — Storage access
- [x] `pdf-extract` downloads files using server API key; files get owner-only permissions
- [x] Instructor upload sets `ownerFilePermissions(instructorId)` instead of `Role.users()`
- [x] Student downloads go through `downloadCourseMaterial()`; direct URLs 403

### Priority 4 — Student/Instructor filtering
- [x] Student dashboard fails closed when `institutionId` missing (empty state)
- [x] Instructor courses filtered by instructor's institution via programs
- [x] `authorizeMaterialCourse()` enforces material.institutionId == program.institutionId

### Priority 5 — Tests
- [x] 12 new tests added to `validation.test.mjs`
- [x] All 22 original tests continue passing

## Files That Require Appwrite Console Access (for full verification)
- [ ] Create/verify `course-materials` storage bucket with `fileSecurity` enabled
- [ ] Deploy `diagnostic-ai` function with `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID`
- [ ] Set `VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID=6a7743a8001a7c995501` in web app env
- [ ] Set `APPWRITE_API_KEY` as server-only env var (not in `VITE_*`)
- [ ] Run `npm run setup:db` with above env vars to apply tightened collection permissions
- [ ] Verify: same-institution student can extract; different-institution student denied
- [ ] Verify: profile forgery (attempt role change) is stripped; only permitted fields accepted
- [ ] Verify: instructor upload creates material with institution binding; student of same institution can extract; different institution cannot

## Local Verification Commands (no deploy required)
- [ ] `npm test` → 34/34 tests pass
- [ ] `npx tsc --noEmit --pretty false` → no type errors
- [ ] `npx vite build` → build completes without errors

## Notes
- Free-tier 2-function limit: all admin/profile actions share `diagnostic-ai`; `pdf-extract` remains deployed but may require plan upgrade for third function
- `course-materials` bucket must pre-exist in Appwrite Console
- `.env` absent locally; all `APPWRITE_API_KEY` set in Function environment only
- Learning modules `Permission.update(Role.users())` not changed per "do not invent schema" rule; server validation prevents new cross-institution inconsistencies
- Afaan Oromoo and Sidaama translations still need native-speaker review (outside Stage 2.3.6 scope)