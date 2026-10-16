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
      bot_buys: {
        Row: {
          created_at: string
          error: string | null
          hbar_amount: number
          status: string
          token: string
          tx_hash: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          hbar_amount?: number
          status?: string
          token: string
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          hbar_amount?: number
          status?: string
          token?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          enabled: boolean
          id: number
          updated_at: string
          usd_amount: number
        }
        Insert: {
          enabled?: boolean
          id?: number
          updated_at?: string
          usd_amount?: number
        }
        Update: {
          enabled?: boolean
          id?: number
          updated_at?: string
          usd_amount?: number
        }
        Relationships: []
      }
      coin_comments: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          token: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          token: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          contact: string
          created_at: string
          id: string
          message: string
          status: string
          wallet: string | null
        }
        Insert: {
          contact: string
          created_at?: string
          id?: string
          message: string
          status?: string
          wallet?: string | null
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          wallet?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          contract: string
          last_timestamp: string
          synced_at: string
        }
        Insert: {
          contract: string
          last_timestamp?: string
          synced_at?: string
        }
        Update: {
          contract?: string
          last_timestamp?: string
          synced_at?: string
        }
        Relationships: []
      }
      token_images: {
        Row: {
          created_at: string
          data: string
          hash: string
          mime: string
        }
        Insert: {
          created_at?: string
          data: string
          hash: string
          mime: string
        }
        Update: {
          created_at?: string
          data?: string
          hash?: string
          mime?: string
        }
        Relationships: []
      }
      token_texts: {
        Row: {
          body: string
          created_at: string
          hash: string
        }
        Insert: {
          body: string
          created_at?: string
          hash: string
        }
        Update: {
          body?: string
          created_at?: string
          hash?: string
        }
        Relationships: []
      }
      tokens: {
        Row: {
          address: string
          contract: string
          created_at: string
          created_tx: string | null
          creator: string
          description: string | null
          graduated: boolean
          image_url: string | null
          last_trade_at: string | null
          name: string
          network: string
          symbol: string
          telegram: string | null
          tokens_sold: number
          trade_count: number
          twitter: string | null
          virtual_hbar: number
          virtual_tokens: number
          volume_hbar: number
          website: string | null
        }
        Insert: {
          address: string
          contract?: string
          created_at: string
          created_tx?: string | null
          creator: string
          description?: string | null
          graduated?: boolean
          image_url?: string | null
          last_trade_at?: string | null
          name: string
          network: string
          symbol: string
          telegram?: string | null
          tokens_sold?: number
          trade_count?: number
          twitter?: string | null
          virtual_hbar?: number
          virtual_tokens?: number
          volume_hbar?: number
          website?: string | null
        }
        Update: {
          address?: string
          contract?: string
          created_at?: string
          created_tx?: string | null
          creator?: string
          description?: string | null
          graduated?: boolean
          image_url?: string | null
          last_trade_at?: string | null
          name?: string
          network?: string
          symbol?: string
          telegram?: string | null
          tokens_sold?: number
          trade_count?: number
          twitter?: string | null
          virtual_hbar?: number
          virtual_tokens?: number
          volume_hbar?: number
          website?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          created_at: string
          fee: number
          hbar_amount: number
          id: string
          is_buy: boolean
          network: string
          price: number
          token: string
          token_amount: number
          trader: string
          tx_hash: string | null
        }
        Insert: {
          created_at: string
          fee: number
          hbar_amount: number
          id: string
          is_buy: boolean
          network: string
          price: number
          token: string
          token_amount: number
          trader: string
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          fee?: number
          hbar_amount?: number
          id?: string
          is_buy?: boolean
          network?: string
          price?: number
          token?: string
          token_amount?: number
          trader?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["address"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
