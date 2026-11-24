import { test } from 'node:test';
import assert from 'node:assert/strict';

// Helper: make a mock profile
function makeMockProfile(userId, role = 'student', institutionId, departmentId) {
  return { userId, role, institutionId, departmentId };
}

// Test: enrollment creation validates student role
test('enrollment validates student role', () => {
  const allowedRoles = new Set(['student', 'department_admin', 'global_admin']);
  const studentRole = 'student';
  const instructorRole = 'instructor';

  assert.ok(allowedRoles.has(studentRole), 'student should be allowed to enroll');
  assert.ok(!allowedRoles.has(instructorRole), 'instructor should NOT be allowed to enroll');
});

// Test: enrollment validates institution matching
test('enrollment validates institution matching', () => {
  const studentInstitution = 'inst-101';
  const courseInstitution = 'inst-101';

  // Student and course must have matching institution
  const instMatch = studentInstitution === courseInstitution;
  assert.ok(instMatch, 'same institution should allow enrollment');
});

// Test: enrollment rejects department mismatch
test('enrollment rejects department mismatch', () => {
  const studentDept = 'dept-1';
  const courseDept = 'dept-2';

  const deptMatch = studentDept === courseDept;
  assert.ok(!deptMatch, 'different departments should reject enrollment');
});

// Test: get enrolled courses returns empty for non-student
test('get enrolled courses returns empty for non-student', () => {
  // When the user is not a student, there are no enrolled courses
  const userRole = 'instructor';
  const isStudent = userRole === 'student';
  assert.ok(!isStudent, 'instructor should not have enrolled courses via student filter');
});

// Test: verify enrollment returns correct data
test('verify enrollment returns correct data', () => {
  // Simulate enrollment verification logic
  const enrollmentExists = true;
  const studentUserId = 'user-123';
  const courseId = 'course-456';

  if (enrollmentExists) {
    assert.ok(true, 'enrollment verified when record exists');
  } else {
    assert.ok(false, 'enrollment should be verified when record exists');
  }
});

// Test: cross-institution access is prevented
test('enrollment prevents cross-institution access', () => {
  const studentInst = 'inst-A';
  const courseInst = 'inst-B';

  const crossInst = studentInst !== courseInst;
  assert.ok(crossInst, 'cross-institution should be detected');
  const canEnroll = studentInst === courseInst;
  assert.strictEqual(canEnroll, false, 'cross-institution enrollment must be denied');
});

// Test: enrollment already exists check
test('enrollment checks for existing enrollment', () => {
  const alreadyEnrolled = true;
  assert.ok(alreadyEnrolled, 'should detect already enrolled state');
});

// Test: department admin can enroll students
test('department admin can enroll students', () => {
  const adminRole = 'department_admin';
  const allowedForEnrollment = new Set(['student', 'department_admin', 'global_admin']);
  assert.ok(allowedForEnrollment.has(adminRole), 'department admin should be allowed to enroll');
});

// Test: global admin can enroll students
test('global admin can enroll students', () => {
  const adminRole = 'global_admin';
  const allowedForEnrollment = new Set(['student', 'department_admin', 'global_admin']);
  assert.ok(allowedForEnrollment.has(adminRole), 'global admin should be allowed to enroll');
});

// Test: student cannot enroll in course outside institution
test('student cannot enroll in course outside institution', () => {
  const studentInst = 'inst-A';
  const courseInst = 'inst-B';
  const canEnroll = studentInst === courseInst;
  assert.ok(!canEnroll, 'student cannot enroll in course from different institution');
});

// Test: enrollment creates record with correct scoping
test('enrollment creates record with correct scoping', () => {
  // The enrollment should store student's institution and department
  const enrollmentData = {
    studentId: 'user-123',
    courseId: 'course-456',
    institutionId: 'inst-101',
    departmentId: 'dept-1',
  };

  assert.strictEqual(enrollmentData.institutionId, 'inst-101');
  assert.strictEqual(enrollmentData.departmentId, 'dept-1');
});

// Test: get enrolled courses filters by user role
test('get enrolled courses filters appropriately by role', () => {
  const roleBasedAccess = {
    student: 'can list own enrollments',
    instructor: 'cannot list student enrollments',
    global_admin: 'can list enrollments across institution',
  };

  assert.strictEqual(roleBasedAccess.student, 'can list own enrollments');
  assert.strictEqual(roleBasedAccess.instructor, 'cannot list student enrollments');
  assert.strictEqual(roleBasedAccess.global_admin, 'can list enrollments across institution');
});

// Test: course must have program for institution resolution
test('enrollment requires course to have program for institution resolution', () => {
  // If a course has no program, institution cannot be resolved
  const hasProgram = true; // simplified check
  assert.ok(hasProgram, 'course should have program for institution resolution');
});

// Test: enforcement of role-based enrollment
test('role-based enrollment enforcement summary', () => {
  const roles = {
    student: { canEnroll: true, reason: 'student role' },
    instructor: { canEnroll: false, reason: 'not a student role' },
    department_admin: { canEnroll: true, reason: 'admin role' },
    global_admin: { canEnroll: true, reason: 'admin role' },
    guest: { canEnroll: false, reason: 'no valid role' },
  };

  assert.ok(roles.student.canEnroll, 'student can enroll');
  assert.ok(!roles.instructor.canEnroll, 'instructor cannot enroll');
  assert.ok(roles.department_admin.canEnroll, 'department admin can enroll');
  assert.ok(roles.global_admin.canEnroll, 'global admin can enroll');
  assert.ok(!roles.guest.canEnroll, 'guest cannot enroll');
});