import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';
import { Assignment } from '../../types';

export const assignmentsService = {
  // List assignments scoped to institution/department
  async listAssignments(institutionId?: string, departmentId?: string, courseId?: string) {
    const queries: string[] = [];
    
    if (institutionId) {
      queries.push(Query.equal('institutionId', institutionId));
    }
    if (departmentId) {
      queries.push(Query.equal('departmentId', departmentId));
    }
    if (courseId) {
      queries.push(Query.equal('courseId', courseId));
    }
    
    queries.push(Query.orderDesc('createdAt'));
    
    return await databaseService.listDocuments<Assignment>(
      COLLECTIONS.ASSIGNMENTS,
      queries
    );
  },

  // Get single assignment by ID
  async getAssignment(assignmentId: string) {
    return await databaseService.getDocument<Assignment>(
      COLLECTIONS.ASSIGNMENTS,
      assignmentId
    );
  },

  // Create assignment â€” INSTRUCTOR only, routed through admin function
  // This is a placeholder; actual creation should use assign-instructor-to-department function
  async createAssignment(_assignmentData: any) {
    // NOTE: Client-side direct creation is prevented.
    // Use the assign-instructor-to-department Appwrite Function instead.
    throw new Error('Assignment creation must use admin Actions function');
  },

  // List assignments for student â€” only their enrollments
  async listStudentAssignments(studentId: string) {
    const queries = [
      Query.equal('status', 'active'),
      // In a full implementation, would filter by student's department/enrollment
      Query.orderDesc('createdAt')
    ];
    
    return await databaseService.listDocuments<Assignment>(
      COLLECTIONS.ASSIGNMENTS,
      queries
    );
  },

  // Update assignment â€” instructor only
  async updateAssignment(assignmentId: string, data: Partial<Assignment>) {
    // Strip fields that shouldn't be client-modifiable
    const cleanData: Partial<Assignment> = { ...data };
    delete cleanData.instructorId;
    
    return await databaseService.updateDocument<Assignment>(
      COLLECTIONS.ASSIGNMENTS,
      assignmentId,
      cleanData
    );
  },
};

export type { Assignment };

