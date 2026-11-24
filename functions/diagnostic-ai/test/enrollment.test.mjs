import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveEnrollmentStudentId,
  authorizeEnrollmentScope,
  resolveEnrollmentReadScope,
} from '../index.js';

function expectForbidden(fn) {
  assert.throws(fn, (error) => error?.statusCode === 403);
}

const student = {
  userId: 'student-1',
  role: 'student',
  institutionId: 'inst-1',
  departmentId: 'dept-1',
};

const course = {
  departmentId: 'dept-1',
};

const departmentAdmin = {
  userId: 'admin-1',
  role: 'department_admin',
  institutionId: 'inst-1',
  departmentId: 'dept-1',
};

const globalAdmin = {
  userId: 'global-1',
  role: 'global_admin',
};

test('student identity always comes from the authenticated profile', () => {
  assert.equal(
    resolveEnrollmentStudentId(
      { studentUserId: 'victim-2' },
      { userId: 'student-1', role: 'student' }
    ),
    'student-1'
  );
});

test('student cannot enroll another student by supplying a forged ID', () => {
  const actor = { userId: 'student-1', role: 'student' };
  const target = { ...student, userId: 'victim-2' };

  expectForbidden(() =>
    authorizeEnrollmentScope(actor, target, 'inst-1', course)
  );
});

test('student can enroll in a course from their own institution and department', () => {
  assert.equal(
    authorizeEnrollmentScope(
      { userId: 'student-1', role: 'student' },
      student,
      'inst-1',
      course
    ),
    true
  );
});

test('student cannot enroll in a course from another institution', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      { userId: 'student-1', role: 'student' },
      student,
      'inst-2',
      course
    )
  );
});

test('student cannot enroll in a different department course when both departments are known', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      { userId: 'student-1', role: 'student' },
      student,
      'inst-1',
      { departmentId: 'dept-2' }
    )
  );
});

test('department admin can enroll a student within their own institution and department', () => {
  assert.equal(
    authorizeEnrollmentScope(
      departmentAdmin,
      student,
      'inst-1',
      course
    ),
    true
  );
});

test('department admin cannot enroll a student from another department', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      departmentAdmin,
      { ...student, departmentId: 'dept-2' },
      'inst-1',
      course
    )
  );
});

test('department admin cannot enroll a student from another institution', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      departmentAdmin,
      { ...student, institutionId: 'inst-2' },
      'inst-1',
      course
    )
  );
});

test('department admin cannot enroll in a course outside their department', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      departmentAdmin,
      student,
      'inst-1',
      { departmentId: 'dept-2' }
    )
  );
});

test('department admin with missing institution or department scope is rejected', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      { userId: 'admin-1', role: 'department_admin', institutionId: 'inst-1' },
      student,
      'inst-1',
      course
    )
  );
});

test('global admin can enroll a student across institutions', () => {
  assert.equal(
    authorizeEnrollmentScope(
      globalAdmin,
      { ...student, institutionId: 'inst-2', departmentId: 'dept-9' },
      'inst-2',
      { departmentId: 'dept-9' }
    ),
    true
  );
});

test('non-enrollment roles are rejected', () => {
  expectForbidden(() =>
    resolveEnrollmentStudentId({}, { userId: 'instructor-1', role: 'instructor' })
  );
});

test('department admin enrollment reads are scoped to institution and department', () => {
  assert.deepEqual(
    resolveEnrollmentReadScope(
      { studentUserId: 'student-1' },
      departmentAdmin,
      student
    ),
    {
      studentUserId: 'student-1',
      institutionId: 'inst-1',
      departmentId: 'dept-1',
    }
  );
});

test('department admin cannot read a student outside their department', () => {
  expectForbidden(() =>
    resolveEnrollmentReadScope(
      { studentUserId: 'student-2' },
      departmentAdmin,
      { ...student, userId: 'student-2', departmentId: 'dept-2' }
    )
  );
});

test('department admin cannot read enrollments when their scope is incomplete', () => {
  expectForbidden(() =>
    resolveEnrollmentReadScope(
      { studentUserId: 'student-1' },
      { userId: 'admin-1', role: 'department_admin', institutionId: 'inst-1' },
      student
    )
  );
});

test('student enrollment reads ignore a supplied target student ID', () => {
  assert.deepEqual(
    resolveEnrollmentReadScope(
      { studentUserId: 'victim-2' },
      { userId: 'student-1', role: 'student' }
    ),
    { studentUserId: 'student-1' }
  );
});

test('global admin can read enrollments for a student in another institution', () => {
  assert.deepEqual(
    resolveEnrollmentReadScope(
      { studentUserId: 'student-2' },
      globalAdmin,
      { userId: 'student-2', role: 'student', institutionId: 'inst-2' }
    ),
    { studentUserId: 'student-2' }
  );
});

test('enrollment target must be a student profile', () => {
  expectForbidden(() =>
    authorizeEnrollmentScope(
      departmentAdmin,
      { userId: 'instructor-1', role: 'instructor' },
      'inst-1',
      course
    )
  );
});