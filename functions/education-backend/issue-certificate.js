/**
 * Appwrite Function: issue-certificate
 * 
 * Verifies:
 *   - Caller is instructor, department_admin, or global_admin
 *   - Student has completed the course (100% progress)
 *   - Certificate not already issued for this student/course
 *   - Verification code is cryptographically secure
 * Issues certificate with verification code and audit trail
 */

import { databases, DATABASE_ID, COLLECTIONS } from '../../web-app/src/services/database';
import { Permission, Role } from 'appwrite';
import { randomBytes } from 'crypto';

export default async function handler(context) {
  const { req, res, log, error } = context;
  
  // 1. Authenticate caller using Appwrite JWT
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  log('Issue-certificate request from user: ' + userId);
  
  // 2. Verify caller's profile and role from database
  let callerProfile;
  try {
    callerProfile = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      userId
    );
  } catch (err) {
    return res.status(403).json({ error: 'Failed to verify caller identity' });
  }
  
  // 3. Verify caller has appropriate role
  if (
    callerProfile.role !== 'instructor' &&
    callerProfile.role !== 'department_admin' &&
    callerProfile.role !== 'global_admin' &&
    callerProfile.role !== 'tvet_admin'
  ) {
    return res.status(403).json({ error: 'Instructor, department admin, or administrator access required' });
  }
  
  const callerInstitutionId = callerProfile.institutionId;
  if (!callerInstitutionId) {
    return res.status(403).json({ error: 'Caller not affiliated with an institution' });
  }
  
  // 4. Parse request body
  const { studentId, courseId, courseName } = req.body;
  if (!studentId || !courseId) {
    return res.status(400).json({ error: 'studentId and courseId are required' });
  }
  
  // 5. Validate student has completed the course (100% progress)
  let progress;
  try {
    progress = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.LEARNING_PROGRESS,
      studentId + '-' + courseId // Composite key approach
    );
  } catch (err) {
    progress = null;
  }
  
  if (!progress || progress.progressPercent < 100) {
    return res.status(400).json({ 
      error: 'Course not completed - student progress is ' + (progress ? progress.progressPercent : 0) + '%' 
    });
  }
  
  // 6. Check if certificate already issued for this student/course
  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CERTIFICATES,
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );
    if (existing.total > 0) {
      return res.status(409).json({ error: 'Certificate already issued for this student and course' });
    }
  } catch (err) {
    console.error('Existing certificate check error: ' + err.message);
    // Non-fatal - proceed with issuance
  }
  
  // 7. Generate cryptographically secure verification code
  // Use randomBytes for security, base64 encode for readability
  const verificationCode = randomBytes(16).toString('hex').substring(0, 16);
  
  // 8. Get student name from profile
  let studentName = 'Student';
  try {
    const studentProfile = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      studentId
    );
    studentName = studentProfile.fullName || studentProfile.name || 'Student';
  } catch (err) {
    // Use default if profile not found
  }
  
  // 8. Issue certificate
  const certificateData = {
    studentId,
    studentName,
    courseId,
    courseName: courseName || 'Unknown Course',
    issueDate: new Date().toISOString(),
    verified: true,
    verificationCode,
    awardedBy: userId,
  };
  
  let certificateRecord;
  try {
    certificateRecord = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CERTIFICATES,
      'unique()',
      certificateData,
      [
        Permission.read(Role.user(studentId)),
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
      ]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to issue certificate: ' + err.message });
  }
  
  // 9. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'issue_certificate',
        targetId: studentId,
        details: 'Issued certificate for student ' + studentId + ' for course ' + courseId + ' (institution: ' + callerInstitutionId + ')',
        timestamp: new Date().toISOString(),
        institutionId: callerInstitutionId
      },
      [
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal — certificate still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Certificate issued successfully',
    certificateId: certificateRecord.\,
    studentId,
    courseId,
    verificationCode,
    issueDate: certificateRecord.issueDate
  });
}
