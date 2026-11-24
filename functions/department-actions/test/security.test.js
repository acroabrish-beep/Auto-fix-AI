import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
process.env.APPWRITE_PROJECT_ID = 'test-project';
process.env.APPWRITE_API_KEY = 'test-key';
process.env.APPWRITE_DATABASE_ID = 'autofix-ai-db';

const { default: handler } = await import('../index.js');

function mockResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

async function invoke(jwt, fetchMock, body = { action: 'list_instructors' }) {
  global.fetch = fetchMock;

  let result;
  let status;

  await handler({
    req: {
      method: 'POST',
      headers: jwt ? { 'x-appwrite-user-jwt': jwt } : {},
      body: JSON.stringify(body),
    },
    res: {
      json(data, code = 200) {
        result = data;
        status = code;
        return { data, status };
      },
    },
    log() {},
    error() {},
  });

  return { result, status };
}

test('missing JWT returns 401 without calling Appwrite', async () => {
  let calls = 0;

  const response = await invoke(null, async () => {
    calls++;
    return mockResponse({});
  });

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('invalid JWT returns 401', async () => {
  const response = await invoke('invalid-token', async () =>
    mockResponse({ message: 'Unauthorized' }, 401)
  );

  assert.equal(response.status, 401);
});

test('authenticated non-department-admin returns 403', async () => {
  const response = await invoke('valid-token', async (url) => {
    if (String(url).endsWith('/account')) {
      return mockResponse({ $id: 'user-123' });
    }

    return mockResponse({
      documents: [{
        $id: 'profile-1',
        userId: 'user-123',
        role: 'student',
        institutionId: 'institution-A',
        departmentId: 'department-A',
      }],
    });
  });

  assert.equal(response.status, 403);
  assert.match(response.result.error, /Department Admin access required/);
});

test('department instructor query is restricted to verified department and institution', async () => {
  const requestedUrls = [];
  let profileLookupCount = 0;

  const response = await invoke('valid-token', async (url) => {
    const address = String(url);
    requestedUrls.push(address);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      profileLookupCount++;

      if (profileLookupCount === 1) {
        return mockResponse({
          documents: [{
            $id: 'admin-profile',
            userId: 'admin-user-1',
            role: 'department_admin',
            institutionId: 'institution-A',
            departmentId: 'department-A',
          }],
        });
      }

      return mockResponse({
        documents: [{
          $id: 'instructor-profile',
          userId: 'instructor-1',
          fullName: 'Test Instructor',
          email: 'instructor@example.test',
          role: 'instructor',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);
  assert.equal(response.result.data.length, 1);

  const listUrl = requestedUrls.find(
    (url) =>
      url.includes('/collections/profiles/documents') &&
      url.includes('departmentId')
  );

  assert.ok(listUrl, 'Department profile query was not made');

  const decoded = decodeURIComponent(listUrl);

  assert.ok(decoded.includes('equal("departmentId","department-A")'));
  assert.ok(decoded.includes('equal("institutionId","institution-A")'));
  assert.ok(decoded.includes('equal("role","instructor")'));
});

test('assignment uses verified department and institution, ignoring client tenant IDs', async () => {
  let profileLookupCount = 0;
  let assignmentData = null;
  let auditData = null;

  const response = await invoke('valid-token', async (url, options = {}) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      profileLookupCount++;

      if (profileLookupCount === 1) {
        return mockResponse({
          documents: [{
            $id: 'admin-profile',
            userId: 'admin-user-1',
            role: 'department_admin',
            institutionId: 'institution-A',
            departmentId: 'department-A',
          }],
        });
      }

      return mockResponse({
        documents: [{
          $id: 'instructor-profile',
          userId: 'instructor-1',
          role: 'instructor',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    if (address.includes('/collections/assignments/documents')) {
      assignmentData = JSON.parse(options.body).data;
      return mockResponse({
        $id: 'assignment-1',
        ...assignmentData,
      });
    }

    if (address.includes('/collections/audit_logs/documents')) {
      auditData = JSON.parse(options.body).data;
      return mockResponse({ $id: 'audit-1', ...auditData });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  }, {
    action: 'create_instructor_assignment',
    payload: {
      instructorId: 'instructor-1',
      title: 'Electrical Systems Assignment',
      departmentId: 'attacker-department',
      institutionId: 'attacker-institution',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);
  assert.equal(assignmentData.departmentId, 'department-A');
  assert.equal(assignmentData.institutionId, 'institution-A');
  assert.equal(assignmentData.instructorId, 'instructor-1');
  assert.equal(auditData.actorId, 'admin-user-1');
  assert.equal(auditData.action, 'department_create_instructor_assignment');
});

test('assignment rejects an instructor from another department', async () => {
  let assignmentCreateCalled = false;
  let profileLookupCount = 0;

  const response = await invoke('valid-token', async (url) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      profileLookupCount++;

      if (profileLookupCount === 1) {
        return mockResponse({
          documents: [{
            $id: 'admin-profile',
            userId: 'admin-user-1',
            role: 'department_admin',
            institutionId: 'institution-A',
            departmentId: 'department-A',
          }],
        });
      }

      return mockResponse({
        documents: [{
          $id: 'other-instructor-profile',
          userId: 'instructor-from-other-department',
          role: 'instructor',
          institutionId: 'institution-A',
          departmentId: 'department-B',
        }],
      });
    }

    if (address.includes('/collections/assignments/documents')) {
      assignmentCreateCalled = true;
    }

    return mockResponse({ $id: 'unexpected' });
  }, {
    action: 'create_instructor_assignment',
    payload: {
      instructorId: 'instructor-from-other-department',
      title: 'Unauthorized Assignment',
    },
  });

  assert.equal(response.status, 400);
  assert.match(response.result.error, /Instructor not found in your department/);
  assert.equal(assignmentCreateCalled, false);
});

test('attendance query is restricted to verified department and institution', async () => {
  let attendanceUrl = '';

  const response = await invoke('valid-token', async (url) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      return mockResponse({
        documents: [{
          $id: 'admin-profile',
          userId: 'admin-user-1',
          role: 'department_admin',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    if (address.includes('/collections/attendance/documents')) {
      attendanceUrl = address;
      return mockResponse({
        documents: [{
          $id: 'attendance-1',
          studentId: 'student-1',
          instructorId: 'instructor-1',
          courseId: 'course-1',
          attendanceDate: '2026-11-15',
          status: 'present',
          recordedBy: 'instructor-1',
          recordedAt: '2026-11-15T08:00:00.000Z',
        }],
      });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  }, {
    action: 'list_attendance',
    payload: {
      courseId: 'course-1',
      attendanceDate: '2026-11-15',
      departmentId: 'attacker-department',
      institutionId: 'attacker-institution',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);
  assert.equal(response.result.data.length, 1);
  assert.equal(response.result.data[0].studentId, 'student-1');

  assert.ok(attendanceUrl, 'Attendance query was not made');

  const decoded = decodeURIComponent(attendanceUrl);

  assert.ok(decoded.includes('equal("departmentId","department-A")'));
  assert.ok(decoded.includes('equal("institutionId","institution-A")'));
  assert.ok(decoded.includes('equal("courseId","course-1")'));
  assert.ok(decoded.includes('equal("attendanceDate","2026-11-15")'));
  assert.ok(!decoded.includes('attacker-department'));
  assert.ok(!decoded.includes('attacker-institution'));
});

test('attendance summary calculates status counts correctly', async () => {
  const response = await invoke('valid-token', async (url) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      return mockResponse({
        documents: [{
          $id: 'admin-profile',
          userId: 'admin-user-1',
          role: 'department_admin',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    if (address.includes('/collections/attendance/documents')) {
      return mockResponse({
        documents: [
          { $id: 'a1', status: 'present' },
          { $id: 'a2', status: 'present' },
          { $id: 'a3', status: 'absent' },
          { $id: 'a4', status: 'late' },
          { $id: 'a5', status: 'excused' },
          { $id: 'a6', status: 'unknown-status' },
        ],
      });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  }, {
    action: 'get_attendance_summary',
    payload: {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);

  const summary = response.result.data;

  assert.equal(summary.total, 6);
  assert.equal(summary.present, 2);
  assert.equal(summary.absent, 1);
  assert.equal(summary.late, 1);
  assert.equal(summary.excused, 1);
  assert.equal(summary.other, 1);
  assert.equal(summary.attendanceRate, 33.33);
  assert.equal(summary.cappedAt, 1000);
});
// Results must exclude students outside the verified department.
test('results include only submissions from verified department students', async () => {
  let profileLookupCount = 0;
  let submissionsUrl = '';

  const response = await invoke('valid-token', async (url) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      profileLookupCount++;

      if (profileLookupCount === 1) {
        return mockResponse({
          documents: [{
            $id: 'admin-profile',
            userId: 'admin-user-1',
            role: 'department_admin',
            institutionId: 'institution-A',
            departmentId: 'department-A',
          }],
        });
      }

      return mockResponse({
        documents: [{
          $id: 'student-profile-A',
          userId: 'student-user-A',
          fullName: 'Student A',
          role: 'student',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    if (address.includes('/collections/submissions/documents')) {
      submissionsUrl = address;
      return mockResponse({
        documents: [
          {
            $id: 'submission-A',
            studentId: 'student-user-A',
            studentName: 'Student A',
            status: 'graded',
            grade: 85,
          },
          {
            $id: 'submission-B',
            studentId: 'student-user-B',
            studentName: 'Student B',
            status: 'graded',
            grade: 90,
          },
        ],
      });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  }, {
    action: 'list_results',
    payload: {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);
  assert.equal(response.result.data.length, 1);
  assert.equal(response.result.data[0].$id, 'submission-A');
  assert.equal(response.result.data[0].studentName, 'Student A');

  assert.ok(submissionsUrl, 'Submissions query was not made');
  assert.ok(
    decodeURIComponent(submissionsUrl).includes('institution-A'),
    'Submissions query must be restricted to the verified institution'
  );
});

// Engagement must query only verified department student user IDs.
test('engagement includes only verified department student progress', async () => {
  let profileLookupCount = 0;
  let engagementUrl = '';

  const response = await invoke('valid-token', async (url) => {
    const address = String(url);

    if (address.endsWith('/account')) {
      return mockResponse({ $id: 'admin-user-1' });
    }

    if (address.includes('/collections/profiles/documents')) {
      profileLookupCount++;

      if (profileLookupCount === 1) {
        return mockResponse({
          documents: [{
            $id: 'admin-profile',
            userId: 'admin-user-1',
            role: 'department_admin',
            institutionId: 'institution-A',
            departmentId: 'department-A',
          }],
        });
      }

      return mockResponse({
        documents: [{
          $id: 'student-profile-A',
          userId: 'student-user-A',
          fullName: 'Student A',
          role: 'student',
          institutionId: 'institution-A',
          departmentId: 'department-A',
        }],
      });
    }

    if (address.includes('/collections/learning_progress/documents')) {
      engagementUrl = address;
      return mockResponse({
        documents: [
          {
            $id: 'progress-A',
            userId: 'student-user-A',
            moduleId: 'module-1',
            progressPercent: 75,
            completed: false,
          },
          {
            $id: 'progress-B',
            userId: 'student-user-B',
            moduleId: 'module-2',
            progressPercent: 100,
            completed: true,
          },
        ],
      });
    }

    throw new Error(`Unexpected Appwrite request: ${address}`);
  }, {
    action: 'list_engagement',
    payload: {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.result.success, true);
  assert.equal(response.result.data.length, 1);
  assert.equal(response.result.data[0].$id, 'progress-A');
  assert.equal(response.result.data[0].userId, 'student-user-A');

  assert.ok(engagementUrl, 'Learning progress query was not made');

  const decoded = decodeURIComponent(engagementUrl);
  assert.ok(decoded.includes('student-user-A'));
  assert.ok(!decoded.includes('student-user-B'));
});
