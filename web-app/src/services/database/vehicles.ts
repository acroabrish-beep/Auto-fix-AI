import { databaseService, COLLECTIONS, Query } from './index';
import { VehicleProfile } from '../../types';
import { Permission, Role } from 'appwrite';

export const vehiclesService = {
  async listUserVehicles(userId: string): Promise<VehicleProfile[]> {
    return await databaseService.listDocuments<VehicleProfile>(
      COLLECTIONS.VEHICLE_PROFILES,
      [Query.equal('userId', userId)]
    );
  },

  async addVehicle(userId: string, data: Omit<VehicleProfile, keyof import('appwrite').Models.Document | 'userId'>): Promise<VehicleProfile> {
    const permissions = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ];

    return await databaseService.createDocument<VehicleProfile>(
      COLLECTIONS.VEHICLE_PROFILES,
      {
        ...data,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      permissions
    );
  },

  async updateVehicle(vehicleId: string, data: Partial<VehicleProfile>): Promise<VehicleProfile> {
    return await databaseService.updateDocument<VehicleProfile>(
      COLLECTIONS.VEHICLE_PROFILES,
      vehicleId,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      }
    );
  },

  async deleteVehicle(vehicleId: string): Promise<void> {
    await databaseService.deleteDocument(COLLECTIONS.VEHICLE_PROFILES, vehicleId);
  }
};
