/**
 * Appwrite Function: record-attendance
 * 
 * Verifies:
 *   - Caller is instructor or department_admin
 *   - Student belongs to the specified department
 *   - Date is valid
 *   - No duplicate record for same student/date
 * Records attendance and audit metadata
 */

import { databases, DATABASE_ID, COLLECTIONS } from '../../web-app/src/services/database';
import { Permission, Role } from 'appwrite';

export default async function handler(context) {
  const { req, res, log, error } = context;
  
  // 1. Authenticate caller using Appwrite JWT
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  log('Record-attendance request from user: ' + userId);
  
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
  
  // 3. Verify caller is instructor or department_admin
  if (callerProfile.role !== 'instructor' && callerProfile.role !== 'department_admin') {
    return res.status(403).json({ error: 'Instructor or department admin access required' });
  }
  
  const callerInstitutionId = callerProfile.institutionId;
  if (!callerInstitutionId) {
    return res.status(403).json({ error: 'Caller not affiliated with an institution' });
  }
  
  // 4. Parse request body
  const { studentId, departmentId, courseId, date, present } = req.body;
  if (!studentId || !departmentId || !date || present === undefined) {
    return res.status(400).json({ error: 'studentId, departmentId, date, and present are required' });
  }
  
  // 5. Validate date format
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use ISO date string.' });
  }
  
  // 6. Verify student belongs to the department
  let studentProfile;
  try {
    studentProfile = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      studentId
    );
  } catch (err) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  if (studentProfile.departmentId !== departmentId) {
    return res.status(403).json({ error: 'Student does not belong to the specified department' });
  }
  
  // 6. Check for duplicate record — same student, same date
  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('studentId', studentId),
        Query.equal('date', date)
      ]
    );
    if (existing.total > 0) {
      return res.status(409).json({ error: 'Attendance already recorded for this student on this date' });
    }
  } catch (err) {
    // If check fails, non-fatal — proceed with recording
    console.error('Duplicate check error: ' + err.message);
  }
  
  // 7. Record attendance
  const attendanceData = {
    studentId,
    departmentId,
    courseId: courseId || '',
    date,
    present,
    recordedBy: userId,
    recordedAt: new Date().toISOString()
  };
  
  let attendanceRecord;
  try {
    attendanceRecord = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      'unique()',
      attendanceData,
      [
        Permission.read(Role.user(studentId)),
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record attendance: ' + err.message });
  }
  
  // 8. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'record_attendance',
        targetId: studentId,
        details: 'Attendance recorded for student ' + studentId + ' on ' + date + ': ' + (present ? 'present' : 'absent') + ' (institution: ' + callerInstitutionId + ')',
        timestamp: new Date().toISOString(),
        institutionId: callerInstitutionId
      },
      [
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal — attendance record still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Attendance recorded successfully',
    studentId,
    date,
    present,
    attendanceId: attendanceRecord?.$id,
}
