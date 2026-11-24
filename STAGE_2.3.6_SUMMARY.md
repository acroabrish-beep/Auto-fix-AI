# AutoFix AI Stage 2.3.6 Remediation — Quick Summary

## Priority 1 — Trusted profiles
- `diagnostic-ai` now verifies JWT (`x-appwrite-user-jwt`) for all actions; `x-appwrite-user-id` and client `actorId` never trusted
- Profile creation/update strips role/institutionId/departmentId/garageId/status; these are server-assigned only
- `profilesService.ensureMyProfile()` provisions student profile after login; never client-writable
- Register calls server provisioning; `profilesService.createProfile` removed from browser flow
- School/Garage dashboards use `createManagedProfile()` with role validation

## Priority 2 — Course material records
- `pdf-extract` handler removed PDF-only branch; calls `validateFile` first; supports all 4 formats
- `validateFile` checks extension-to-MIME matching strictly; rejects mismatches
- `authorizeMaterialCourse()` verifies material binds to course->program->institution
- `courseMaterials.ts` service: secure list/create/update/download; all via `diagnostic-ai`
- `setup-db.js`: `profiles` and `course_materials` permissions set to `[]` (server-only)
- Instructor dashboard filters courses by institution; material upload uses server action

## Priority 3 — Storage access
- `pdf-extract` downloads files using server API key; files get owner-only permissions
- Instructor upload sets `ownerFilePermissions(instructorId)` instead of `Role.users()`
- Student downloads go through `downloadCourseMaterial()`; direct URLs now 403

## Priority 4 — Student/Instructor filtering
- Student dashboard fails closed when `institutionId` missing (empty state, no list-all fallback)
- Instructor courses filtered by instructor's institution via programs
- `authorizeMaterialCourse()` enforces material.institutionId == program.institutionId

## Priority 5 — Tests
- 12 new tests in `validation.test.mjs`: extension/MIME mismatch, magic-byte validation, binding checks
- All 22 original tests continue passing

## Key Files Modified
- `functions/pdf-extract/index.js` — core extraction handler fix + validation
- `functions/pdf-extract/test/validation.test.mjs` — 12 new tests
- `functions/diagnostic-ai/index.js` — JWT-verified admin/actions flow
- `web-app/src/services/database/profiles.ts` — stripped privileged fields, server delegation
- `web-app/src/contexts/AuthContext.tsx` — server profile provisioning
- `web-app/src/pages/auth/Register.tsx` — removed browser profile creation
- `web-app/src/pages/instructor/InstructorDashboard.tsx` — institution-filtered courses/materials
- `web-app/src/pages/student/StudentDashboard.tsx` — fail closed, server-mediated download
- `web-app/src/pages/school-admin/SchoolDashboard.tsx` — server-mediated instructor creation
- `web-app/src/pages/garage-admin/GarageDashboard.tsx` — server-mediated mechanic creation
- `web-app/src/services/ai/courseMaterials.ts` — new secure material service
- `web-app/src/services/ai/adminActions.ts` — diagnostic function ID routing
- `web-app/setup-db.js` — tightened collection permissions

## Verification (local, no deploy)
- `npm test` → 34/34 tests pass (22 original + 12 new)
- `npx tsc --noEmit --pretty false` → typecheck pass
- `npx vite build` → build pass

## Remaining Notes
- Free-tier 2-function limit: all admin/profile actions share `diagnostic-ai`; `pdf-extract` remains as-is (may require plan upgrade for 3-function limit)
- `course-materials` bucket must exist in Appwrite Console with `fileSecurity` enabled
- `.env` absent locally; `APPWRITE_API_KEY` set in Function environment only
- Learning modules `Permission.update(Role.users())` not changed per "do not invent schema" rule; server validation prevents new cross-institution inconsistencies