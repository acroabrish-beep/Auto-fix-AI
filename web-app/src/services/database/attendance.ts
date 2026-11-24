import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';

interface AttendanceRecord {
  id: string;
  studentId: string;
  departmentId: string;
  courseId?: string;
  date: string;
  present: boolean;
  recordedBy: string;
  recordedAt: string;
}

interface AttendanceSummary {
  studentId: string;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  attendanceRate: number;
}

export const attendanceService = {
  // Record attendance â€” INSTRUCTOR or DEPT_ADMIN only, routed through function
  async recordAttendance(_attendanceData: {
    studentId: string;
    departmentId: string;
    courseId?: string;
    date: string;
    present: boolean;
  }) {
    // NOTE: Client-side attendance recording is prevented.
    // Use the record-attendance Appwrite Function instead.
    throw new Error('Attendance recording must use record-attendance Appwrite Function');
  },

  // Get attendance for a specific student â€” student can view only their own
  async getStudentAttendance(studentId: string) {
    const queries = [
      Query.equal('studentId', studentId),
      Query.orderDesc('date')
    ];
    
    return await databaseService.listDocuments<AttendanceRecord>(
      COLLECTIONS.ATTENDANCE,
      queries
    );
  },

  // Get attendance summary for a student
  async getAttendanceSummary(studentId: string): Promise<AttendanceSummary> {
    const records = await this.getStudentAttendance(studentId);
    
    let totalSessions = records.length;
    let presentSessions = 0;
    
    records.forEach((record) => {
      if (record.present) {
        presentSessions++;
      }
    });
    
    const absentSessions = totalSessions - presentSessions;
    const attendanceRate = totalSessions > 0 
      ? Math.round((presentSessions / totalSessions) * 100) 
      : 0;
    
    return {
      studentId,
      totalSessions,
      presentSessions,
      absentSessions,
      attendanceRate
    };
  },

  // Get attendance summary for department â€” dept admin only
  async getDepartmentAttendanceSummary(departmentId: string, instructorId?: string) {
    const queries = [
      Query.equal('departmentId', departmentId),
      Query.orderDesc('date')
    ];
    
    return await databaseService.listDocuments<AttendanceRecord>(
      COLLECTIONS.ATTENDANCE,
      queries
    );
  },
};

export type { AttendanceRecord, AttendanceSummary };

