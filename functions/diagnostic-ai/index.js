/*
  APPWRITE FUNCTION: diagnostic-ai

  This function handles:
  1. Trusted profile provisioning and account-management actions.
  2. Course-material metadata and private file access actions.
  3. Automotive diagnostics: { description, vehicleId, symptoms, ... }
     or { message } for a simple diagnostic prompt.

  Security rules enforced here:
  - Privileged actions require a verified Appwrite JWT. The x-appwrite-user-id
    header and client-supplied actorId values are never trusted.
  - Caller role, institution, department and garage are loaded from the
    caller's trusted profile using the server API key.
  - Clients may not write role, institutionId, departmentId, garageId or status.
  - Course-material writes and reads are authorized against the course's
    program institution on the server.
  - Direct storage access is not granted to students. Files stay private and
    are streamed back only after the server authorizes the caller.
*/

import { randomUUID } from 'node:crypto';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const COURSE_MATERIALS_BUCKET = 'course-materials';
const MAX_MATERIAL_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DIAGNOSTIC_PAYLOAD_BYTES = 10 * 1024;

function validateDiagnosticPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 400, error: 'Invalid request payload.' };
  }
  const description = payload.description || payload.message;
  if (typeof description !== 'string' || !description.trim()) {
    return { ok: false, status: 400, error: 'Problem description is required.' };
  }
  if (description.length > 5000) {
    return { ok: false, status: 400, error: 'Problem description is too long.' };
  }
  if (payload.vehicleId != null && typeof payload.vehicleId !== 'string') {
    return { ok: false, status: 400, error: 'vehicleId must be a string.' };
  }
  if (payload.symptoms != null && !Array.isArray(payload.symptoms)) {
    return { ok: false, status: 400, error: 'symptoms must be an array.' };
  }
  if (payload.warningLights != null && !Array.isArray(payload.warningLights)) {
    return { ok: false, status: 400, error: 'warningLights must be an array.' };
  }
  if (payload.timing != null && typeof payload.timing !== 'string') {
    return { ok: false, status: 400, error: 'timing must be a string.' };
  }
  return { ok: true, status: 200, error: null };
}

export { validateDiagnosticPayload };

const LEARNING_ROLES = new Set([
  'student',
  'instructor',
  'teacher',
  'department_admin',
  'global_admin',
  'tvet_admin',
  'admin',
]);

const MATERIAL_MANAGER_ROLES = new Set([
  'instructor',
  'teacher',
  'department_admin',
  'global_admin',
  'tvet_admin',
  'admin',
]);

const SELF_ACTIONS = new Set(['ensure_my_profile', 'update_my_profile']);

const MATERIAL_ACTIONS = new Set([
  'list_course_materials',
  'get_course_material_file',
  'create_course_material',
  'update_course_material',
]);

const ENROLLMENT_ACTIONS = new Set(['enroll_in_course', 'get_enrolled_courses']);

const MANAGED_PROFILE_ROLES = {
  tvet_admin: ['instructor', 'student'],
  department_admin: ['instructor', 'student'],
  garage_admin: ['mechanic'],
};

const FILE_MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
};

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function text(value, maxLength = 255) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

async function appwriteRequest(path, options = {}) {
  if (!projectId || !apiKey) {
    throw new Error('Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.');
  }

  const response = await fetch(`${endpoint.replace(/\/+$/, '')}${path}`, {
    ...options,
    headers: {
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || responseText || `Appwrite request failed with ${response.status}`);
  }

  return data;
}

function queryEqual(field, value) {
  return encodeURIComponent(JSON.stringify({
    method: 'equal',
    attribute: field,
    values: [String(value)],
  }));
}

async function verifyCaller(headers) {
  const jwt = headers?.['x-appwrite-user-jwt'];
  if (typeof jwt !== 'string' || !jwt.trim()) return null;

  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/account`, {
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-JWT': jwt,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const account = await response.json();
    if (typeof account?.$id !== 'string') return null;
    return {
      userId: account.$id,
      email: text(account.email, 255),
      name: text(account.name, 255),
    };
  } catch {
    return null;
  }
}

async function findProfile(userId) {
  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/profiles/documents?queries[]=${queryEqual('userId', userId)}&limit=1`
  );
  return result?.documents?.[0] || null;
}

async function findProfileByEmail(email) {
  const query = queryEqual('email', email);
  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/profiles/documents?queries[]=${query}&limit=1`
  );
  return result?.documents?.[0] || null;
}

async function getCourse(courseId) {
  if (!courseId) throw httpError('courseId is required.', 400);
  return appwriteRequest(
    `/databases/${databaseId}/collections/learning_modules/documents/${encodeURIComponent(courseId)}`
  );
}

async function getProgram(programId) {
  if (!programId) return null;
  return appwriteRequest(
    `/databases/${databaseId}/collections/programs/documents/${encodeURIComponent(programId)}`
  );
}

async function getMaterial(materialId) {
  if (!materialId) throw httpError('materialId is required.', 400);
  try {
    return await appwriteRequest(
      `/databases/${databaseId}/collections/course_materials/documents/${encodeURIComponent(materialId)}`
    );
  } catch (err) {
    throw httpError('Course material not found.', 404);
  }
}

async function writeAuditLog(actorId, action, targetId, details) {
  await appwriteRequest(`/databases/${databaseId}/collections/audit_logs/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data: {
        actorId: actorId || 'unknown',
        action,
        targetId,
        details,
        timestamp: new Date().toISOString(),
      },
      permissions: ['read("users")'],
    }),
  });
}

/* -------------------------------------------------------------------------- */
/* Pure security helpers (exported for tests)                                  */
/* -------------------------------------------------------------------------- */

export function buildSelfProfileData(account, now = new Date().toISOString()) {
  if (!account?.userId) throw httpError('A verified user is required.', 401);
  const email = text(account.email, 255);
  if (!email) throw httpError('The authenticated account has no email address.', 400);

  return {
    userId: account.userId,
    fullName: text(account.fullName || account.name, 255) || 'User',
    email,
    role: 'student',
    avatarFileId: '',
    preferredLanguage: 'en',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeSelfProfileUpdate(input) {
  const source = input && typeof input === 'object' ? input : {};
  const update = {};

  if (source.fullName !== undefined) {
    const fullName = text(source.fullName, 255);
    if (!fullName) throw httpError('fullName cannot be empty.', 400);
    update.fullName = fullName;
  }
  if (source.preferredLanguage !== undefined) {
    update.preferredLanguage = text(source.preferredLanguage, 50);
  }
  if (source.avatarFileId !== undefined) {
    update.avatarFileId = text(source.avatarFileId, 255);
  }
  if (source.phone !== undefined) {
    update.phone = text(source.phone, 50);
  }
  if (source.specialization !== undefined) {
    update.specialization = text(source.specialization, 255);
  }

  // Deliberately ignored: role, institutionId, departmentId, garageId,
  // status, userId, email and timestamps. Those are server/admin-owned.
  return update;
}

export function buildManagedProfileData(actorProfile, input, options = {}) {
  if (!actorProfile?.role) throw httpError('Authenticated profile required.', 401);

  const allowedRoles = MANAGED_PROFILE_ROLES[actorProfile.role] || [];
  const role = text(input?.role, 50);
  if (!allowedRoles.includes(role)) {
    throw httpError('You are not authorized to create this profile role.', 403);
  }

  const fullName = text(input?.fullName, 255);
  const email = text(input?.email, 255);
  if (!fullName) throw httpError('fullName is required.', 400);
  if (!email) throw httpError('email is required.', 400);

  const now = options.now || new Date().toISOString();
  const data = {
    userId: options.userId || randomUUID(),
    fullName,
    email,
    role,
    avatarFileId: '',
    preferredLanguage: 'en',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  if (actorProfile.role === 'garage_admin') {
    if (!actorProfile.garageId) {
      throw httpError('Your account is not linked to a garage.', 403);
    }
    data.garageId = actorProfile.garageId;
  } else {
    if (!actorProfile.institutionId) {
      throw httpError('Your account is not linked to an institution.', 403);
    }
    data.institutionId = actorProfile.institutionId;

    if (actorProfile.role === 'department_admin') {
      if (!actorProfile.departmentId) {
        throw httpError('Your account is not linked to a department.', 403);
      }
      data.departmentId = actorProfile.departmentId;
    }
  }

  if (input?.phone) data.phone = text(input.phone, 50);
  if (input?.specialization) data.specialization = text(input.specialization, 255);

  return data;
}

export function selfProfilePermissions(userId) {
  return [`read("user:${userId}")`];
}

export function managedProfilePermissions(actorId) {
  return [
    `read("user:${actorId}")`,
    `update("user:${actorId}")`,
    `delete("user:${actorId}")`,
  ];
}

export function ownerFilePermissions(ownerId) {
  return [
    `read("user:${ownerId}")`,
    `update("user:${ownerId}")`,
    `delete("user:${ownerId}")`,
  ];
}

export function materialDocumentPermissions(ownerId) {
  return ownerFilePermissions(ownerId);
}

export function resolveCourseInstitution(course, program) {
  if (!course?.programId) {
    throw httpError('Course is not linked to a program.', 403);
  }
  if (!program || program.$id !== course.programId) {
    throw httpError('Course program could not be verified.', 403);
  }
  if (!program.institutionId) {
    throw httpError('Program is not linked to an institution.', 403);
  }
  return program.institutionId;
}

export function authorizeMaterialCreate(actorProfile, course, program) {
  if (!actorProfile || !MATERIAL_MANAGER_ROLES.has(actorProfile.role)) {
    throw httpError('You are not authorized to manage course materials.', 403);
  }

  const courseInstitutionId = resolveCourseInstitution(course, program);

  if (actorProfile.role !== 'global_admin') {
    if (!actorProfile.institutionId) {
      throw httpError('Your account is not linked to an institution.', 403);
    }
    if (actorProfile.institutionId !== courseInstitutionId) {
      throw httpError('The course belongs to a different institution.', 403);
    }
  }

  return { institutionId: courseInstitutionId };
}

export function authorizeMaterialAccess(actorProfile, material, course, program) {
  if (!actorProfile || !LEARNING_ROLES.has(actorProfile.role)) {
    throw httpError('Your role is not authorized for learning materials.', 403);
  }
  if (!actorProfile.institutionId) {
    throw httpError('Your account is not linked to an institution.', 403);
  }
  if (!material?.institutionId || material.institutionId !== actorProfile.institutionId) {
    throw httpError('You are not authorized to access this course material.', 403);
  }

  const courseInstitutionId = resolveCourseInstitution(course, program);
  if (courseInstitutionId !== material.institutionId) {
    throw httpError('Course material institution binding is invalid.', 403);
  }

  return true;
}

export function authorizeMaterialUpdate(actorProfile, material) {
  if (!actorProfile || !MATERIAL_MANAGER_ROLES.has(actorProfile.role)) {
    throw httpError('You are not authorized to update course materials.', 403);
  }
  if (!actorProfile.institutionId || material?.institutionId !== actorProfile.institutionId) {
    throw httpError('You are not authorized to update this course material.', 403);
  }
  if (['instructor', 'teacher'].includes(actorProfile.role) && material.instructorId !== actorProfile.userId) {
    throw httpError('Only the instructor who uploaded this material may update it.', 403);
  }
  return true;
}

export function validateMaterialFileMeta(fileMeta, bucketId) {
  if (!fileMeta) throw httpError('Storage file metadata is required.', 400);
  if (!bucketId || bucketId !== COURSE_MATERIALS_BUCKET) {
    throw httpError('Storage bucket is not allowed for course materials.', 400);
  }

  const fileName = text(fileMeta.name, 255);
  const lowerName = fileName.toLowerCase();
  const extension = Object.keys(FILE_MIME_BY_EXTENSION)
    .find((candidate) => lowerName.endsWith(candidate));
  if (!fileName || !extension) {
    throw httpError('Only PDF, DOCX, PPTX, and TXT documents are supported.', 400);
  }

  const expectedMime = FILE_MIME_BY_EXTENSION[extension];
  const actualMime = text(fileMeta.mimeType, 255).toLowerCase();
  if (actualMime && actualMime !== 'application/octet-stream' && actualMime !== expectedMime) {
    throw httpError('The file type does not match its extension.', 400);
  }

  const size = Number(fileMeta.sizeOriginal || fileMeta.size || 0);
  if (!size || size <= 0) {
    throw httpError('The document is empty.', 400);
  }
  if (size > MAX_MATERIAL_FILE_SIZE) {
    throw httpError(`File too large (max ${Math.round(MAX_MATERIAL_FILE_SIZE / 1024 / 1024)} MB).`, 400);
  }

  return { fileName, extension, mimeType: expectedMime, size };
}

export function assertMaterialFileOwnership(fileMeta, actorId) {
  const permissions = Array.isArray(fileMeta?.$permissions) ? fileMeta.$permissions : [];
  const actorPermission = `read("user:${actorId}")`;
  if (!permissions.includes(actorPermission)) {
    throw httpError('You do not own the uploaded file.', 403);
  }
  return true;
}

export function resolveMaterialFileBinding(material, suppliedFileId, suppliedBucketId) {
  if (!material) throw httpError('Course material not found.', 404);
  if (!material.bucketId || material.bucketId !== COURSE_MATERIALS_BUCKET) {
    throw httpError('Course material storage bucket is invalid.', 403);
  }
  if (!material.fileId) throw httpError('Course material file is missing.', 404);
  if (suppliedBucketId && suppliedBucketId !== material.bucketId) {
    throw httpError('bucketId does not match the material document.', 400);
  }
  if (suppliedFileId && suppliedFileId !== material.fileId) {
    throw httpError('fileId does not match the material document.', 400);
  }
  return { fileId: material.fileId, bucketId: material.bucketId };
}

function validateMaterialTextFields(input, existing = {}) {
  const title = input?.title !== undefined ? text(input.title, 255) : existing.title;
  const description = input?.description !== undefined
    ? text(input.description, 1000)
    : existing.description;

  if (!title) throw httpError('title is required.', 400);
  return { title, description: description || '' };
}

/* -------------------------------------------------------------------------- */
/* Admin actions                                                               */
/* -------------------------------------------------------------------------- */

async function changeRole(payload, actor) {
  const { userId, role } = payload || {};
  if (!userId || !role) throw httpError('userId and role are required.', 400);

  const profile = await findProfile(userId);
  if (!profile) throw httpError('Profile not found.', 404);

  await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents/${profile.$id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { role } }),
  });

  await writeAuditLog(actor.userId, 'change_role', profile.$id, `Changed role from ${profile.role} to ${role}`);
  return { userId, role };
}

async function setProfileStatus(userId, status, actor, action) {
  if (!userId || !status) throw httpError('userId and status are required.', 400);

  const profile = await findProfile(userId);
  if (!profile) throw httpError('Profile not found.', 404);

  await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents/${profile.$id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { status } }),
  });

  await writeAuditLog(actor.userId, action, profile.$id, `Set user status to ${status}`);
  return { userId, status };
}

async function approveApplication(payload, actor) {
  const { applicationId } = payload || {};
  if (!applicationId) throw httpError('applicationId is required.', 400);

  const application = await appwriteRequest(
    `/databases/${databaseId}/collections/applications/documents/${applicationId}`
  );

  const collectionId = application.type === 'garage' ? 'garages' : 'schools';
  const ownerField = application.type === 'garage' ? 'ownerId' : 'adminId';

  const created = await appwriteRequest(`/databases/${databaseId}/collections/${collectionId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data: {
        name: application.details || `${application.type} application`,
        location: '',
        [ownerField]: application.applicantId,
        status: 'active',
      },
      permissions: ['read("users")'],
    }),
  });

  await appwriteRequest(`/databases/${databaseId}/collections/applications/documents/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { status: 'approved' },
    }),
  });

  await writeAuditLog(actor.userId, 'approve_application', applicationId, `Approved ${application.type} application`);
  return { applicationId, createdId: created.$id, type: application.type };
}

async function rejectApplication(payload, actor) {
  const { applicationId } = payload || {};
  if (!applicationId) throw httpError('applicationId is required.', 400);

  await appwriteRequest(`/databases/${databaseId}/collections/applications/documents/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { status: 'rejected' },
    }),
  });

  await writeAuditLog(actor.userId, 'reject_application', applicationId, 'Rejected application');
  return { applicationId, status: 'rejected' };
}

export function resolveEnrollmentStudentId(payload, actor) {
  if (!actor || !['student', 'department_admin', 'global_admin'].includes(actor.role)) {
    throw httpError('This account cannot access course enrollments.', 403);
  }

  if (actor.role === 'student') {
    if (typeof actor.userId !== 'string' || !actor.userId.trim()) {
      throw httpError('Authenticated student identity is missing.', 403);
    }
    return actor.userId;
  }

  const studentUserId = payload?.studentUserId;
  if (typeof studentUserId !== 'string' || !studentUserId.trim()) {
    throw httpError('studentUserId is required for admin enrollment actions.', 400);
  }

  return studentUserId.trim();
}

export function authorizeEnrollmentScope(actor, studentProfile, courseInstitutionId, course) {
  if (!actor || !['student', 'department_admin', 'global_admin'].includes(actor.role)) {
    throw httpError('This account cannot enroll students in courses.', 403);
  }

  if (!studentProfile || studentProfile.role !== 'student') {
    throw httpError('Only student accounts can enroll in courses.', 403);
  }

  if (actor.role === 'student') {
    if (studentProfile.userId !== actor.userId) {
      throw httpError('Students can only enroll their own account.', 403);
    }

    if (!studentProfile.institutionId || studentProfile.institutionId !== courseInstitutionId) {
      throw httpError('Course belongs to a different institution.', 403);
    }

    if (
      studentProfile.departmentId &&
      course?.departmentId &&
      studentProfile.departmentId !== course.departmentId
    ) {
      throw httpError('Course belongs to a different department.', 403);
    }
  }

  if (actor.role === 'department_admin') {
    if (!actor.institutionId || !actor.departmentId) {
      throw httpError('Department admin institution and department scope are required.', 403);
    }

    if (
      studentProfile.institutionId !== actor.institutionId ||
      studentProfile.departmentId !== actor.departmentId
    ) {
      throw httpError('Student is outside your department scope.', 403);
    }

    if (courseInstitutionId !== actor.institutionId) {
      throw httpError('Course belongs to a different institution.', 403);
    }

    if (course?.departmentId && course.departmentId !== actor.departmentId) {
      throw httpError('Course belongs to a different department.', 403);
    }
  }

  return true;
}

export function resolveEnrollmentReadScope(payload, actor, studentProfile = null) {
  const studentUserId = resolveEnrollmentStudentId(payload, actor);

  if (actor.role === 'student') {
    return { studentUserId };
  }

  if (!studentProfile || studentProfile.role !== 'student') {
    throw httpError('Student profile not found.', 404);
  }

  if (actor.role === 'department_admin') {
    if (!actor.institutionId || !actor.departmentId) {
      throw httpError('Department admin institution and department scope are required.', 403);
    }

    if (
      studentProfile.institutionId !== actor.institutionId ||
      studentProfile.departmentId !== actor.departmentId
    ) {
      throw httpError('Student is outside your department scope.', 403);
    }

    return {
      studentUserId,
      institutionId: actor.institutionId,
      departmentId: actor.departmentId,
    };
  }

  return { studentUserId };
}

async function enrollInCourse(payload, actor) {
  const courseId = payload?.courseId;
  if (typeof courseId !== 'string' || !courseId.trim()) {
    throw httpError('courseId is required.', 400);
  }

  const studentUserId = resolveEnrollmentStudentId(payload, actor);
  const studentProfile = await findProfile(studentUserId);
  if (!studentProfile) throw httpError('Student profile not found.', 404);

  const course = await getCourse(courseId.trim());
  if (!course) throw httpError('Course not found.', 404);

  const program = await getProgram(course.programId);
  if (!program) throw httpError('Course program not found.', 404);

  const courseInstitutionId = resolveCourseInstitution(course, program);
  authorizeEnrollmentScope(actor, studentProfile, courseInstitutionId, course);

  const existing = await appwriteRequest(
    `/databases/${databaseId}/collections/enrollments/documents?queries[]=${queryEqual('studentId', studentUserId)}&queries[]=${queryEqual('courseId', courseId.trim())}&limit=1`
  );

  if (existing?.documents?.length > 0) {
    return { success: true, alreadyEnrolled: true };
  }

  await appwriteRequest(`/databases/${databaseId}/collections/enrollments/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data: {
        studentId: studentUserId,
        courseId: courseId.trim(),
        institutionId: studentProfile.institutionId,
        departmentId: studentProfile.departmentId || course.departmentId || '',
        enrolledAt: new Date().toISOString(),
        status: 'active',
      },
      permissions: [],
    }),
  });

  await writeAuditLog(
    actor.userId,
    'enroll_in_course',
    studentUserId,
    `Enrolled in course ${courseId.trim()} (institution: ${studentProfile.institutionId})`
  );

  return { success: true };
}

async function getEnrolledCourses(payload, actor) {
  let studentProfile = null;

  if (actor?.role !== 'student') {
    const targetId = resolveEnrollmentStudentId(payload, actor);
    studentProfile = await findProfile(targetId);
  }

  const scope = resolveEnrollmentReadScope(payload, actor, studentProfile);
  const queries = [queryEqual('studentId', scope.studentUserId)];

  if (scope.institutionId) {
    queries.push(queryEqual('institutionId', scope.institutionId));
  }
  if (scope.departmentId) {
    queries.push(queryEqual('departmentId', scope.departmentId));
  }

  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/enrollments/documents?queries[]=${queries.join('&queries[]=')}`
  );

  const enrollments = (result?.documents || []).map((doc) => ({
    courseId: doc.courseId,
    institutionId: doc.institutionId || null,
    departmentId: doc.departmentId || null,
    enrolledAt: doc.enrolledAt || null,
    status: doc.status || 'active',
  }));

  return { success: true, enrollments };
}
async function setInstitutionStatus(payload, actor) {
  const { collectionId, id, status } = payload || {};
  if (!collectionId || !id || !status) {
    throw httpError('collectionId, id, and status are required.', 400);
  }
  if (!['schools', 'garages'].includes(collectionId)) {
    throw httpError('Only schools and garages can be updated.', 400);
  }

  await appwriteRequest(`/databases/${databaseId}/collections/${collectionId}/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { status },
    }),
  });

  await writeAuditLog(actor.userId, 'set_institution_status', id, `Set ${collectionId} ${id} to ${status}`);
  return { collectionId, id, status };
}

async function createInstitution(payload, actor) {
  const { name, location, type, adminEmail } = payload || {};
  if (!name || !location || !type || !adminEmail) {
    throw httpError('name, location, type, and adminEmail are required.', 400);
  }

  const collectionId = type === 'garage' ? 'garages' : 'schools';
  const ownerField = type === 'garage' ? 'ownerId' : 'adminId';
  const role = type === 'garage' ? 'garage_admin' : 'tvet_admin';

  const institution = await appwriteRequest(`/databases/${databaseId}/collections/${collectionId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data: {
        name,
        location,
        [ownerField]: '',
        status: 'active',
      },
      permissions: ['read("users")'],
    }),
  });

  const profile = await findProfileByEmail(adminEmail);
  if (!profile) {
    throw httpError('No profile found for the provided admin email.', 404);
  }

  await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents/${profile.$id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        role,
        ...(type === 'garage' ? { garageId: institution.$id } : { institutionId: institution.$id }),
      },
    }),
  });

  await writeAuditLog(actor.userId, 'create_institution', institution.$id, `Created ${type} ${name}`);
  return { institutionId: institution.$id, adminUserId: profile.userId, role };
}

async function runAdminAction(action, actionPayload, actor) {
  switch (action) {
    case 'change_role':
      return await changeRole(actionPayload, actor);
    case 'suspend_user':
      return await setProfileStatus(actionPayload.userId, 'suspended', actor, 'suspend_user');
    case 'activate_user':
      return await setProfileStatus(actionPayload.userId, 'active', actor, 'activate_user');
    case 'approve_application':
      return await approveApplication(actionPayload, actor);
    case 'reject_application':
      return await rejectApplication(actionPayload, actor);
    case 'set_institution_status':
      return await setInstitutionStatus(actionPayload, actor);
    case 'create_institution':
      return await createInstitution(actionPayload, actor);
    case 'enroll_in_course':
      return await enrollInCourse(actionPayload, actor);
    case 'get_enrolled_courses':
      return await getEnrolledCourses(actionPayload, actor);
    default:
      throw httpError(`Unknown action: ${action}`, 400);
  }
}

/* -------------------------------------------------------------------------- */
/* Profile actions                                                             */
/* -------------------------------------------------------------------------- */

async function ensureMyProfile(account) {
  const existing = await findProfile(account.userId);
  if (existing) return existing;

  const data = buildSelfProfileData(account);

  try {
    return await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents`, {
      method: 'POST',
      body: JSON.stringify({
        documentId: account.userId,
        data,
        permissions: selfProfilePermissions(account.userId),
      }),
    });
  } catch (err) {
    // A concurrent request may have created the profile already.
    const raced = await findProfile(account.userId);
    if (raced) return raced;
    throw err;
  }
}

async function updateMyProfile(account, payload) {
  const profile = await findProfile(account.userId);
  if (!profile) throw httpError('Caller profile not found.', 403);
  if (payload?.profileId && payload.profileId !== profile.$id) {
    throw httpError('You may only update your own profile.', 403);
  }

  const update = sanitizeSelfProfileUpdate(payload?.data || payload || {});
  if (Object.keys(update).length === 0) {
    throw httpError('No permitted profile fields were supplied.', 400);
  }
  update.updatedAt = new Date().toISOString();

  await writeAuditLog(account.userId, 'update_own_profile', profile.$id, 'Updated permitted profile fields');
  return await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents/${profile.$id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: update }),
  });
}

async function createManagedProfile(actorProfile, payload) {
  const data = buildManagedProfileData(actorProfile, payload);
  const existing = await findProfileByEmail(data.email);
  if (existing) {
    throw httpError('A profile with this email already exists.', 409);
  }

  const created = await appwriteRequest(`/databases/${databaseId}/collections/profiles/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data,
      permissions: managedProfilePermissions(actorProfile.userId),
    }),
  });

  await writeAuditLog(
    actorProfile.userId,
    'create_managed_profile',
    created.$id,
    `Created ${data.role} profile`
  );
  return created;
}

/* -------------------------------------------------------------------------- */
/* Course material actions                                                     */
/* -------------------------------------------------------------------------- */

async function listCourseMaterials(actorProfile, payload) {
  if (!LEARNING_ROLES.has(actorProfile.role)) {
    throw httpError('Your role is not authorized for learning materials.', 403);
  }
  if (!actorProfile.institutionId) {
    throw httpError('Your account is not linked to an institution.', 403);
  }

  const queries = [queryEqual('institutionId', actorProfile.institutionId)];
  if (payload?.courseId) queries.push(queryEqual('courseId', text(payload.courseId, 255)));
  if (payload?.mine === true) queries.push(queryEqual('instructorId', actorProfile.userId));

  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/course_materials/documents?queries[]=${queries.join('&queries[]=')}&limit=100`
  );
  return result?.documents || [];
}

async function createCourseMaterial(actorProfile, payload) {
  const fileId = text(payload?.fileId, 255);
  const bucketId = text(payload?.bucketId, 255);
  const courseId = text(payload?.courseId, 255);
  if (!fileId || !bucketId || !courseId) {
    throw httpError('fileId, bucketId, and courseId are required.', 400);
  }
  if (bucketId !== COURSE_MATERIALS_BUCKET) {
    throw httpError('Storage bucket is not allowed for course materials.', 400);
  }

  const course = await getCourse(courseId);
  const program = await getProgram(course.programId);
  const { institutionId } = authorizeMaterialCreate(actorProfile, course, program);

  const fileMeta = await appwriteRequest(`/storage/buckets/${bucketId}/files/${fileId}`);
  const file = validateMaterialFileMeta(fileMeta, bucketId);
  assertMaterialFileOwnership(fileMeta, actorProfile.userId);

  // Remove any broad permissions chosen by the browser. Students never access
  // storage directly; they download through get_course_material_file.
  await appwriteRequest(`/storage/buckets/${bucketId}/files/${fileId}`, {
    method: 'PUT',
    body: JSON.stringify({
      permissions: ownerFilePermissions(actorProfile.userId),
    }),
  });

  const fields = validateMaterialTextFields(payload, { title: file.fileName, description: '' });
  const data = {
    title: fields.title || file.fileName,
    description: fields.description,
    fileId,
    bucketId,
    courseId,
    institutionId,
    instructorId: actorProfile.userId,
  };

  const created = await appwriteRequest(`/databases/${databaseId}/collections/course_materials/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: 'unique()',
      data,
      permissions: materialDocumentPermissions(actorProfile.userId),
    }),
  });

  await writeAuditLog(
    actorProfile.userId,
    'create_course_material',
    created.$id,
    `Created material for course ${courseId}`
  );
  return created;
}

async function updateCourseMaterial(actorProfile, payload) {
  const materialId = text(payload?.materialId, 255);
  if (!materialId) throw httpError('materialId is required.', 400);

  const material = await getMaterial(materialId);
  authorizeMaterialUpdate(actorProfile, material);

  if (payload?.courseId && payload.courseId !== material.courseId) {
    const course = await getCourse(text(payload.courseId, 255));
    const program = await getProgram(course.programId);
    const { institutionId } = authorizeMaterialCreate(actorProfile, course, program);
    if (institutionId !== material.institutionId) {
      throw httpError('Course belongs to a different institution.', 403);
    }
  }

  const fields = validateMaterialTextFields(payload, material);
  const data = {
    title: fields.title,
    description: fields.description,
  };
  if (payload?.courseId) data.courseId = text(payload.courseId, 255);

  const updated = await appwriteRequest(
    `/databases/${databaseId}/collections/course_materials/documents/${encodeURIComponent(materialId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    }
  );

  await writeAuditLog(actorProfile.userId, 'update_course_material', materialId, 'Updated permitted material fields');
  return updated;
}

async function getCourseMaterialFile(actorProfile, payload) {
  const material = await getMaterial(text(payload?.materialId, 255));
  const course = await getCourse(material.courseId);
  const program = await getProgram(course.programId);

  authorizeMaterialAccess(actorProfile, material, course, program);
  const binding = resolveMaterialFileBinding(material, payload?.fileId, payload?.bucketId);

  const fileMeta = await appwriteRequest(
    `/storage/buckets/${binding.bucketId}/files/${binding.fileId}`
  );
  const file = validateMaterialFileMeta(fileMeta, binding.bucketId);

  const response = await fetch(
    `${endpoint.replace(/\/+$/, '')}/storage/buckets/${binding.bucketId}/files/${binding.fileId}/content`,
    {
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Storage download failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw httpError('The document is empty.', 400);

  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: buffer.length,
    base64: buffer.toString('base64'),
  };
}

/* -------------------------------------------------------------------------- */
/* Diagnostic actions                                                          */
/* -------------------------------------------------------------------------- */

async function runDiagnostic(payload) {
  if (!geminiApiKey) {
    throw new Error('AI diagnostics is not configured yet. Please add GEMINI_API_KEY to the function environment.');
  }

  const vehicleId = payload?.vehicleId;
  const description = payload?.description || payload?.message;
  const symptoms = payload?.symptoms;
  const warningLights = payload?.warningLights;
  const timing = payload?.timing;

  if (!description) {
    throw httpError('Problem description is required.', 400);
  }

  const prompt = `
    You are a professional automotive diagnostic assistant.
    Analyze the following vehicle problem and provide a structured JSON response. Write all human-readable JSON values in clear, natural Ethiopian Amharic when the user's problem description is in Amharic. Keep JSON property names in English and keep standard automotive technical terms in English with Amharic explanations. Do not invent test results.

    Vehicle ID: ${vehicleId}
    Problem Description: ${description}
    Symptoms: ${symptoms?.join?.(', ') || symptoms || 'None specified'}
    Warning Lights: ${warningLights?.join?.(', ') || warningLights || 'None'}
    Timing: ${timing}

    Respond ONLY with a valid JSON object following this structure:
    {
      "summary": "Short overview of the issue",
      "possibleCauses": [
        { "title": "Cause Name", "description": "Short explanation", "probability": 0.0-1.0 }
      ],
      "recommendedChecks": [
        { "title": "Check Name", "description": "What to do", "toolsRequired": ["Tool 1", "Tool 2"] }
      ],
      "nextSteps": ["Step 1", "Step 2"],
      "safetyNotes": ["Safety Warning 1"],
      "confidence": 0.0-1.0,
      "disclaimer": "Safety disclaimer text"
    }
  `;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to communicate with AI provider.');
  }

  const aiData = await response.json();
  const content = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(content);
}

/* -------------------------------------------------------------------------- */
/* Entrypoint                                                                  */
/* -------------------------------------------------------------------------- */

export default async (context) => {
  const { req, res, log, error } = context;

  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const rawBody = typeof req.body === 'string' ? req.body : (req.body ? JSON.stringify(req.body) : '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_DIAGNOSTIC_PAYLOAD_BYTES) {
    return res.json({ error: 'Request payload too large. Maximum 10 KB.' }, 413);
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ error: 'Invalid JSON payload.' }, 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.json({ error: 'Invalid request payload.' }, 400);
  }

  const action = text(payload?.action, 100);

  // --- Authenticate caller ---
  const account = await verifyCaller(req.headers);
  if (!account) {
    return res.json({ error: 'Authentication required.' }, 401);
  }

  // Load caller profile from authoritative server store
  let actorProfile = null;
  try {
    actorProfile = await findProfile(account.userId);
  } catch (err) {
    error('Failed to load caller profile: ' + err.message);
    return res.json({ error: 'Failed to verify caller profile.' }, 500);
  }

  // --- Diagnostic flow (no action field) ---
  // Requires verified identity and valid institution/department scope.
  if (!action) {
    // Institution affiliation check
    if (!actorProfile || !actorProfile.institutionId) {
      return res.json({ error: 'Institution affiliation required for diagnostic services.' }, 403);
    }

    // Department-admin department affiliation check
    if (actorProfile.role === 'department_admin' && !actorProfile.departmentId) {
      return res.json({ error: 'Department affiliation required for diagnostic services.' }, 403);
    }

    const validation = validateDiagnosticPayload(payload);
    if (!validation.ok) {
      return res.json({ error: validation.error }, validation.status);
    }

    // Proceed only if gemini API is configured
    if (!geminiApiKey) {
      return res.json(
        { error: 'AI diagnostics is not configured yet. Please add GEMINI_API_KEY to the function environment.' },
        500
      );
    }

    try {
      const result = await runDiagnostic(payload);
      return res.json(result);
    } catch (err) {
      const status = err?.statusCode || 500;
      if (status >= 500) error(err?.message || 'Diagnostic failed.');
      return res.json({ error: err?.message || 'An internal error occurred during analysis.' }, status);
    }
  }

  // --- Action-based flow (action field present) ---
  // Existing authorization logic preserved below
  try {
    if (action === 'ensure_my_profile') {
      const profile = await ensureMyProfile(account);
      return res.json({ success: true, data: profile });
    }

    if (!actorProfile) {
      return res.json({ error: 'Caller profile not found.' }, 403);
    }

    if (ENROLLMENT_ACTIONS.has(action)) {
      const result = await runAdminAction(action, payload.payload || {}, actorProfile);
      return res.json({ success: true, data: result });
    }

    if (action === 'update_my_profile') {
      const profile = await updateMyProfile(account, payload.payload || {});
      return res.json({ success: true, data: profile });
    }

    if (action === 'create_managed_profile') {
      if (!MANAGED_PROFILE_ROLES[actorProfile.role]) {
        return res.json({ error: 'You are not authorized to create managed profiles.' }, 403);
      }
      const profile = await createManagedProfile(actorProfile, payload.payload || {});
      return res.json({ success: true, data: profile });
    }

    if (MATERIAL_ACTIONS.has(action)) {
      let result;
      if (action === 'list_course_materials') {
        result = await listCourseMaterials(actorProfile, payload.payload || {});
      } else if (action === 'create_course_material') {
        result = await createCourseMaterial(actorProfile, payload.payload || {});
      } else if (action === 'update_course_material') {
        result = await updateCourseMaterial(actorProfile, payload.payload || {});
      } else {
        result = await getCourseMaterialFile(actorProfile, payload.payload || {});
      }
      return res.json({ success: true, data: result });
    }

    if (actorProfile.role !== 'global_admin') {
      return res.json({ error: 'Global admin access required.' }, 403);
    }

    const result = await runAdminAction(action, payload.payload || {}, actorProfile);
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) error(err?.message || 'Action failed.');
    return res.json({ error: err?.message || 'Action failed.' }, status);
  }
};
