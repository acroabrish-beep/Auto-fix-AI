import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';

interface CertificateRecord {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  issueDate: string;
  verified: boolean;
  verificationCode: string;
  awardedBy: string;
}

interface CertificateSummary {
  studentId: string;
  courseId: string;
  courseName: string;
  issueDate: string;
  verified: boolean;
}

export const certificatesService = {
  // Issue certificate â€” INSTRUCTOR or ADMIN only, routed through function
  async issueCertificate(_certificateData: {
    studentId: string;
    courseId: string;
    courseName: string;
    awardedBy: string;
  }) {
    // NOTE: Client-side certificate issuance is prevented.
    // Use the issue-certificate Appwrite Function instead.
    throw new Error('Certificate issuance must use issue-certificate Appwrite Function');
  },

  // Get student's certificates â€” student can view only their own
  async getStudentCertificates(studentId: string) {
    const queries = [
      Query.equal('studentId', studentId),
      Query.orderDesc('issueDate')
    ];
    
    return await databaseService.listDocuments<CertificateRecord>(
      COLLECTIONS.CERTIFICATES,
      queries
    );
  },

  // Get certificate by verification code (public verification)
  async getCertificateByCode(verificationCode: string) {
    const queries = [
      Query.equal('verificationCode', verificationCode)
    ];
    
    return await databaseService.listDocuments<CertificateRecord>(
      COLLECTIONS.CERTIFICATES,
      queries
    );
  },
};

export type { CertificateRecord, CertificateSummary };

