import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, LogIn, Eye, EyeOff, Shield, Users, Zap } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
      }
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SHOOVA ONE</h1>
                <p className="text-xs text-gray-500">Management & Impact Platform</p>
              </div>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to access your workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="you@shoova.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary-dark transition-colors font-medium"
                  onClick={() => {/* Handle forgot password */}}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary/20"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                Remember me for 30 days
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-500">
                Secure access
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <Shield className="h-4 w-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Secure</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Collaborative</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <Zap className="h-4 w-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Efficient</p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-8">
            © {new Date().getFullYear()} Shoova Initiative. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary to-primary-dark relative overflow-hidden">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Manage your organisation with clarity and purpose
            </h2>
            <p className="text-white/80 text-sm leading-relaxed mb-8">
              Shoova ONE unifies your people, projects, programmes, and partnerships 
              into a single, connected operating system.
            </p>

            {/* Feature List */}
            <div className="space-y-4">
              {[
                'Central identity and directory',
                'Project and programme management',
                'Timesheet and attendance tracking',
                'Partnership and stakeholder management',
                'Impact measurement and reporting',
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  <span className="text-sm text-white/90">{feature}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-12 pt-8 border-t border-white/20">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-2xl font-bold">1</p>
                  <p className="text-xs text-white/60 mt-0.5">Unified Platform</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">∞</p>
                  <p className="text-xs text-white/60 mt-0.5">Possibilities</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-xs text-white/60 mt-0.5">Access</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}