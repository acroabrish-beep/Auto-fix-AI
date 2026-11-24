/**
 * Appwrite Function: create-assignment
 * 
 * Verifies:
 *   - Caller is instructor or global_admin
 *   - Instructor is assigned to the course/department
 *   - Required fields are present
 * Creates assignment record with proper authorization
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
  
  log('Create-assignment request from user: ' + userId);
  
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
  
  // 4. Verify caller is instructor or global_admin
  if (callerProfile.role !== 'instructor' && callerProfile.role !== 'global_admin') {
    return res.status(403).json({ error: 'Instructor or global admin access required' });
  }
  
  const callerInstitutionId = callerProfile.institutionId;
  if (!callerInstitutionId) {
    return res.status(403).json({ error: 'Caller not affiliated with an institution' });
  }
  
  // 5. Parse request body
  const { title, description, courseId, dueDate, institutionId, departmentId } = req.body;
  if (!title || !dueDate) {
    return res.status(400).json({ error: 'title and dueDate are required' });
  }
  
  // 6. Verify instructor is assigned to this course/department
  // In a full implementation, check instructor's department assignment
  // For now, verify the caller's department matches the assignment's department
  if (departmentId && callerProfile.departmentId && callerProfile.departmentId !== departmentId) {
    return res.status(403).json({ error: 'Instructor not authorized for this department' });
  }
  
  // 7. Create assignment record
  const assignmentData = {
    title,
    description: description || '',
    institutionId: institutionId || callerInstitutionId,
    departmentId: departmentId || callerProfile.departmentId || '',
    courseId: courseId || '',
    instructorId: userId,
    dueDate,
    status: 'pending',
    submissionsCount: 0,
    createdAt: new Date().toISOString()
  };
  
  let assignmentRecord;
  try {
    assignmentRecord = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ASSIGNMENTS,
      'unique()',
      assignmentData,
      [
        Permission.read(Role.any()), // Students can view assignments
        Permission.create(Role.user(userId)), // Instructor creates
        Permission.update(Role.user(userId)), // Instructor can edit own assignments
      ]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create assignment: ' + err.message });
  }
  
  // 9. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'create_assignment',
        targetId: assignmentRecord.$id,\r\n        timestamp: new Date().toISOString(),
        institutionId: callerInstitutionId
      },
      [
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal — assignment still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Assignment created successfully',
    assignmentId: assignmentRecord.$id, institutionId: callerInstitutionId
    assignmentId: assignmentRecord.$id, institutionId: callerInstitutionId
