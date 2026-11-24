import { databaseService, COLLECTIONS, Query } from './index';
import { UserProfile, UserRole } from '../../types';

interface Department {
  id: string;
  name: string;
  institutionId: string;
  headId: string; // Instructor or admin user ID
  createdAt: string;
}

interface DepartmentWithHead {
  id: string;
  name: string;
  institutionId: string;
  headName: string;
  headRole: UserRole;
  createdAt: string;
}

export const departmentsService = {
  // List departments — scoped to institution
  async listDepartments(institutionId: string) {
    const queries = [
      Query.equal('institutionId', institutionId),
      Query.orderAsc('name')
    ];
    
    return await databaseService.listDocuments<Department>(
      COLLECTIONS.DEPARTMENTS,
      queries
    );
  },

  // Get single department by ID
  async getDepartment(departmentId: string) {
    return await databaseService.getDocument<Department>(
      COLLECTIONS.DEPARTMENTS,
      departmentId
    );
  },

  // Get department with head name — for dashboard displays
  async getDepartmentWithHead(departmentId: string) {
    const dept = await this.getDepartment(departmentId);
    
    // Look up the head's profile for name and role
    let headName = 'Department Head';
    let headRole: UserRole = 'instructor';
    
    try {
      const headProfile = await databaseService.getDocument<UserProfile>(
        COLLECTIONS.PROFILES,
        dept.headId
      );
      headName = headProfile.fullName || 'Department Head';
      headRole = headProfile.role || 'instructor';
    } catch (e) {
      // Head profile not found, use defaults
    }
    
    return {
      ...dept,
      headName,
      headRole
    };
  },

  // List all departments across institution — for admin views
  async listAllDepartments(): Promise<DepartmentWithHead[]> {
    // This would require institution context; in production, institutionId would be known
    // For now, return empty and let admin functions handle it
    return [];
  },
};

export type { Department, DepartmentWithHead };
