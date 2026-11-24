/**
 * Appwrite Function: assign-instructor-to-department
 * 
 * Verifies:
 *   - Caller is department_admin or global_admin
 *   - Instructor belongs to same institution
 *   - Department belongs to same institution
 * Records assignment and audit metadata
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
  
  log('Assign-instructor request from user: ' + userId);
  
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
  
  // 3. Verify caller is department_admin or global_admin
  if (callerProfile.role !== 'department_admin' && callerProfile.role !== 'global_admin') {
    return res.status(403).json({ error: 'Global admin or department admin access required' });
  }
  
  const callerInstitutionId = callerProfile.institutionId;
  if (!callerInstitutionId) {
    return res.status(403).json({ error: 'Caller not affiliated with an institution' });
  }
  
  // 4. Parse request body
  let { instructorId, departmentId } = req.body;
  if (!instructorId || !departmentId) {
    return res.status(400).json({ error: 'instructorId and departmentId are required' });
  }
  
  log('Assigning instructor ' + instructorId + ' to department ' + departmentId);
  
  // 5. Verify instructor belongs to same institution
  let instructorProfile;
  try {
    instructorProfile = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      instructorId
    );
  } catch (err) {
    return res.status(404).json({ error: 'Instructor not found' });
  }
  
  if (instructorProfile.institutionId !== callerInstitutionId) {
    return res.status(403).json({ error: 'Instructor does not belong to the same institution' });
  }
  
  // 6. Verify department exists and belongs to same institution
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
  
  if (department.institutionId !== callerInstitutionId) {
    return res.status(403).json({ error: 'Department does not belong to the same institution' });
  }
  
  // 7. Check if instructor already assigned to this department
  // Simple check: look for existing assignment record
  let alreadyAssigned = false;
  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS, // Using dept collection to check - or could use a separate collection
      [Query.equal('headId', instructorId)] // Simplified check
    );
    // If dept head is this instructor, they're already associated
    if (existing.total > 0) {
      alreadyAssigned = true;
    }
  } catch (err) {
    // Ignore check errors - proceed with assignment
  }
  
  if (alreadyAssigned) {
    return res.status(409).json({ error: 'Instructor is already associated with this department' });
  }
  
  // 8. Record the assignment
  // In a full implementation, we might use a dedicated collection like 'department_instructors'
  // For now, we'll update the department's headId if it's empty, or create an audit record
  
  // Update department with assignment audit
  try {
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS,
      departmentId,
      {
        headId: alreadyAssigned ? department.headId : instructorId, // Simple assignment logic
        updatedAt: new Date().toISOString()
      }
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record assignment: ' + err.message });
  }
  
  // 9. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'assign_instructor_to_department',
        targetId: instructorId,
        details: 'Assigned instructor ' + instructorId + ' to department ' + departmentId + ' (institution: ' + callerInstitutionId + ')',
        timestamp: new Date().toISOString(),
        institutionId: callerInstitutionId
      },
      [
        Permission.read(Role.user(userId)),
        Permission.read(Role.user(instructorId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal - assignment still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Instructor assigned to department successfully',
    instructorId,
    departmentId,
    institutionId: callerInstitutionId,
    alreadyAssigned
  });
}
