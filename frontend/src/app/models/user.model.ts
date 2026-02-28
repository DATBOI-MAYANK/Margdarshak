export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role: 'Traveler' | 'Admin';
  status?: 'active' | 'suspended';
  contact_info?: string;
  profile_picture?: string;
  created_at?: Date;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  admins: number;
  travelers: number;
  recentRegistrations: number;
}

export interface CollaborationStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  edit_access: number;
  view_access: number;
}

export interface Collaboration {
  id: number;
  itinerary_id: number;
  user_id: number;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted' | 'rejected';
  invited_by: number;
  invited_at: Date;
  destination: string;
  itinerary_title: string;
  start_date: Date;
  end_date: Date;
  collaborator_name: string;
  collaborator_email: string;
  inviter_name: string;
  inviter_email: string;
  owner_name: string;
  owner_email: string;
}

export interface TopCollaborator {
  id: number;
  name: string;
  email: string;
  collaboration_count: number;
}

export interface MostSharedItinerary {
  id: number;
  destination: string;
  title: string;
  owner_name: string;
  share_count: number;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'Traveler' | 'Admin';
  contact_info?: string;
}
