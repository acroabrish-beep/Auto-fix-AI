/**
 * Appwrite Function: grade-submission
 * 
 * Verifies:
 *   - Caller is instructor or admin
 *   - Instructor owns the assignment or department
 *   - Submission belongs to the assignment's course/department
 *   - Grade and feedback are valid
 * Updates submission grade and feedback only by authorized instructor
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
  
  log('Grade-submission request from user: ' + userId);
  
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
  
  // 5. Verify caller is instructor or admin
  if (callerProfile.role !== 'instructor' && callerProfile.role !== 'global_admin' && callerProfile.role !== 'tvet_admin') {
    return res.status(403).json({ error: 'Instructor or admin access required' });
  }
  
  const callerInstitutionId = callerProfile.institutionId;
  if (!callerInstitutionId) {
    return res.status(403).json({ error: 'Caller not affiliated with an institution' });
  }
  
  // 6. Parse request body
  const { submissionId, grade, feedback } = req.body;
  if (!submissionId) {
    return res.status(400).json({ error: 'submissionId is required' });
  }
  
  // 7. Get the submission record
  let submission;
  try {
    submission = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.SUBMISSIONS,
      submissionId
    );
  } catch (err) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  
  // 8. Verify instructor authorization — instructor must be assigned to the assignment's department/course
  // Check: submission's assignment must be in instructor's department or instructor must be global admin
  if (callerProfile.role !== 'global_admin') {
    const assignment = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.ASSIGNMENTS,
      submission.assignmentId
    );
    
    // Check if instructor is assigned to the same department as the assignment
    if (callerProfile.departmentId && assignment.departmentId && callerProfile.departmentId !== assignment.departmentId) {
      return res.status(403).json({ error: 'Instructor not authorized for this assignment's department' });
    }
    
    // Check if instructor is the assignment creator
    if (assignment.instructorId !== userId && callerProfile.role !== 'global_admin') {
      return res.status(403).json({ error: 'Instructor not authorized for this assignment' });
    }
  }
  
  // 9. Validate grade format (optional but recommended)
  let validatedGrade = grade;
  if (grade !== undefined && grade !== '') {
    // Simple grade validation - accept formats like '85/100', 'A', 'B+', etc.
    const gradePattern = /^([A-F][+-]?|[0-9]+(\.[0-9]+)?)\/100?$/i;
    if (!gradePattern.test(grade)) {
      return res.status(400).json({ error: 'Invalid grade format. Use formats like: 85/100, A, B+' });
    }
  }
  
  // 10. Update submission with grade and feedback
  const updateData: any = {
    grade: validatedGrade,
    updatedAt: new Date().toISOString()
  };
  
  if (feedback !== undefined) {
    updateData.feedback = feedback;
  }
  
  // Update status to 'graded' if a grade is provided
  if (validatedGrade !== undefined && validatedGrade !== '') {
    updateData.status = 'graded';
  }
  
  let updatedSubmission;
  try {
    updatedSubmission = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.SUBMISSIONS,
      submissionId,
      updateData,
      [
        Permission.read(Role.user(submission.studentId)),
        Permission.update(Role.user(userId)),
      ]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update submission: ' + err.message });
  }
  
  // 10. Create audit log entry
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      'unique()',
      {
        actorId: userId,
        action: 'grade_submission',
        targetId: submissionId,
        details: 'Graded submission ' + submissionId + ' by instructor ' + userId + ': grade=' + validatedGrade + ', feedback length=' + (feedback?.length || 0) + ' (institution: ' + callerInstitutionId + ')',
        timestamp: new Date().toISOString(),
        institutionId: callerInstitutionId
      },
      [
        Permission.read(Role.user(userId)),
      ]
    );
  } catch (err) {
    console.error('Audit log creation failed: ' + err.message);
    // Non-fatal — submission update still valid
  }
  
  return res.status(200).json({
    success: true,
    message: 'Submission graded successfully',
    submissionId,
    grade: validatedGrade,
    feedback: feedback || '',
    status: updatedSubmission.status
  });
}
