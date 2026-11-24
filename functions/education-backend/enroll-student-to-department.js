/**
 * Appwrite Function: enroll-student-to-department
 * 
 * Verifies:
 *   - Caller is authenticated user
 *   - User not already enrolled in a department
 *   - Target department belongs to same institution
 * Enrolls student in department with proper profile update
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
  
  log('Enroll-student request from user: ' + userId);
  
  // 2. Verify caller's identity — the student themselves
  let userProfile;
  try {
    userProfile = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      userId
    );
  } catch (err) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  
  // 3. Check if user is already enrolled in a department
  if (userProfile.departmentId) {
    return res.status(409).json({ error: 'Already enrolled in a department. Change department via admin actions.' });
  }
  
  // 4. Parse request body — target department ID
  const { departmentId } = req.body;
  if (!departmentId) {
    return res.status(400).json({ error: 'departmentId is required' });
  }
  
  // 5. Verify department exists and belongs to same institution
  let department;
  try {
    department = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS,
      departmentId
    );
  } catch (err) {
    return res.status(404).json({ error: 'Department not found' });
  }
  
  if (!department.institutionId) {
    return res.status(400).json({ error: 'Department has no institution affiliation' });
  }
  
  // 6. Verify user belongs to the same institution as the department
  if (userProfile.institutionId !== department.institutionId) {
    return res.status(403).json({ error: 'Student does not belong to the same institution as this department' });
  }
  
  // 7. Enroll student by updating profile
  try {
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      userId,
      {
        departmentId: departmentId,
        // Always ensure role remains 'student'
        role: 'student' as const,
        updatedAt: new Date().toISOString()
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
      ]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to enroll student: ' + err.message });
  }
  
  // 8. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'enroll_student_to_department',
        targetId: departmentId,
        details: 'Enrolled student ' + userId + ' into department ' + departmentId + ' (institution: ' + department.institutionId + ')',
        timestamp: new Date().toISOString(),
        institutionId: department.institutionId
      },
      [
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal — enrollment still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Student enrolled in department successfully',
    studentId: userId,
    departmentId,
    departmentName: department.name,
    institutionId: department.institutionId
  });
}
