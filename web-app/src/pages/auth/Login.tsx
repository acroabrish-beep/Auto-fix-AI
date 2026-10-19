import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appwriteAuth } from '../../services/auth/appwriteAuth';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { AlertCircle, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await appwriteAuth.login(email, password);
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-4" />
          <h2 className="text-2xl font-bold text-brand-navy">Welcome Back</h2>
          <p className="text-slate-600 mt-2">Sign in to your AutoFix AI account</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
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
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-sm text-brand-blue hover:underline">Forgot password?</Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-blue font-semibold hover:underline">
              Create one for free
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
            <Link to="/" className="text-slate-500 hover:text-brand-navy text-sm transition-colors">
                ← Back to Landing Page
            </Link>
        </div>
      </div>
    </div>
  );
};
