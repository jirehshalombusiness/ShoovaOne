import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, Save } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/lib/auth';


export function ChangePasswordPage() {
    const navigate = useNavigate();
    const { updateUser } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setError('');

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (currentPassword === newPassword) {
            setError('New password must be different from your current password.');
            return;
        }

        try {
            setLoading(true);

            await api.post('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });

            // Update the live AuthContext and cached user.
            updateUser({ must_change_password: false });

            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(
                err?.response?.data?.detail ||
                'Unable to change password. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">

                    <div className="flex justify-center mb-6">
                        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                            <KeyRound className="h-6 w-6 text-white" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Change your password
                        </h1>

                        <p className="text-sm text-gray-500 mt-2">
                            Your temporary password must be changed before you can continue.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Current password
                            </label>

                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder="Enter your temporary password"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                New password
                            </label>

                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                placeholder="Enter your new password"
                                minLength={8}
                                required
                            />

                            <p className="text-xs text-gray-500 mt-1">
                                Must be at least 8 characters.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Confirm new password
                            </label>

                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                placeholder="Re-enter your new password"
                                minLength={8}
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                'Changing password...'
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Set new password
                                </>
                            )}
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
}