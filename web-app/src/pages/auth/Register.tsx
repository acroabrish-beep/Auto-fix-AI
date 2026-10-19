import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appwriteAuth } from '../../services/auth/appwriteAuth';
import { profilesService } from '../../services/database/profiles';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const account = await appwriteAuth.register(email, password, fullName);

      // Create the database profile
      await profilesService.createProfile({
        userId: account.$id,
        fullName: fullName,
        email: email,
        role: role
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-brand-navy mb-4">Registration Successful</h2>
            <p className="text-slate-600 mb-8">
                Your account has been created. You can now sign in to AutoFix AI.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
                Go to Login
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-4" />
          <h2 className="text-2xl font-bold text-brand-navy">Create Your Account</h2>
          <p className="text-slate-600 mt-2">Join AutoFix AI today</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                placeholder="Min. 8 characters"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">I am a...</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none bg-white transition-all"
              >
                <option value="student">Student</option>
                <option value="mechanic">Professional Mechanic</option>
                <option value="teacher">Instructor/Teacher</option>
                <option value="vehicle_owner">Vehicle Owner</option>
              </select>
            </div>

            <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-blue font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
