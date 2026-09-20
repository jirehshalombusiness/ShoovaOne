import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  AlertCircle,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { meService, type MeProfile, type MeProfileUpdate } from '@/services/me.service';
import { cn } from '@/lib/utils';

export function MeProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => meService.getProfile(),
  });

  const [form, setForm] = useState<MeProfileUpdate>({});
  const [dirty, setDirty] = useState(false);

  // Seed form when profile loads
  useEffect(() => {
    if (!profileQuery.data) return;
    const p = profileQuery.data;
    setForm({
      phone: p.phone ?? '',
      address: p.address ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      country: p.country ?? '',
      postal_code: p.postal_code ?? '',
      emergency_contact_name: p.emergency_contact_name ?? '',
      emergency_contact_phone: p.emergency_contact_phone ?? '',
      emergency_contact_relationship: p.emergency_contact_relationship ?? '',
      bio: p.bio ?? '',
    });
    setDirty(false);
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => meService.updateProfile(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Profile updated');
      setDirty(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update profile');
    },
  });

  const handleChange = (key: keyof MeProfileUpdate, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    updateMutation.mutate();
  };

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!profileQuery.data) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          Could not load your profile. Try refreshing.
        </div>
      </div>
    );
  }

  const p = profileQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your contact details and personal information
        </p>
      </div>

      {/* Identity header — read-only */}
      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-semibold text-xl flex items-center justify-center flex-shrink-0">
            {(p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">
              {p.first_name} {p.last_name}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
              {p.job_title && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  {p.job_title}
                </span>
              )}
              {p.employment_type && (
                <span className="flex items-center gap-1.5 capitalize">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  {p.employment_type.replace(/_/g, ' ')}
                </span>
              )}
              {p.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {p.location}
                </span>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-medium">Employee #:</span>{' '}
              {p.id.slice(0, 8).toUpperCase()}
              {' · '}
              <span className="font-medium">Joined:</span>{' '}
              {p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-md">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800">
            To change your name, job title, or employment details, contact HR.
          </div>
        </div>
      </div>

      {/* Editable form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact */}
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              icon={Mail}
              label="Email"
              value={p.email ?? ''}
              disabled
              hint="Contact HR to change your email"
            />
            <Field
              icon={Phone}
              label="Phone"
              value={form.phone ?? ''}
              onChange={(v) => handleChange('phone', v)}
              placeholder="+233 20 123 4567"
            />
            <Field
              label="Address"
              value={form.address ?? ''}
              onChange={(v) => handleChange('address', v)}
              placeholder="Street address"
              className="md:col-span-2"
            />
            <Field
              label="City"
              value={form.city ?? ''}
              onChange={(v) => handleChange('city', v)}
              placeholder="Accra"
            />
            <Field
              label="State / Region"
              value={form.state ?? ''}
              onChange={(v) => handleChange('state', v)}
              placeholder="Greater Accra"
            />
            <Field
              label="Country"
              value={form.country ?? ''}
              onChange={(v) => handleChange('country', v)}
              placeholder="Ghana"
            />
            <Field
              label="Postal Code"
              value={form.postal_code ?? ''}
              onChange={(v) => handleChange('postal_code', v)}
              placeholder="GA-123-4567"
            />
          </div>
        </div>

        {/* Emergency contact */}
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              icon={User}
              label="Name"
              value={form.emergency_contact_name ?? ''}
              onChange={(v) => handleChange('emergency_contact_name', v)}
              placeholder="Full name"
            />
            <Field
              icon={Phone}
              label="Phone"
              value={form.emergency_contact_phone ?? ''}
              onChange={(v) => handleChange('emergency_contact_phone', v)}
              placeholder="+233 20 123 4567"
            />
            <Field
              label="Relationship"
              value={form.emergency_contact_relationship ?? ''}
              onChange={(v) =>
                handleChange('emergency_contact_relationship', v)
              }
              placeholder="Spouse, parent, sibling…"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">About</h3>
          <textarea
            value={form.bio ?? ''}
            onChange={(e) => handleChange('bio', e.target.value)}
            rows={4}
            placeholder="A short bio about yourself…"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {dirty && (
            <span className="text-xs text-amber-700">
              You have unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={!dirty || updateMutation.isPending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              dirty && !updateMutation.isPending
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  hint,
  className,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
        {Icon && <Icon className="w-3 h-3 text-gray-400" />}
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border rounded-md text-sm transition-colors',
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
            : 'border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        )}
      />
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}