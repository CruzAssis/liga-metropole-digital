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
          created_at: string
          draw_executed_at: string | null
          id: string
          monthly_fee_brl: number | null
          name: string
          season: number
          status: string
          sumula_confirm_window_hours: number | null
          wo_fine_brl: number | null
          wo_tolerance_minutes: number | null
        }
        Insert: {
          created_at?: string
          draw_executed_at?: string | null
          id?: string
          monthly_fee_brl?: number | null
          name: string
          season: number
          status?: string
          sumula_confirm_window_hours?: number | null
          wo_fine_brl?: number | null
          wo_tolerance_minutes?: number | null
        }
        Update: {
          created_at?: string
          draw_executed_at?: string | null
          id?: string
          monthly_fee_brl?: number | null
          name?: string
          season?: number
          status?: string
          sumula_confirm_window_hours?: number | null
          wo_fine_brl?: number | null
          wo_tolerance_minutes?: number | null
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
      teams: {
        Row: {
          approved_at: string | null
          banner_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          manager_id: string
          name: string
          primary_color: string | null
          registration_type: string
          rejected_reason: string | null
          short_name: string
          slug: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          manager_id: string
          name: string
          primary_color?: string | null
          registration_type: string
          rejected_reason?: string | null
          short_name: string
          slug?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          manager_id?: string
          name?: string
          primary_color?: string | null
          registration_type?: string
          rejected_reason?: string | null
          short_name?: string
          slug?: string | null
          status?: string
        }
        Relationships: [
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_waitlist_for_type: { Args: { _type: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "team_manager" | "athlete"
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
      app_role: ["admin", "team_manager", "athlete"],
    },
  },
} as const
