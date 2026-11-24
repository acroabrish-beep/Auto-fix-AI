import { databaseService, COLLECTIONS, Query } from './core';
import { UserProfile, UserRole } from '../../types';
import { runAdminAction } from '../ai/adminActions';

export type ManagedProfileRole = 'instructor' | 'student' | 'mechanic';

/**
 * Profile reads remain owner-readable through Appwrite document permissions.
 * Every profile write goes through diagnostic-ai, which derives the caller's
 * identity from a verified JWT and loads role/tenant fields server-side.
 */
export const profilesService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const profiles = await databaseService.listDocuments<UserProfile>(
        COLLECTIONS.PROFILES,
        [Query.equal('userId', userId)]
      );
      return profiles.length > 0 ? profiles[0] : null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  /**
   * Idempotently provision the signed-in user's own profile. The server always
   * creates a standard student profile and ignores any role/tenant fields.
   */
  async ensureMyProfile(): Promise<UserProfile> {
    return await runAdminAction<UserProfile>('ensure_my_profile');
  },

  /**
   * Create a managed instructor/student/mechanic profile. The server validates
   * the caller's admin role and uses the caller's trusted institution/garage.
   */
  async createManagedProfile(data: {
    fullName: string;
    email: string;
    role: ManagedProfileRole;
    phone?: string;
    specialization?: string;
  }): Promise<UserProfile> {
    return await runAdminAction<UserProfile>('create_managed_profile', data);
  },

  /**
   * Update only self-service profile fields. The server repeats the allowlist;
   * role, institutionId, departmentId, garageId and status are never accepted
   * from the client.
   */
  async updateProfile(
    profileId: string,
    data: Partial<UserProfile>
  ): Promise<UserProfile> {
    const allowed: Record<string, string> = {};
    for (const key of ['fullName', 'preferredLanguage', 'avatarFileId', 'phone', 'specialization'] as const) {
      const value = data[key];
      if (typeof value === 'string') allowed[key] = value;
    }

    return await runAdminAction<UserProfile>('update_my_profile', {
      profileId,
      data: allowed,
    });
  },

  /**
   * Enroll the current student in a course. The server validates the student's
   * trusted profile, verifies the course belongs to the same institution/department,
   * and creates an enrollment record. Client-supplied institution/department are
   * never trusted.
   */
  async enrollInCourse(courseId: string): Promise<{ success: boolean; alreadyEnrolled?: boolean }> {
    return await runAdminAction<{ success: boolean; alreadyEnrolled?: boolean }>('enroll_in_course', {
      courseId,
    });
  },

  /**
   * Get the courses the current student is enrolled in.
   */
  async getEnrolledCourses(): Promise<string[]> {
    const result = await runAdminAction<{ success: boolean; enrollments: { courseId: string }[] }>('get_enrolled_courses', {});
    return result.enrollments?.map((e: { courseId: string }) => e.courseId) || [];
  },
};

// Keep the imported role type visible for callers that need the domain union.
export type { UserRole };

