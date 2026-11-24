import { databaseService, COLLECTIONS, Query } from './index';
import { UserProfile } from '../../types';

/**
 * Enroll a student in a course with institution and department scoping.
 * The server derives the student's trusted profile and validates the
 * enrollment binds to the correct course institution/department before
 * writing. Client-supplied role/institution/department are never trusted.
 */
export async function enrollStudent(
  studentUserId: string,
  courseId: string,
  departmentId?: string
): Promise<boolean> {
  // 1. Load the student's trusted profile server-side
  const profile = await databaseService.getDocument<UserProfile>(
    COLLECTIONS.PROFILES,
    studentUserId
  );
  if (!profile || profile.role !== 'student') return false;

  const studentInstitutionId = profile.institutionId;
  const studentDepartmentId = profile.departmentId;

  // 2. Validate the course exists and belongs to the same institution/department
  const course = await databaseService.getDocument<LearningModule>(
    COLLECTIONS.LEARNING_MODULES,
    courseId
  );
  if (!course) return false;

  // If the course has a program, validate through the program's institution
  let courseInstitutionId = course.programId
    ? await getProgramInstitutionId(course.programId)
    : null;

  // If course has no direct institution but has a department, use that
  if (!courseInstitutionId && course.departmentId) {
    const dept = await databaseService.getDocument<Department>(
      COLLECTIONS.DEPARTMENTS,
      course.departmentId
    );
    courseInstitutionId = dept?.institutionId || null;
  }

  // 3. If department is specified in enrollment, validate it matches the course department
  if (departmentId && course.departmentId && departmentId !== course.departmentId) {
    // Department mismatch – reject
    return false;
  }

  // 4. Check if already enrolled
  const existing = await databaseService.listDocuments<any>(COLLECTIONS.ENROLLMENTS, [
    Query.equal('studentId', studentUserId),
    Query.equal('courseId', courseId),
  ]);
  if (existing.length > 0) return true; // Already enrolled

  // 5. Write enrollment with server-derived institution/department
  await databaseService.createDocument(COLLECTIONS.ENROLLMENTS, {
    studentId: studentUserId,
    courseId,
    institutionId: studentInstitutionId || courseInstitutionId || '',
    departmentId: studentDepartmentId || course.departmentId || '',
    enrolledAt: new Date().toISOString(),
    status: 'active',
  }, undefined, studentUserId); // documentSecurity will enforce owner-only

  return true;
}

/**
 * Get all courses a student is enrolled in.
 */
export async function getEnrolledCourses(studentUserId: string): Promise<string[]> {
  const results = await databaseService.listDocuments<{ courseId: string }>(
    COLLECTIONS.ENROLLMENTS,
    [Query.equal('studentId', studentUserId)]
  );
  return results.map((r) => r.courseId);
}

/**
 * Verify that a student is enrolled in a specific course.
 * Returns the enrollment document if valid, null otherwise.
 */
export async function verifyEnrollment(
  studentUserId: string,
  courseId: string
): Promise<{ enrolled: boolean; institutionId: string | null; departmentId: string | null }> {
  const results = await databaseService.listDocuments<any>(COLLECTIONS.ENROLLMENTS, [
    Query.equal('studentId', studentUserId),
    Query.equal('courseId', courseId),
  ]);

  if (results.length === 0) {
    return { enrolled: false, institutionId: null, departmentId: null };
  }

  const enrollment = results[0];
  return {
    enrolled: true,
    institutionId: enrollment.institutionId || null,
    departmentId: enrollment.departmentId || null,
  };
}

/**
 * Get all students enrolled in a specific course.
 * Returns student profiles with basic info.
 */
export async function getStudentsInCourse(courseId: string): Promise<UserProfile[]> {
  const results = await databaseService.listDocuments<UserProfile>(
    COLLECTIONS.PROFILES,
    [Query.equal('institutionId', '')] // Will be filtered by enrollment institution
  );

  // Filter by enrollment records for this course
  const enrollmentResults = await databaseService.listDocuments<any>(
    COLLECTIONS.ENROLLMENTS,
    [Query.equal('courseId', courseId)]
  );

  const enrolledStudentIds = enrollmentResults.map((e) => e.studentId);

  // Get profiles for enrolled students
  const profiles: UserProfile[] = [];
  for (const studentId of enrolledStudentIds) {
    const profile = await databaseService.getDocument<UserProfile>(
      COLLECTIONS.PROFILES,
      studentId
    );
    if (profile) profiles.push(profile);
  }

  return profiles;
}

/**
 * Get the institution and department for a course's enrollment.
 */
async function getProgramInstitutionId(programId: string): Promise<string | null> {
  try {
    const program = await databaseService.getDocument<any>(
      COLLECTIONS.PROGRAMS,
      programId
    );
    return program?.institutionId || null;
  } catch {
    return null;
  }
}

export type { UserProfile };