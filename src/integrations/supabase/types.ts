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
      bot_payouts: {
        Row: {
          created_at: string
          error: string | null
          hbar_amount: number
          id: string
          kind: string
          recipient: string
          status: string
          token: string | null
          tx_hash: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          hbar_amount?: number
          id: string
          kind: string
          recipient: string
          status?: string
          token?: string | null
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          hbar_amount?: number
          id?: string
          kind?: string
          recipient?: string
          status?: string
          token?: string | null
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
      discord_coin_posts: {
        Row: {
          channel_id: string
          created_at: string
          id: number
          last_error: string | null
          memo: string | null
          message_id: string | null
          sent_at: string | null
          status: string
          token: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: never
          last_error?: string | null
          memo?: string | null
          message_id?: string | null
          sent_at?: string | null
          status?: string
          token: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: never
          last_error?: string | null
          memo?: string | null
          message_id?: string | null
          sent_at?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_coin_posts_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["address"]
          },
        ]
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
      telegram_app_posts: {
        Row: {
          created_at: string
          last_error: string | null
          message_id: number | null
          slot: string
          status: string
        }
        Insert: {
          created_at?: string
          last_error?: string | null
          message_id?: number | null
          slot: string
          status?: string
        }
        Update: {
          created_at?: string
          last_error?: string | null
          message_id?: number | null
          slot?: string
          status?: string
        }
        Relationships: []
      }
      telegram_channel_state: {
        Row: {
          chat_id: string
          id: number
          last_error: string | null
          lease_until: string | null
          message_id: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          chat_id?: string
          id?: number
          last_error?: string | null
          lease_until?: string | null
          message_id?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          id?: number
          last_error?: string | null
          lease_until?: string | null
          message_id?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_graduation_posts: {
        Row: {
          created_at: string
          last_error: string | null
          message_id: number | null
          network: string
          sent_at: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          last_error?: string | null
          message_id?: number | null
          network: string
          sent_at?: string | null
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          last_error?: string | null
          message_id?: number | null
          network?: string
          sent_at?: string | null
          status?: string
          token?: string
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
      wallet_profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          edit_key_hash: string
          name: string
          updated_at: string
          wallet: string
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          edit_key_hash: string
          name: string
          updated_at?: string
          wallet: string
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          edit_key_hash?: string
          name?: string
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      x_daily_media: {
        Row: {
          expires_at: string
          media_id: string
          slot: string
        }
        Insert: {
          expires_at: string
          media_id: string
          slot: string
        }
        Update: {
          expires_at?: string
          media_id?: string
          slot?: string
        }
        Relationships: []
      }
      x_daily_posts: {
        Row: {
          created_at: string
          error: string | null
          slot: string
          status: string
          text: string
          tweet_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          slot: string
          status?: string
          text: string
          tweet_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          slot?: string
          status?: string
          text?: string
          tweet_id?: string | null
        }
        Relationships: []
      }
      x_posting_state: {
        Row: {
          created_at: string
          enabled: boolean
          id: number
          lease_until: string | null
          pause_reason: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id: number
          lease_until?: string | null
          pause_reason?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: number
          lease_until?: string | null
          pause_reason?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_telegram_top_lease: { Args: never; Returns: boolean }
      acquire_x_posting_lease: { Args: never; Returns: boolean }
      admin_user_stats: { Args: never; Returns: Json }
      claim_discord_coin_post: {
        Args: never
        Returns: {
          channel: string
          coin_name: string
          coin_symbol: string
          post_id: number
          token_address: string
        }[]
      }
      claim_telegram_graduation: {
        Args: { p_network: string }
        Returns: {
          created_at: string
          last_error: string | null
          message_id: number | null
          network: string
          sent_at: string | null
          status: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "telegram_graduation_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creator_fee_totals: { Args: { creators: string[] }; Returns: number }
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
