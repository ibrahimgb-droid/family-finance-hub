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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          minor_digits: number
          name: string
        }
        Insert: {
          code: string
          minor_digits: number
          name: string
        }
        Update: {
          code?: string
          minor_digits?: number
          name?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      expense_allocations: {
        Row: {
          amount_minor: number
          count_snapshot: number | null
          expense_id: string
          family_member_id: string | null
          family_unit_id: string | null
          group_id: string
          id: string
          input_value: number | null
          weight_snapshot_milli: number | null
        }
        Insert: {
          amount_minor: number
          count_snapshot?: number | null
          expense_id: string
          family_member_id?: string | null
          family_unit_id?: string | null
          group_id: string
          id?: string
          input_value?: number | null
          weight_snapshot_milli?: number | null
        }
        Update: {
          amount_minor?: number
          count_snapshot?: number | null
          expense_id?: string
          family_member_id?: string | null
          family_unit_id?: string | null
          group_id?: string
          id?: string
          input_value?: number | null
          weight_snapshot_milli?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "group_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          display_name: string
          family_unit_id: string
          group_id: string
          id: string
          included: boolean
          user_id: string | null
          weight_milli: number
        }
        Insert: {
          created_at?: string
          display_name: string
          family_unit_id: string
          group_id: string
          id?: string
          included?: boolean
          user_id?: string | null
          weight_milli?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          family_unit_id?: string
          group_id?: string
          id?: string
          included?: boolean
          user_id?: string | null
          weight_milli?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_units: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_units_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_expenses: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          engine_version: string
          group_id: string
          id: string
          method: Database["public"]["Enums"]["split_method"]
          occurred_on: string
          paid_by_member_id: string
          status: Database["public"]["Enums"]["tx_status"]
          total_minor: number
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by: string
          currency: string
          description: string
          engine_version: string
          group_id: string
          id?: string
          method: Database["public"]["Enums"]["split_method"]
          occurred_on: string
          paid_by_member_id: string
          status?: Database["public"]["Enums"]["tx_status"]
          total_minor: number
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          engine_version?: string
          group_id?: string
          id?: string
          method?: Database["public"]["Enums"]["split_method"]
          occurred_on?: string
          paid_by_member_id?: string
          status?: Database["public"]["Enums"]["tx_status"]
          total_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_expenses_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "group_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          family_member_id: string | null
          group_id: string
          id: string
          invited_by: string
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          family_member_id?: string | null
          group_id: string
          id?: string
          invited_by: string
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          family_member_id?: string | null
          group_id?: string
          id?: string
          invited_by?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_currency: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      receipts: {
        Row: {
          byte_size: number
          created_at: string
          extraction: Json | null
          extraction_schema_version: string | null
          id: string
          mime_type: string
          ocr_text: string | null
          retain_until: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          extraction?: Json | null
          extraction_schema_version?: string | null
          id?: string
          mime_type: string
          ocr_text?: string | null
          retain_until?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          extraction?: Json | null
          extraction_schema_version?: string | null
          id?: string
          mime_type?: string
          ocr_text?: string | null
          retain_until?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          from_member_id: string
          group_id: string
          id: string
          note: string | null
          recorded_by: string
          settled_on: string
          to_member_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          from_member_id: string
          group_id: string
          id?: string
          note?: string | null
          recorded_by: string
          settled_on?: string
          to_member_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          from_member_id?: string
          group_id?: string
          id?: string
          note?: string | null
          recorded_by?: string
          settled_on?: string
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          category_id: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          document_ref: string | null
          id: string
          merchant: string | null
          note: string | null
          occurred_on: string
          receipt_id: string | null
          source: Database["public"]["Enums"]["tx_source"]
          status: Database["public"]["Enums"]["tx_status"]
          tax_minor: number
          total_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency: string
          document_ref?: string | null
          id?: string
          merchant?: string | null
          note?: string | null
          occurred_on: string
          receipt_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          status?: Database["public"]["Enums"]["tx_status"]
          tax_minor?: number
          total_minor: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          document_ref?: string | null
          id?: string
          merchant?: string | null
          note?: string | null
          occurred_on?: string
          receipt_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          status?: Database["public"]["Enums"]["tx_status"]
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      is_group_admin: { Args: { _group: string }; Returns: boolean }
      is_group_member: { Args: { _group: string }; Returns: boolean }
    }
    Enums: {
      group_role: "owner" | "admin" | "member"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      plan_tier: "free" | "premium"
      split_method:
        | "equal"
        | "fixed"
        | "percentage"
        | "shares"
        | "member_count"
        | "weighted_family"
        | "consumption_units"
      tx_source: "manual" | "receipt"
      tx_status: "draft" | "confirmed" | "void"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      group_role: ["owner", "admin", "member"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      plan_tier: ["free", "premium"],
      split_method: [
        "equal",
        "fixed",
        "percentage",
        "shares",
        "member_count",
        "weighted_family",
        "consumption_units",
      ],
      tx_source: ["manual", "receipt"],
      tx_status: ["draft", "confirmed", "void"],
    },
  },
} as const
