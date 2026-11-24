import { databaseService, COLLECTIONS, Query } from './index';
import { UserProfile, UserRole } from '../../types';
import { Permission, Role } from 'appwrite';

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

  async createProfile(data: {
    userId: string;
    fullName: string;
    email: string;
    role?: UserRole;
    institutionId?: string;
    garageId?: string;
    phone?: string;
    specialization?: string;
  }): Promise<UserProfile> {
    // Ordinary callers (public registration) always create a standard student profile.
    // Privileged roles and tenant ownership fields are never accepted from the client;
    // they must be assigned through the authenticated admin-actions backend flow.

    const profileData: Record<string, any> = {
      userId: data.userId,
      fullName: data.fullName,
      email: data.email,
      role: 'student',
      avatarFileId: '',
      preferredLanguage: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Do NOT set institutionId, departmentId, or garageId from client input.
    // These can only be assigned by the server-side admin-actions flow after JWT verification.

    if (data.phone) profileData.phone = data.phone;
    if (data.specialization) profileData.specialization = data.specialization;

    // Set permissions so only the user can read/update their profile
    const permissions = [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
    ];

    return await databaseService.createDocument<UserProfile>(
      COLLECTIONS.PROFILES,
      profileData,
      permissions
    );
  },

  async updateProfile(
    profileId: string,
    data: Partial<UserProfile>,
    options?: { privileged?: boolean }
  ): Promise<UserProfile> {
    // Prevent non-privileged client flows from escalating roles or moving a profile between tenants.
    // The privileged option from the client is never trusted; use the admin-actions backend flow instead.

    const updateData: Record<string, any> = { ...data };

    // Always strip these fields from ordinary client updates, regardless of the privileged flag.
    delete updateData.role;
    delete updateData.institutionId;
    delete updateData.garageId;
    delete updateData.departmentId;

    return await databaseService.updateDocument<UserProfile>(
      COLLECTIONS.PROFILES,
      profileId,
      {
        ...updateData,
        updatedAt: new Date().toISOString(),
      }
    );
  }
};

