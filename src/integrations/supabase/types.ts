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
      access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      account_stock_items: {
        Row: {
          account_id: string
          content: string
          created_at: string
          delivered_at: string | null
          delivered_to: string | null
          delivered_to_email: string | null
          id: string
          is_used: boolean
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          delivered_at?: string | null
          delivered_to?: string | null
          delivered_to_email?: string | null
          id?: string
          is_used?: boolean
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          delivered_at?: string | null
          delivered_to?: string | null
          delivered_to_email?: string | null
          id?: string
          is_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "account_stock_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          allowed_plans: string[]
          category: string
          created_at: string
          delivery_type: string
          email: string | null
          extra_links: Json | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          is_hidden: boolean | null
          kind: string
          main_link: string | null
          name: string
          observations: string | null
          password: string | null
          sort_order: number | null
          status: string
          unlimited_stock: boolean
          updated_at: string
        }
        Insert: {
          allowed_plans?: string[]
          category?: string
          created_at?: string
          delivery_type?: string
          email?: string | null
          extra_links?: Json | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          kind?: string
          main_link?: string | null
          name: string
          observations?: string | null
          password?: string | null
          sort_order?: number | null
          status?: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Update: {
          allowed_plans?: string[]
          category?: string
          created_at?: string
          delivery_type?: string
          email?: string | null
          extra_links?: Json | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          kind?: string
          main_link?: string | null
          name?: string
          observations?: string | null
          password?: string | null
          sort_order?: number | null
          status?: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          affiliate_url: string
          commission: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          affiliate_url: string
          commission?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          affiliate_url?: string
          commission?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      agenda_events: {
        Row: {
          created_at: string
          days_of_week: number[]
          description: string | null
          id: string
          is_active: boolean
          notify_enabled: boolean
          repeat_count: number
          time_of_day: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          id?: string
          is_active?: boolean
          notify_enabled?: boolean
          repeat_count?: number
          time_of_day: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          id?: string
          is_active?: boolean
          notify_enabled?: boolean
          repeat_count?: number
          time_of_day?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agenda_sent_log: {
        Row: {
          event_id: string
          id: string
          scheduled_for: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          scheduled_for: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          scheduled_for?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_scrape_cache: {
        Row: {
          domain: string
          email: string | null
          scraped_at: string
        }
        Insert: {
          domain: string
          email?: string | null
          scraped_at?: string
        }
        Update: {
          domain?: string
          email?: string | null
          scraped_at?: string
        }
        Relationships: []
      }
      lead_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_tag_assignments: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          category: string | null
          column_id: string | null
          created_at: string
          description: string | null
          email: string | null
          external_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: number
          rating: number | null
          reviews_count: number | null
          source: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          column_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: number
          rating?: number | null
          reviews_count?: number | null
          source?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          column_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: number
          rating?: number | null
          reviews_count?: number | null
          source?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "lead_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          must_change_password: boolean
          plan: string
          purchase_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          plan?: string
          purchase_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          plan?: string
          purchase_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          affiliate_html: string | null
          background_color: string | null
          banner_url: string | null
          custom_css: string | null
          favicon_url: string | null
          google_places_api_key: string | null
          id: string
          landing_html: string | null
          leads_allowed_plans: string[]
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          site_name: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          affiliate_html?: string | null
          background_color?: string | null
          banner_url?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          google_places_api_key?: string | null
          id?: string
          landing_html?: string | null
          leads_allowed_plans?: string[]
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_html?: string | null
          background_color?: string | null
          banner_url?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          google_places_api_key?: string | null
          id?: string
          landing_html?: string | null
          leads_allowed_plans?: string[]
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          account_id: string | null
          account_name: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          status: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          source: string
          status: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          source?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          source?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      site_settings_public: {
        Row: {
          affiliate_html: string | null
          background_color: string | null
          banner_url: string | null
          custom_css: string | null
          favicon_url: string | null
          has_google_places_key: boolean | null
          id: string | null
          landing_html: string | null
          leads_allowed_plans: string[] | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          site_name: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string | null
        }
        Insert: {
          affiliate_html?: string | null
          background_color?: string | null
          banner_url?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          has_google_places_key?: never
          id?: string | null
          landing_html?: string | null
          leads_allowed_plans?: string[] | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
        }
        Update: {
          affiliate_html?: string | null
          background_color?: string | null
          banner_url?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          has_google_places_key?: never
          id?: string | null
          landing_html?: string | null
          leads_allowed_plans?: string[] | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_clear_all_stock: { Args: never; Returns: undefined }
      admin_delete_all_accounts: { Args: never; Returns: undefined }
      broadcast_notification: {
        Args: { _message: string; _plan?: string; _title: string }
        Returns: number
      }
      claim_stock_item: {
        Args: { _account_id: string }
        Returns: {
          already_had: boolean
          content: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_support_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
