import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { Person } from '@/types/person.types';
import { peopleService } from '@/services/people.service';

interface EditPersonModalProps {
    person: Person;
    onClose: () => void;
}

export function EditPersonModal({
    person,
    onClose,
}: EditPersonModalProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
        person.profile_image_url || null,
    );
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
        person.profile_image_url || null,
    );
    const [removeProfileImage, setRemoveProfileImage] = useState(false);
    const [imageError, setImageError] = useState('');

    const CLOUDINARY_UPLOAD_URL =
        'https://api.cloudinary.com/v1_1/stanarthur/image/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'newsletter_upload';
    const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_PROFILE_IMAGE_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    const [form, setForm] = useState({
        first_name: person.first_name || '',
        middle_name: person.middle_name || '',
        last_name: person.last_name || '',
        preferred_name: person.preferred_name || '',
        email: person.email || '',
        phone: person.phone || '',
        alternate_phone: person.alternate_phone || '',
        date_of_birth: person.date_of_birth
            ? person.date_of_birth.split('T')[0]
            : '',
        gender: person.gender || '',
        type: person.type || 'staff',
        status: person.status || 'active',
        role: person.role || '',
        department: person.department || '',
        organization: person.organization || '',
        position: person.position || '',
        job_title: person.job_title || '',
        location: person.location || '',
        employment_type: person.employment_type || '',
        address: person.address || '',
        city: person.city || '',
        state: person.state || '',
        country: person.country || '',
        postal_code: person.postal_code || '',
        bio: person.bio || '',
        skills: Array.isArray(person.skills)
            ? person.skills.join(', ')
            : person.skills || '',
        start_date: person.start_date || '',
        end_date: person.end_date || '',
        notes: person.notes || '',
    });

    useEffect(() => {
        setForm({
            first_name: person.first_name || '',
            middle_name: person.middle_name || '',
            last_name: person.last_name || '',
            preferred_name: person.preferred_name || '',
            email: person.email || '',
            phone: person.phone || '',
            alternate_phone: person.alternate_phone || '',
            date_of_birth: person.date_of_birth
                ? person.date_of_birth.split('T')[0]
                : '',
            gender: person.gender || '',
            type: person.type || 'staff',
            status: person.status || 'active',
            role: person.role || '',
            department: person.department || '',
            organization: person.organization || '',
            position: person.position || '',
            job_title: person.job_title || '',
            location: person.location || '',
            employment_type: person.employment_type || '',
            address: person.address || '',
            city: person.city || '',
            state: person.state || '',
            country: person.country || '',
            postal_code: person.postal_code || '',
            bio: person.bio || '',
            skills: Array.isArray(person.skills)
                ? person.skills.join(', ')
                : person.skills || '',
            start_date: person.start_date || '',
            end_date: person.end_date || '',
            notes: person.notes || '',
        });

        setProfileImageUrl(person.profile_image_url || null);
        setSelectedImage(null);
        setRemoveProfileImage(false);
        setImageError('');
        setImagePreviewUrl(person.profile_image_url || null);
    }, [person]);

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

    const updatePerson = useMutation({
        mutationFn: async () => {
            let nextProfileImageUrl = profileImageUrl;

            if (selectedImage) {
                nextProfileImageUrl = await uploadProfileImage(selectedImage);
            } else if (removeProfileImage) {
                nextProfileImageUrl = null;
            }

            return peopleService.update(person.id, {
                ...form,
                email: form.email || null,
                middle_name: form.middle_name || null,
                preferred_name: form.preferred_name || null,
                phone: form.phone || null,
                alternate_phone: form.alternate_phone || null,
                date_of_birth: form.date_of_birth
                    ? `${form.date_of_birth}T00:00:00`
                    : null,
                gender: form.gender || null,
                role: form.role || null,
                department: form.department || null,
                organization: form.organization || null,
                position: form.position || null,
                job_title: form.job_title || null,
                location: form.location || null,
                employment_type: form.employment_type || null,
                address: form.address || null,
                city: form.city || null,
                state: form.state || null,
                country: form.country || null,
                postal_code: form.postal_code || null,
                bio: form.bio || null,
                skills: form.skills || null,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                notes: form.notes || null,
                profile_image_url: nextProfileImageUrl,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['person', person.id],
            });

            queryClient.invalidateQueries({
                queryKey: ['people'],
            });

            onClose();
        },
    });

    const updateField = (field: keyof typeof form, value: string) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
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

        const previewUrl = URL.createObjectURL(file);

        setSelectedImage(file);
        setImagePreviewUrl(previewUrl);
        setProfileImageUrl(null);
        setRemoveProfileImage(false);
        event.target.value = '';
    };

    const handleRemoveProfileImage = () => {
        setSelectedImage(null);
        setProfileImageUrl(null);
        setImagePreviewUrl(null);
        setRemoveProfileImage(true);
        setImageError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Edit person
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Update this person's information.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form
                    className="space-y-6 p-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        updatePerson.mutate();
                    }}
                >
                    {/* Basic Information */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                required
                                placeholder="First name"
                                value={form.first_name}
                                onChange={(e) =>
                                    updateField('first_name', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Middle name"
                                value={form.middle_name}
                                onChange={(e) =>
                                    updateField('middle_name', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                required
                                placeholder="Last name"
                                value={form.last_name}
                                onChange={(e) =>
                                    updateField('last_name', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Preferred name"
                                value={form.preferred_name}
                                onChange={(e) =>
                                    updateField('preferred_name', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                type="date"
                                value={form.date_of_birth}
                                onChange={(e) =>
                                    updateField('date_of_birth', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <select
                                value={form.gender}
                                onChange={(e) =>
                                    updateField('gender', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                <option value="">Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                                <option value="prefer_not_to_say">
                                    Prefer not to say
                                </option>
                            </select>
                        </div>
                    </section>

                    {/* Contact */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Contact Information
                        </h3>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                type="email"
                                placeholder="Email address"
                                value={form.email}
                                onChange={(e) =>
                                    updateField('email', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Phone"
                                value={form.phone}
                                onChange={(e) =>
                                    updateField('phone', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Alternate phone"
                                value={form.alternate_phone}
                                onChange={(e) =>
                                    updateField('alternate_phone', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                        </div>
                    </section>

                    {/* Organisation */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Organisation
                        </h3>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <select
                                value={form.type}
                                onChange={(e) =>
                                    updateField('type', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                <option value="staff">Staff</option>
                                <option value="volunteer">Volunteer</option>
                                <option value="beneficiary">Beneficiary</option>
                                <option value="external_contact">
                                    External Contact
                                </option>
                            </select>

                            <select
                                value={form.status}
                                onChange={(e) =>
                                    updateField('status', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="archived">Archived</option>
                            </select>

                            <input
                                placeholder="Role"
                                value={form.role}
                                onChange={(e) =>
                                    updateField('role', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Department"
                                value={form.department}
                                onChange={(e) =>
                                    updateField('department', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Organisation"
                                value={form.organization}
                                onChange={(e) =>
                                    updateField('organization', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Position"
                                value={form.position}
                                onChange={(e) =>
                                    updateField('position', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Job title"
                                value={form.job_title}
                                onChange={(e) =>
                                    updateField('job_title', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Location"
                                value={form.location}
                                onChange={(e) =>
                                    updateField('location', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Employment type"
                                value={form.employment_type}
                                onChange={(e) =>
                                    updateField('employment_type', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                        </div>
                    </section>

                    {/* Address */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Address
                        </h3>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                placeholder="Address"
                                value={form.address}
                                onChange={(e) =>
                                    updateField('address', e.target.value)
                                }
                                className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="City"
                                value={form.city}
                                onChange={(e) =>
                                    updateField('city', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="State / Region"
                                value={form.state}
                                onChange={(e) =>
                                    updateField('state', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Country"
                                value={form.country}
                                onChange={(e) =>
                                    updateField('country', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                placeholder="Postal code"
                                value={form.postal_code}
                                onChange={(e) =>
                                    updateField('postal_code', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                        </div>
                    </section>

                    {/* Employment */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Employment
                        </h3>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                type="date"
                                value={form.start_date}
                                onChange={(e) =>
                                    updateField('start_date', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />

                            <input
                                type="date"
                                value={form.end_date}
                                onChange={(e) =>
                                    updateField('end_date', e.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                        </div>
                    </section>

                    {/* Profile */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            Profile
                        </h3>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
                                    {imagePreviewUrl ? (
                                        <img
                                            src={imagePreviewUrl}
                                            alt={`${form.first_name} ${form.last_name}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-2xl font-semibold text-slate-500">
                                            {(form.first_name?.[0] || '').toUpperCase()}
                                            {(form.last_name?.[0] || '').toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900">Profile photo</p>
                                    <p className="mt-1 text-xs leading-5 text-gray-500">
                                        Upload a JPG, PNG, or WEBP image. Maximum size is 5 MB.
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            <ImagePlus className="h-4 w-4" />
                                            {imagePreviewUrl ? 'Change photo' : 'Upload photo'}
                                        </button>

                                        {imagePreviewUrl && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveProfileImage}
                                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
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

                        <textarea
                            placeholder="Bio"
                            rows={4}
                            value={form.bio}
                            onChange={(e) =>
                                updateField('bio', e.target.value)
                            }
                            className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />

                        <input
                            placeholder="Skills (comma separated)"
                            value={form.skills}
                            onChange={(e) =>
                                updateField('skills', e.target.value)
                            }
                            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />

                        <textarea
                            placeholder="Notes"
                            rows={3}
                            value={form.notes}
                            onChange={(e) =>
                                updateField('notes', e.target.value)
                            }
                            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                    </section>

                    {updatePerson.isError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {updatePerson.error instanceof Error ? updatePerson.error.message : 'Unable to update this person. Please check the details and try again.'}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={updatePerson.isPending}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                            {updatePerson.isPending ? (selectedImage ? 'Uploading & saving...' : 'Saving...') : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}