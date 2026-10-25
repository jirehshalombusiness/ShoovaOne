import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { peopleService } from '@/services/people.service';
import type { Person } from '@/types/person.types';

const CLOUDINARY_UPLOAD_URL =
  'https://api.cloudinary.com/v1_1/stanarthur/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'newsletter_upload';
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

interface PersonForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  type: Person['type'];
  status: Person['status'];
  job_title: string;
  department: string;
  employee_number: string;
  employment_type: string;
  location: string;
  reports_to_id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  bio: string;
  skills: string;
}

const EMPTY_FORM: PersonForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  type: 'staff',
  status: 'active',
  job_title: '',
  department: '',
  employee_number: '',
  employment_type: '',
  location: '',
  reports_to_id: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postal_code: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  bio: '',
  skills: '',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function getCreateErrorMessage(error: unknown): string {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : '',
      )
      .filter(Boolean);

    if (messages.length > 0) return messages.join(' ');
  }

  if (error instanceof Error) return error.message;
  return 'Unable to add this person. Please check the details and try again.';
}

export function NewPersonPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<PersonForm>(EMPTY_FORM);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');

  const orgChartQuery = useQuery({
    queryKey: ['people', 'org-chart', 'manager-options'],
    queryFn: () => peopleService.getOrgChart(),
    staleTime: 5 * 60_000,
  });

  const managers = orgChartQuery.data?.nodes ?? [];

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const uploadProfileImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(
        data.error?.message || 'Profile image upload failed.',
      );
    }

    return data.secure_url as string;
  };

  const createPerson = useMutation({
    mutationFn: async () => {
      const profileImageUrl = selectedImage
        ? await uploadProfileImage(selectedImage)
        : null;

      return peopleService.create({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        date_of_birth: form.date_of_birth
          ? `${form.date_of_birth}T00:00:00`
          : null,
        gender: form.gender || null,
        type: form.type,
        status: form.status,
        job_title: form.job_title.trim() || null,
        department: form.department.trim() || null,
        employee_number: form.employee_number.trim() || null,
        employment_type: form.employment_type || null,
        location: form.location.trim() || null,
        reports_to_id: form.reports_to_id || null,
        profile_image_url: profileImageUrl,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        postal_code: form.postal_code.trim() || null,
        emergency_contact_name:
          form.emergency_contact_name.trim() || null,
        emergency_contact_phone:
          form.emergency_contact_phone.trim() || null,
        emergency_contact_relationship:
          form.emergency_contact_relationship.trim() || null,
        bio: form.bio.trim() || null,
        skills: form.skills.trim() || null,
      });
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      toast.success(
        `${person.first_name} ${person.last_name} was added to the directory`,
      );
      navigate('/people');
    },
  });

  const updateField = <K extends keyof PersonForm>(
    field: K,
    value: PersonForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleProfileImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError('');

    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      setImageError('Please select a JPG, PNG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setImageError('Profile image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    event.target.value = '';
  };

  const handleRemoveProfileImage = () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setImageError('');
  };

  const initials =
    `${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/people')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to People
        </button>

        <h1 className="text-xl font-bold text-gray-900">Add Person</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-gray-500">
          Create a directory record for a staff member, volunteer, beneficiary
          or external contact. Staff records can be placed on the org chart and
          included in payroll.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          createPerson.mutate();
        }}
      >
        <Section
          title="Basic Information"
          description="The person's identity as it will appear across the system."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="First name" required>
              <input
                autoFocus
                required
                value={form.first_name}
                onChange={(event) =>
                  updateField('first_name', event.target.value)
                }
                placeholder="e.g. Ama"
                className={inputClass}
              />
            </Field>

            <Field label="Last name" required>
              <input
                required
                value={form.last_name}
                onChange={(event) =>
                  updateField('last_name', event.target.value)
                }
                placeholder="e.g. Mensah"
                className={inputClass}
              />
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(event) =>
                  updateField('date_of_birth', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(event) =>
                  updateField('gender', event.target.value)
                }
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section
          title="Contact Information"
          description="How the organisation can reach this person."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Email address">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField('email', event.target.value)
                }
                placeholder="name@example.org"
                className={inputClass}
              />
            </Field>

            <Field label="Phone number">
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
                placeholder="+233 ..."
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Role & Organisation"
          description="Classification, reporting line and employment details."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Person type">
              <select
                value={form.type}
                onChange={(event) =>
                  updateField('type', event.target.value as Person['type'])
                }
                className={inputClass}
              >
                <option value="staff">Staff</option>
                <option value="volunteer">Volunteer</option>
                <option value="beneficiary">Beneficiary</option>
                <option value="external_contact">External contact</option>
              </select>
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    'status',
                    event.target.value as Person['status'],
                  )
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </Field>

            <Field label="Job title">
              <input
                value={form.job_title}
                onChange={(event) =>
                  updateField('job_title', event.target.value)
                }
                placeholder="e.g. Programme Officer"
                className={inputClass}
              />
            </Field>

            <Field label="Department">
              <input
                value={form.department}
                onChange={(event) =>
                  updateField('department', event.target.value)
                }
                placeholder="e.g. Programmes"
                className={inputClass}
              />
            </Field>

            <Field label="Employee number">
              <input
                value={form.employee_number}
                onChange={(event) =>
                  updateField('employee_number', event.target.value)
                }
                placeholder="e.g. EMP-0142"
                className={inputClass}
              />
            </Field>

            <Field label="Employment type">
              <select
                value={form.employment_type}
                onChange={(event) =>
                  updateField('employment_type', event.target.value)
                }
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </Field>

            <Field
              label="Reports to"
              hint="Used for timesheet and leave approvals."
            >
              <select
                value={form.reports_to_id}
                onChange={(event) =>
                  updateField('reports_to_id', event.target.value)
                }
                className={inputClass}
              >
                <option value="">No manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.first_name} {manager.last_name}
                    {manager.job_title ? ` — ${manager.job_title}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Work location">
              <input
                value={form.location}
                onChange={(event) =>
                  updateField('location', event.target.value)
                }
                placeholder="e.g. Accra"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Address"
          description="Residential or mailing address."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Address" className="md:col-span-2">
              <input
                value={form.address}
                onChange={(event) =>
                  updateField('address', event.target.value)
                }
                placeholder="Street, building, apartment"
                className={inputClass}
              />
            </Field>

            <Field label="City">
              <input
                value={form.city}
                onChange={(event) =>
                  updateField('city', event.target.value)
                }
                placeholder="e.g. Accra"
                className={inputClass}
              />
            </Field>

            <Field label="State / Region">
              <input
                value={form.state}
                onChange={(event) =>
                  updateField('state', event.target.value)
                }
                placeholder="e.g. Greater Accra"
                className={inputClass}
              />
            </Field>

            <Field label="Country">
              <input
                value={form.country}
                onChange={(event) =>
                  updateField('country', event.target.value)
                }
                placeholder="e.g. Ghana"
                className={inputClass}
              />
            </Field>

            <Field label="Postal code">
              <input
                value={form.postal_code}
                onChange={(event) =>
                  updateField('postal_code', event.target.value)
                }
                placeholder="e.g. GA-123-4567"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Emergency Contact"
          description="Who to contact in case of an emergency."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Contact name">
              <input
                value={form.emergency_contact_name}
                onChange={(event) =>
                  updateField('emergency_contact_name', event.target.value)
                }
                placeholder="Full name"
                className={inputClass}
              />
            </Field>

            <Field label="Contact phone">
              <input
                type="tel"
                value={form.emergency_contact_phone}
                onChange={(event) =>
                  updateField('emergency_contact_phone', event.target.value)
                }
                placeholder="+233 ..."
                className={inputClass}
              />
            </Field>

            <Field label="Relationship">
              <input
                value={form.emergency_contact_relationship}
                onChange={(event) =>
                  updateField(
                    'emergency_contact_relationship',
                    event.target.value,
                  )
                }
                placeholder="e.g. Spouse"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Profile"
          description="Optional photo and background information."
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt={`${form.first_name} ${form.last_name}`.trim()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-2xl font-semibold text-slate-500">
                    {initials || <UserPlus className="h-7 w-7 text-slate-400" />}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Profile photo
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Upload a JPG, PNG, or WEBP image. Maximum size is 5 MB.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {imagePreviewUrl ? 'Change photo' : 'Upload photo'}
                  </button>

                  {imagePreviewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveProfileImage}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProfileImageChange}
                  className="hidden"
                />

                {imageError && (
                  <p className="mt-2 text-xs text-red-600">{imageError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label="Bio">
              <textarea
                rows={4}
                value={form.bio}
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder="A short summary of this person's role and experience."
                className={inputClass}
              />
            </Field>

            <Field
              label="Skills"
              hint="Separate skills with commas."
            >
              <input
                value={form.skills}
                onChange={(event) =>
                  updateField('skills', event.target.value)
                }
                placeholder="e.g. Project management, Monitoring & evaluation"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {createPerson.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getCreateErrorMessage(createPerson.error)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => navigate('/people')}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={createPerson.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPerson.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {selectedImage ? 'Uploading & saving...' : 'Adding person...'}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add Person
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}
