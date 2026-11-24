import React, { createContext, useContext, useEffect, useState } from 'react';
import { appwriteAuth } from '../services/auth/appwriteAuth';
import { profilesService } from '../services/database/profiles';
import { Models } from 'appwrite';
import { UserProfile } from '../types';

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const currentUser = await appwriteAuth.getCurrentUser();
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        return;
      }

      // A profile/DB failure must NOT log out a valid Appwrite session —
      // otherwise the dashboard redirect bounces straight back to /login.
      // Also, do not create a profile merely because the database request failed;
      // let the admin-actions backend handle profile creation after JWT verification.
      try {
        let userProfile = await profilesService.getProfile(currentUser.$id);

        // Only provision a profile if it genuinely doesn't exist (not due to DB error).
        // The server verifies the JWT and always creates a student profile.
        if (!userProfile) {
          try {
            userProfile = await profilesService.ensureMyProfile();
          } catch (createError) {
            // Database/function unavailable — do not crash a valid auth session.
            console.error('Profile provisioning failed:', createError);
            setProfile(null);
            setLoading(false);
            return;
          }
        }
        setProfile(userProfile);
      } catch (profileError) {
        console.error('Failed to load profile:', profileError);
        // Keep existing session alive; profile creation is server-side responsibility.
        // Do NOT setUser(null) / setProfile(null) here, which would log out a valid Appwrite user.
        setProfile(profile); // preserve whatever profile we had before
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const signOut = async () => {
    try {
      await appwriteAuth.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      signOut,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
