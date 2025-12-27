// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  last_name: string;
  first_name: string;
  middle_name?: string;
  phone: string;
  email: string;
  password: string;
  city: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  comment: string | null;
  roles: Role[];
  directions: Direction[];
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  parent_role_id: number | null;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string | null;
  parent_role_id: number | null;
  parent_role_name: string | null;
}

export interface RoleCreate {
  name: string;
  description?: string;
  parent_role_id?: number;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  parent_role_id?: number;
}

export interface Direction {
  id: number;
  name: string;
  description: string | null;
  responsible_user_id: number | null;
  responsible_user_name: string | null;
}

export interface DirectionCreate {
  name: string;
  description?: string;
  responsible_user_id?: number;
}

export interface DirectionUpdate {
  name?: string;
  description?: string;
  responsible_user_id?: number;
}

export interface UserUpdate {
  status?: string;
  comment?: string;
  role_ids?: number[];
  direction_ids?: number[];
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface UsersListResponse {
  users: User[];
  total: number;
}

// User brief type
export interface UserBrief {
  id: number;
  full_name: string;
}

// Field search types
export interface FieldSearch {
  id: number;
  search_id: number;
  search: {
    id: number;
    case_id: number;
    case: {
      id: number;
      missing_full_name: string;
    } | null;
    latest_orientation_image: string | null;
  } | null;
  case_id: number | null;
  created_at: string;
  initiator_inforg_id: number | null;
  initiator_inforg: UserBrief | null;
  coordinator_id: number | null;
  coordinator: UserBrief | null;
  start_date: string | null;
  flyer_id: number | null;
  meeting_datetime: string | null;
  meeting_place: string | null;
  status: string;
  end_date: string | null;
  result: string | null;
  notes: string | null;

  // Preparation section
  preparation_grid_file: string | null;
  preparation_map_image: string | null;
  grid_center_lat: number | null;
  grid_center_lon: number | null;
  grid_cols: number | null;
  grid_rows: number | null;
  grid_cell_size: number | null;

  // Search progress section
  search_tracks: string[];
  search_photos: string[];
}

// Search types
export interface Search {
  id: number;
  case_id: number;
  case: {
    id: number;
    applicant_full_name: string;
    missing_full_name: string;
  } | null;
  created_at: string;
  initiator_inforg_id: number | null;
  initiator_inforg: UserBrief | null;
  start_date: string | null;
  end_date: string | null;
  result: string | null;
  result_comment: string | null;
  current_flyer_id: number | null;
  status: string;
  notes: string | null;
  latest_orientation_image: string | null;
}

export interface SearchCreate {
  case_id: number;
  initiator_inforg_id?: number;
  start_date?: string;
  end_date?: string;
  result?: string;
  result_comment?: string;
  status?: string;
  notes?: string;
}

export interface SearchUpdate {
  initiator_inforg_id?: number;
  start_date?: string;
  end_date?: string;
  result?: string;
  result_comment?: string;
  current_flyer_id?: number;
  status?: string;
  notes?: string;
}

export interface SearchListResponse {
  total: number;
  searches: Search[];
}

export interface SearchFull extends Search {
  case: Case | null;  // Override to include full case data for orientations
  flyers?: any[];
  orientations?: Orientation[];
  distributions?: any[];
  map_grids?: any[];
  field_searches?: FieldSearch[];
  events?: Event[];
}

// Case types
export interface Case {
  id: number;
  created_at: string;
  created_by_user_id: number | null;
  created_by: UserBrief | null;
  updated_at: string | null;
  updated_by_user_id: number | null;
  updated_by: UserBrief | null;
  // Basis
  basis: string | null;
  // Applicant - split name fields
  applicant_last_name: string;
  applicant_first_name: string;
  applicant_middle_name: string | null;
  applicant_phone: string | null;
  applicant_relation: string | null;
  // Missing person - location fields
  missing_settlement: string | null;
  missing_region: string | null;
  missing_address: string | null;
  // Missing person - split name fields
  missing_last_name: string;
  missing_first_name: string;
  missing_middle_name: string | null;
  missing_gender: string | null;
  missing_birthdate: string | null;
  missing_photos: string[];
  missing_last_seen_datetime: string | null;
  missing_last_seen_place: string | null;
  missing_description: string | null;
  missing_special_signs: string | null;
  missing_diseases: string | null;
  missing_phone: string | null;
  missing_clothing: string | null;
  missing_belongings: string | null;
  // Additional case information
  additional_search_regions: string[];
  search_terrain_type: string | null;
  disappearance_circumstances: string | null;
  initial_info: string | null;
  additional_info: string | null;
  // Police information
  police_report_filed: boolean;
  police_report_date: string | null;
  police_department: string | null;
  police_contact_user_id: number | null;
  police_contact: UserBrief | null;
  // Notes
  notes_text: string | null;
  notes_images: string[];
  // Computed full names
  applicant_full_name: string;
  missing_full_name: string;
  decision_type: string;
  decision_comment: string | null;
  tags: string[];
}

export interface CaseCreate {
  // Basis
  basis?: string;
  // Applicant - split name fields
  applicant_last_name: string;
  applicant_first_name: string;
  applicant_middle_name?: string;
  applicant_phone?: string;
  applicant_relation?: string;
  // Missing person - location fields
  missing_settlement?: string;
  missing_region?: string;
  missing_address?: string;
  // Missing person - split name fields
  missing_last_name: string;
  missing_first_name: string;
  missing_middle_name?: string;
  missing_gender?: string;
  missing_birthdate?: string;
  missing_photos?: string[];
  missing_last_seen_datetime?: string;
  missing_last_seen_place?: string;
  missing_description?: string;
  missing_special_signs?: string;
  missing_diseases?: string;
  missing_phone?: string;
  missing_clothing?: string;
  missing_belongings?: string;
  // Additional case information
  additional_search_regions?: string[];
  search_terrain_type?: string;
  disappearance_circumstances?: string;
  initial_info?: string;
  additional_info?: string;
  // Police information
  police_report_filed?: boolean;
  police_report_date?: string;
  police_department?: string;
  police_contact_user_id?: number;
  // Notes
  notes_text?: string;
  notes_images?: string[];
  decision_type?: string;
  decision_comment?: string;
  tags?: string[];
}

export interface CaseUpdate extends Partial<CaseCreate> {
  case_status?: string;
  decision_type?: string;
}

export interface CaseListResponse {
  total: number;
  cases: Case[];
}

export interface CaseFull extends Case {
  searches?: Search[];
}

// Institutions call types
export interface InstitutionsCall {
  id: number;
  case_id: number;
  created_at: string;
  user_id: number | null;
  organization_name: string;
  organization_type: string | null;
  phone: string | null;
  result: string | null;
  notes: string | null;
}

export interface InstitutionsCallCreate {
  case_id: number;
  user_id?: number;
  organization_name: string;
  organization_type?: string;
  phone?: string;
  result?: string;
  notes?: string;
}

// Dashboard types
export interface DashboardStats {
  cases: {
    total: number;
    by_decision: Record<string, number>;
  };
  searches: {
    total: number;
    by_status: Record<string, number>;
  };
  field_searches: {
    total: number;
    by_status: Record<string, number>;
  };
  distributions: {
    total: number;
    by_status: Record<string, number>;
  };
  flyers?: {
    total: number;
    by_status: Record<string, number>;
  };
  institutions_calls?: {
    total: number;
    by_status: Record<string, number>;
  };
  total_users: number;
  total_institutions_calls: number;
}

// Event types
export interface Event {
  id: number;
  search_id: number;
  created_at: string;
  created_by_user_id: number | null;
  created_by: UserBrief | null;
  event_datetime: string;
  event_type: string;
  description: string;
  media_files: string[];
  updated_at: string | null;
  updated_by_user_id: number | null;
  updated_by: UserBrief | null;
}

export interface EventCreate {
  search_id: number;
  event_datetime: string;
  event_type: string;
  description: string;
  media_files?: string[];
}

export interface EventUpdate {
  event_datetime?: string;
  event_type?: string;
  description?: string;
  media_files?: string[];
}

export interface EventListResponse {
  total: number;
  events: Event[];
}

// Flyer Template types
export interface FlyerTemplate {
  id: number;
  created_at: string;
  template_type: string;
  file_name: string;
  file_path: string;
  description: string | null;
  gpt_prompt: string | null;
  is_active: number;
}

export interface FlyerTemplateListResponse {
  total: number;
  templates: FlyerTemplate[];
}

// Orientation types
export interface Orientation {
  id: number;
  search_id: number;
  created_at: string;
  updated_at: string | null;
  template_id: number | null;
  selected_photos: string[];
  canvas_data: Record<string, unknown>;
  text_content: string | null;
  is_approved: boolean;
  exported_files: string[];
}

export interface OrientationListResponse {
  total: number;
  orientations: Orientation[];
}

// API Error types
export interface APIError {
  error: {
    status_code: number;
    message: string;
    path: string;
    details?: unknown[];
  };
}
