import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';
import { Permission, Role } from 'appwrite';

interface SubmissionRecord {
  id: string;
  studentId: string;
  assignmentId: string;
  content: string;
  submittedAt: string;
  status: 'pending' | 'graded' | 'returned';
  grade?: string;
  feedback?: string;
  institutionId: string;
  departmentId?: string;
}

export const submissionsService = {
  // List submissions for a specific student â€” only their own work
  async listStudentSubmissions(studentId: string) {
    const queries = [
      Query.equal('studentId', studentId),
      Query.orderDesc('submittedAt')
    ];
    
    return await databaseService.listDocuments<SubmissionRecord>(
      COLLECTIONS.SUBMISSIONS,
      queries
    );
  },

  // List submissions for an assignment â€” instructor can view
  async listAssignmentSubmissions(assignmentId: string, instructorId: string) {
    const queries = [
      Query.equal('assignmentId', assignmentId),
      // In full implementation, verify instructor owns this assignment's department
      Query.orderDesc('submittedAt')
    ];
    
    return await databaseService.listDocuments<SubmissionRecord>(
      COLLECTIONS.SUBMISSIONS,
      queries
    );
  },

  // Create submission â€” STUDENT only
  async createSubmission(submissionData: {
    assignmentId: string;
    content: string;
    studentId: string;
    institutionId: string;
    departmentId?: string;
  }) {
    // Verify required fields
    if (!submissionData.assignmentId || !submissionData.content || !submissionData.studentId) {
      throw new Error('Assignment ID, content, and student ID are required');
    }
    
    const data = {
      studentId: submissionData.studentId,
      assignmentId: submissionData.assignmentId,
      content: submissionData.content,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      institutionId: submissionData.institutionId || '',
      departmentId: submissionData.departmentId || '',
    };
    
    return await databaseService.createDocument<SubmissionRecord>(
      COLLECTIONS.SUBMISSIONS,
      data,
      [
        // Students can only read their own submissions
        Permission.read(Role.user(submissionData.studentId)),
        Permission.create(Role.user(submissionData.studentId)),
      ]
    );
  },

  // Grade submission â€” INSTRUCTOR only, routed through admin function
  async gradeSubmission(_submissionId: string, _grade: string, _feedback: string) {
    // NOTE: Client-side grading is prevented.
    // Use the grade-submission Appwrite Function instead.
    throw new Error('Grading must use grade-submission Appwrite Function');
  },
};

export type { SubmissionRecord };

