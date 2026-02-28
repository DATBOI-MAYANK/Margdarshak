export interface Activity {
  name: string;
  time: string;
  duration: string;
  estimatedCost?: number;
  location?: string;
}

export interface Itinerary {
  id?: number;
  user_id?: number;
  destination: string;
  start_date: string | Date;
  end_date: string | Date;
  budget: number;
  activities?: Activity[];
  notes?: string;
  media_paths?: string[];
  created_at?: Date;
  updated_at?: Date;
  // Collaboration fields
  role?: 'owner' | 'collaborator';
  owner_name?: string;
  collab_permission?: 'view' | 'edit';
}

export interface ItineraryInput {
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  activities?: Activity[];
  notes?: string;
  preferences?: string;
}
