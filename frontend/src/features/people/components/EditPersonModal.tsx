import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
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
    }, [person]);

    const updatePerson = useMutation({
        mutationFn: () =>
            peopleService.update(person.id, {
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
            }),
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

                        <textarea
                            placeholder="Bio"
                            rows={4}
                            value={form.bio}
                            onChange={(e) =>
                                updateField('bio', e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
                            Unable to update this person. Please check the details and try again.
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
                            {updatePerson.isPending ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}