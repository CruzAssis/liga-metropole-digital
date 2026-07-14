export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      athletes: {
        Row: {
          cpf_hash: string
          cpf_last4: string
          created_at: string
          full_name: string | null
          id: string
          instagram_handle: string | null
          nickname: string | null
          photo_url: string | null
          position: string | null
          team_id: string | null
          updated_at: string
          user_id: string | null
          verified: boolean
          verified_at: string | null
          whatsapp: string | null
        }
        Insert: {
          cpf_hash: string
          cpf_last4: string
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          nickname?: string | null
          photo_url?: string | null
          position?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean
          verified_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          cpf_hash?: string
          cpf_last4?: string
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          nickname?: string | null
          photo_url?: string | null
          position?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean
          verified_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          conference_name: string | null
          conference_number: number | null
          created_at: string
          draw_executed_at: string | null
          full_notified_at: string | null
          host_slots: number
          id: string
          max_teams: number
          monthly_fee_brl: number | null
          name: string
          qualified_count: number
          registration_status: string
          relegated_count: number
          season: number
          starts_at: string | null
          status: string
          subprefeitura: string | null
          sumula_confirm_window_hours: number | null
          use_sides: boolean
          visitor_slots: number
          wo_fine_brl: number | null
          wo_tolerance_minutes: number | null
          zona: string | null
        }
        Insert: {
          conference_name?: string | null
          conference_number?: number | null
          created_at?: string
          draw_executed_at?: string | null
          full_notified_at?: string | null
          host_slots?: number
          id?: string
          max_teams?: number
          monthly_fee_brl?: number | null
          name: string
          qualified_count?: number
          registration_status?: string
          relegated_count?: number
          season: number
          starts_at?: string | null
          status?: string
          subprefeitura?: string | null
          sumula_confirm_window_hours?: number | null
          use_sides?: boolean
          visitor_slots?: number
          wo_fine_brl?: number | null
          wo_tolerance_minutes?: number | null
          zona?: string | null
        }
        Update: {
          conference_name?: string | null
          conference_number?: number | null
          created_at?: string
          draw_executed_at?: string | null
          full_notified_at?: string | null
          host_slots?: number
          id?: string
          max_teams?: number
          monthly_fee_brl?: number | null
          name?: string
          qualified_count?: number
          registration_status?: string
          relegated_count?: number
          season?: number
          starts_at?: string | null
          status?: string
          subprefeitura?: string | null
          sumula_confirm_window_hours?: number | null
          use_sides?: boolean
          visitor_slots?: number
          wo_fine_brl?: number | null
          wo_tolerance_minutes?: number | null
          zona?: string | null
        }
        Relationships: []
      }
      group_teams: {
        Row: {
          created_at: string
          group_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          label: string
          team_role: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          label: string
          team_role: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          label?: string
          team_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      match_best_opponent_votes: {
        Row: {
          created_at: string
          id: string
          identified_at: string | null
          identified_name: string | null
          jersey_number: number
          match_id: string
          note: string | null
          opponent_athlete_id: string | null
          opponent_team_id: string
          rating: number
          updated_at: string
          voter_team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identified_at?: string | null
          identified_name?: string | null
          jersey_number: number
          match_id: string
          note?: string | null
          opponent_athlete_id?: string | null
          opponent_team_id: string
          rating: number
          updated_at?: string
          voter_team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identified_at?: string | null
          identified_name?: string | null
          jersey_number?: number
          match_id?: string
          note?: string | null
          opponent_athlete_id?: string | null
          opponent_team_id?: string
          rating?: number
          updated_at?: string
          voter_team_id?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          athlete_id: string | null
          created_at: string
          id: string
          kind: string
          match_id: string
          minute: number | null
          team_id: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          kind: string
          match_id: string
          minute?: number | null
          team_id: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          match_id?: string
          minute?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          bracket_position: number | null
          competition_id: string
          created_at: string
          group_label: string | null
          host_filled_at: string | null
          host_score: number | null
          host_team_id: string
          id: string
          parent_match_id: string | null
          round: number
          scheduled_at: string | null
          stage: string
          status: string
          venue: string | null
          visitor_confirmed_at: string | null
          visitor_score: number | null
          visitor_team_id: string
        }
        Insert: {
          bracket_position?: number | null
          competition_id: string
          created_at?: string
          group_label?: string | null
          host_filled_at?: string | null
          host_score?: number | null
          host_team_id: string
          id?: string
          parent_match_id?: string | null
          round: number
          scheduled_at?: string | null
          stage?: string
          status?: string
          venue?: string | null
          visitor_confirmed_at?: string | null
          visitor_score?: number | null
          visitor_team_id: string
        }
        Update: {
          bracket_position?: number | null
          competition_id?: string
          created_at?: string
          group_label?: string | null
          host_filled_at?: string | null
          host_score?: number | null
          host_team_id?: string
          id?: string
          parent_match_id?: string | null
          round?: number
          scheduled_at?: string | null
          stage?: string
          status?: string
          venue?: string | null
          visitor_confirmed_at?: string | null
          visitor_score?: number | null
          visitor_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_host_team_id_fkey"
            columns: ["host_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_parent_match_id_fkey"
            columns: ["parent_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_visitor_team_id_fkey"
            columns: ["visitor_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          kind: string
          match_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          match_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          match_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          cpf: string
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_supporters: {
        Row: {
          created_at: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_supporters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          approved_at: string | null
          banner_url: string | null
          competition_id: string | null
          created_at: string
          home_time: string | null
          home_venue: string | null
          id: string
          invite_code: string | null
          lado: Database["public"]["Enums"]["team_side"]
          logo_url: string | null
          manager_id: string
          name: string
          primary_color: string | null
          registration_type: string
          rejected_reason: string | null
          secondary_color: string | null
          serie: Database["public"]["Enums"]["team_serie"]
          short_name: string
          slug: string | null
          status: string
          tertiary_color: string | null
        }
        Insert: {
          approved_at?: string | null
          banner_url?: string | null
          competition_id?: string | null
          created_at?: string
          home_time?: string | null
          home_venue?: string | null
          id?: string
          invite_code?: string | null
          lado?: Database["public"]["Enums"]["team_side"]
          logo_url?: string | null
          manager_id: string
          name: string
          primary_color?: string | null
          registration_type: string
          rejected_reason?: string | null
          secondary_color?: string | null
          serie?: Database["public"]["Enums"]["team_serie"]
          short_name: string
          slug?: string | null
          status?: string
          tertiary_color?: string | null
        }
        Update: {
          approved_at?: string | null
          banner_url?: string | null
          competition_id?: string | null
          created_at?: string
          home_time?: string | null
          home_venue?: string | null
          id?: string
          invite_code?: string | null
          lado?: Database["public"]["Enums"]["team_side"]
          logo_url?: string | null
          manager_id?: string
          name?: string
          primary_color?: string | null
          registration_type?: string
          rejected_reason?: string | null
          secondary_color?: string | null
          serie?: Database["public"]["Enums"]["team_serie"]
          short_name?: string
          slug?: string | null
          status?: string
          tertiary_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      competition_fill_stats: {
        Args: { _competition_id: string }
        Returns: {
          host_a_approved: number
          host_b_approved: number
          host_slots: number
          is_full: boolean
          max_teams: number
          registration_status: string
          total_approved: number
          visitor_a_approved: number
          visitor_b_approved: number
          visitor_slots: number
        }[]
      }
      generate_team_invite_code: { Args: never; Returns: string }
      get_team_by_invite_code: {
        Args: { _code: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          short_name: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_director: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      promote_waitlist_for_type: { Args: { _type: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "team_manager"
        | "athlete"
        | "director"
        | "player"
        | "supporter"
      team_serie: "A" | "B"
      team_side: "A" | "B"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "team_manager",
        "athlete",
        "director",
        "player",
        "supporter",
      ],
      team_serie: ["A", "B"],
      team_side: ["A", "B"],
    },
  },
} as const
