import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';
import { Permission, Role } from 'appwrite';

export const studentsService = {
  async listStudentsByDepartment(departmentId: string) {
    const queries = [
      Query.equal('departmentId', departmentId),
      Query.orderAsc('fullName'),
    ];
    return await databaseService.listDocuments<UserProfile>(
      COLLECTIONS.PROFILES,
      queries
    );
  },

  async getStudentProgress(studentId: string, moduleId?: string) {
    const queries: string[] = [
      Query.equal('userId', studentId),
    ];
    if (moduleId) {
      queries.push(Query.equal('moduleId', moduleId));
    }
    return await databaseService.listDocuments<LearningProgress>(
      COLLECTIONS.LEARNING_PROGRESS,
      queries
    );
  },

  async listAttendanceByDepartment(departmentId: string, options?: { startDate?: string; endDate?: string }) {
    const queries: string[] = [
      Query.equal('departmentId', departmentId),
      Query.orderDesc('date'),
    ];
    if (options?.startDate) {
      queries.push(Query.greaterThanEqual('date', options.startDate));
    }
    if (options?.endDate) {
      queries.push(Query.lessThanEqual('date', options.endDate));
    }
    return await databaseService.listDocuments<AttendanceRecord>(
      COLLECTIONS.ATTENDANCE,
      queries
    );
  },

  async recordAttendance(studentId: string, departmentId: string, date: string, present: boolean) {
    const attendanceData = {
      userId: studentId,
      departmentId: departmentId,
      date: date,
      present: present,
      recordedAt: new Date().toISOString(),
    };
    return await databaseService.createDocument<AttendanceRecord>(
      COLLECTIONS.ATTENDANCE,
      attendanceData,
      [Permission.read(Role.user(studentId)), Permission.update(Role.user(studentId))]
    );
  },
};

interface LearningProgress {
  progressPercent: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
}

interface AttendanceRecord {
  userId: string;
  departmentId: string;
  date: string;
  present: boolean;
  recordedAt: string;
}

