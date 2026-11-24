import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
process.env.APPWRITE_PROJECT_ID = 'local-test-project';
process.env.APPWRITE_API_KEY = 'local-mock-key';
process.env.APPWRITE_DATABASE_ID = 'autofix-ai-db';

const handler = (await import('../index.js')).default;

function makeContext({ jwt, action, payload = {}, method = 'POST' }) {
  let result;

  const headers = {};
  if (jwt !== undefined) {
    headers['x-appwrite-user-jwt'] = jwt;
  }

  return {
    context: {
      req: {
        method,
        headers,
        body: JSON.stringify({ action, payload }),
      },
      res: {
        json(body, status = 200) {
          result = { body, status };
          return result;
        },
      },
      log() {},
      error() {},
    },
    getResult: () => result,
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installMockFetch(t, { role = 'global_admin', invalidJwt = false } = {}) {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    calls.push({ url: address, options });

    if (address.endsWith('/account')) {
      if (invalidJwt) return jsonResponse({ message: 'Invalid JWT' }, 401);
      return jsonResponse({ $id: 'verified-actor' });
    }

    if (address.includes('/profiles/documents?queries[]=')) {
      const decoded = decodeURIComponent(address);

      if (decoded.includes('verified-actor')) {
        return jsonResponse({
          documents: [{
            $id: 'actor-profile',
            userId: 'verified-actor',
            role,
          }],
        });
      }

      if (decoded.includes('target-user')) {
        return jsonResponse({
          documents: [{
            $id: 'target-profile',
            userId: 'target-user',
            role: 'student',
          }],
        });
      }
    }

    if (address.includes('/profiles/documents/target-profile')) {
      return jsonResponse({ $id: 'target-profile' });
    }

    if (address.includes('/audit_logs/documents')) {
      return jsonResponse({ $id: 'audit-entry' });
    }

    return jsonResponse({});
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  return calls;
}

test('missing JWT returns 401 without calling Appwrite', async (t) => {
  const calls = installMockFetch(t);
  const request = makeContext({
    action: 'change_role',
    payload: { userId: 'target-user', role: 'instructor' },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 401);
  assert.equal(calls.length, 0);
});

test('invalid JWT returns 401', async (t) => {
  installMockFetch(t, { invalidJwt: true });

  const request = makeContext({
    jwt: 'invalid-token',
    action: 'change_role',
    payload: { userId: 'target-user', role: 'instructor' },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 401);
});

test('authenticated non-admin returns 403', async (t) => {
  installMockFetch(t, { role: 'student' });

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'change_role',
    payload: { userId: 'target-user', role: 'instructor' },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 403);
});

test('global admin can assign an allowed role and audit uses verified actor ID', async (t) => {
  const calls = installMockFetch(t);

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'change_role',
    payload: {
      userId: 'target-user',
      role: 'instructor',
      actorId: 'forged-attacker-id',
    },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 200);
  assert.equal(request.getResult().body.success, true);

  const auditCall = calls.find((call) =>
    call.url.includes('/audit_logs/documents')
  );

  assert.ok(auditCall, 'Audit log should be written');

  const auditBody = JSON.parse(auditCall.options.body);
  assert.equal(auditBody.data.actorId, 'verified-actor');
});

test('global admin cannot assign global_admin through standard role change', async (t) => {
  const calls = installMockFetch(t);

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'change_role',
    payload: {
      userId: 'target-user',
      role: 'global_admin',
    },
  });

  await handler(request.context);

  assert.notEqual(request.getResult().status, 200);

  const targetUpdate = calls.some((call) =>
    call.options.method === 'PATCH' &&
    call.url.includes('/profiles/documents/target-profile')
  );

  assert.equal(targetUpdate, false);
});

test('approve_application audit uses verified actor ID', async (t) => {
  const calls = installMockFetch(t);

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'approve_application',
    payload: {
      applicationId: 'application-approve',
      actorId: 'forged-attacker-id',
    },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 200);

  const auditCall = calls.find((call) =>
    call.url.includes('/audit_logs/documents')
  );

  assert.ok(auditCall, 'Approval should create an audit log');
  const auditBody = JSON.parse(auditCall.options.body);
  assert.equal(auditBody.data.actorId, 'verified-actor');
});

test('reject_application audit uses verified actor ID', async (t) => {
  const calls = installMockFetch(t);

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'reject_application',
    payload: {
      applicationId: 'application-reject',
      actorId: 'forged-attacker-id',
    },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 200);

  const auditCall = calls.find((call) =>
    call.url.includes('/audit_logs/documents')
  );

  assert.ok(auditCall, 'Rejection should create an audit log');
  const auditBody = JSON.parse(auditCall.options.body);
  assert.equal(auditBody.data.actorId, 'verified-actor');
});

test('set_institution_status audit uses verified actor ID', async (t) => {
  const calls = installMockFetch(t);

  const request = makeContext({
    jwt: 'valid-mock-token',
    action: 'set_institution_status',
    payload: {
      collectionId: 'schools',
      id: 'school-test-id',
      status: 'suspended',
      actorId: 'forged-attacker-id',
    },
  });

  await handler(request.context);

  assert.equal(request.getResult().status, 200);

  const auditCall = calls.find((call) =>
    call.url.includes('/audit_logs/documents')
  );

  assert.ok(auditCall, 'Institution status change should create an audit log');
  const auditBody = JSON.parse(auditCall.options.body);
  assert.equal(auditBody.data.actorId, 'verified-actor');
});
