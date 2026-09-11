export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string | null;   // ← ADD
  job_title?: string | null;           // ← ADD
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}