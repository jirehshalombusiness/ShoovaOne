export interface Person {
  id: string;

  // Basic identity
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  preferred_name?: string | null;

  // Contact
  email: string | null;
  phone: string | null;
  alternate_phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;

  // Classification
  type: 'staff' | 'volunteer' | 'beneficiary' | 'external_contact';
  status: 'active' | 'inactive' | 'archived';

  // Organisation info
  role?: string | null;
  department?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  position?: string | null;

  // Org chart fields (NEW)
  job_title?: string | null;
  location?: string | null;
  employment_type?: string | null;
  reports_to_id?: string | null;
  reports_to_name?: string | null;

  // Address
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;

  // Profile
  profile_image_url?: string | null;
  bio?: string | null;
  skills?: string[] | string | null;

  // Employment dates
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface PersonRelationship {
  id: string;
  person_id: string;
  type:
    | 'staff'
    | 'volunteer'
    | 'project_member'
    | 'event_participant'
    | 'programme_participant'
    | 'partner_contact'
    | 'donor_contact'
    | 'board_member'
    | 'consultant'
    | 'intern'
    | 'alumni';
  start_date?: string;
  end_date?: string;
  status: 'active' | 'inactive';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PersonActivity {
  id: string;
  person_id: string;
  type:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'relationship_added'
    | 'relationship_removed'
    | 'project_added'
    | 'event_added'
    | 'programme_added'
    | 'document_uploaded'
    | 'interaction_logged';
  description: string;
  user_id?: string;
  user_name?: string;
  metadata?: Record<string, any>;
  created_at: string;
}