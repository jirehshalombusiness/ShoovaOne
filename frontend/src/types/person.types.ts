export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  preferred_name?: string;
  email: string | null;
  phone: string | null;
  alternate_phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  type: 'staff' | 'volunteer' | 'beneficiary' | 'external_contact';
  status: 'active' | 'inactive' | 'archived';
  role?: string;
  department?: string;
  organization?: string;
  organization_id?: string;
  position?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  profile_image_url?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
  skills?: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface PersonRelationship {
  id: string;
  person_id: string;
  type: 'staff' | 'volunteer' | 'project_member' | 'event_participant' | 'programme_participant' | 'partner_contact' | 'donor_contact' | 'board_member' | 'consultant' | 'intern' | 'alumni';
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
  type: 'created' | 'updated' | 'status_changed' | 'relationship_added' | 'relationship_removed' | 'project_added' | 'event_added' | 'programme_added' | 'document_uploaded' | 'interaction_logged';
  description: string;
  user_id?: string;
  user_name?: string;
  metadata?: Record<string, any>;
  created_at: string;
}