export interface PenjaminOverrideRow {
  id: string;                           // 'ov-{original_name}' or 'cu-{new_name}'
  original_name: string | null;          // builtin name; NULL for custom entries
  new_name: string | null;               // display name
  badge: string | null;                  // badge label
  is_custom: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
