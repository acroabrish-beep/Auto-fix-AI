import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { profilesService } from '../services/database/profiles';

export type AppRole =
  | 'global_admin'
  | 'tvet_admin'
  | 'department_admin'
  | 'instructor'
  | 'student'
  | 'garage_admin'
  | 'mechanic';

export interface UseRoleResult {
  role: AppRole | null;
  loading: boolean;
  isGlobalAdmin: boolean;
  isTvetAdmin: boolean;
  isDepartmentAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isGarageAdmin: boolean;
  isMechanic: boolean;
}

/**
 * Resolves the signed-in user's SaaS role from their Appwrite profile.
 */
export const useRole = (): UseRoleResult => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setRole(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    profilesService
      .getProfile(user.$id)
      .then((profile) => {
        if (cancelled) return;
        // Fail closed: if no profile exists, keep role null rather than defaulting to student
        if (!profile) {
          setRole(null);
        } else {
          setRole(profile.role as AppRole | null);
        }
      })
      .catch((error) => {
        console.error('Failed to load user role:', error);
        // Fail closed: keep role null on error rather than defaulting to student
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    role,
    loading,
    isGlobalAdmin: role === 'global_admin',
    isTvetAdmin: role === 'tvet_admin',
    isDepartmentAdmin: role === 'department_admin',
    isInstructor: role === 'instructor',
    isStudent: role === 'student',
    isGarageAdmin: role === 'garage_admin',
    isMechanic: role === 'mechanic',
  };
};
