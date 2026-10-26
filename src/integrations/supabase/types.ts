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
      admin_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
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
      community_blocks: {
        Row: {
          author: string
          created_at: string
        }
        Insert: {
          author: string
          created_at?: string
        }
        Update: {
          author?: string
          created_at?: string
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          removed_at: string | null
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          removed_at?: string | null
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          removed_at?: string | null
        }
        Relationships: []
      }
      community_sessions: {
        Row: {
          author: string
          expires_at: string
          token_hash: string
        }
        Insert: {
          author: string
          expires_at: string
          token_hash: string
        }
        Update: {
          author?: string
          expires_at?: string
          token_hash?: string
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
      holdout_payouts: {
        Row: {
          account: string
          coins: Json
          created_at: string
          error: string | null
          id: string
          period: string
          status: string
          tinybars: number
          tx_hash: string | null
        }
        Insert: {
          account: string
          coins?: Json
          created_at?: string
          error?: string | null
          id: string
          period: string
          status?: string
          tinybars: number
          tx_hash?: string | null
        }
        Update: {
          account?: string
          coins?: Json
          created_at?: string
          error?: string | null
          id?: string
          period?: string
          status?: string
          tinybars?: number
          tx_hash?: string | null
        }
        Relationships: []
      }
      holdout_periods: {
        Row: {
          coins: Json
          created_at: string
          period: string
          planned_tinybars: number
          pot_tinybars: number
          residual_tinybars: number
          status: string
        }
        Insert: {
          coins?: Json
          created_at?: string
          period: string
          planned_tinybars?: number
          pot_tinybars?: number
          residual_tinybars?: number
          status?: string
        }
        Update: {
          coins?: Json
          created_at?: string
          period?: string
          planned_tinybars?: number
          pot_tinybars?: number
          residual_tinybars?: number
          status?: string
        }
        Relationships: []
      }
      holdout_snapshots: {
        Row: {
          created_at: string
          lots: Json
          period: string
          skipped: boolean
          slot: string
          supply: number
          token: string
          weights: Json
        }
        Insert: {
          created_at?: string
          lots?: Json
          period: string
          skipped?: boolean
          slot: string
          supply?: number
          token: string
          weights?: Json
        }
        Update: {
          created_at?: string
          lots?: Json
          period?: string
          skipped?: boolean
          slot?: string
          supply?: number
          token?: string
          weights?: Json
        }
        Relationships: []
      }
      official_coins: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          name: string
          status: string
          symbol: string
          tx_hash: string | null
        }
        Insert: {
          created_at?: string
          id: string
          last_error?: string | null
          name: string
          status?: string
          symbol: string
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          name?: string
          status?: string
          symbol?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      promo_posts: {
        Row: {
          channel: string
          created_at: string
          external_id: string | null
          last_error: string | null
          slot: string
          status: string
          text: string | null
          token: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          external_id?: string | null
          last_error?: string | null
          slot: string
          status?: string
          text?: string | null
          token?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          external_id?: string | null
          last_error?: string | null
          slot?: string
          status?: string
          text?: string | null
          token?: string | null
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          account_id: string | null
          avatar: string | null
          created_at: string
          earned_before: number
          is_admin: boolean
          joined_at: string
          left_at: string | null
          name: string
          rate_since: string | null
          share_pct: number
          wallet: string
        }
        Insert: {
          account_id?: string | null
          avatar?: string | null
          created_at?: string
          earned_before?: number
          is_admin?: boolean
          joined_at?: string
          left_at?: string | null
          name: string
          rate_since?: string | null
          share_pct?: number
          wallet: string
        }
        Update: {
          account_id?: string | null
          avatar?: string | null
          created_at?: string
          earned_before?: number
          is_admin?: boolean
          joined_at?: string
          left_at?: string | null
          name?: string
          rate_since?: string | null
          share_pct?: number
          wallet?: string
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
          hidden: boolean
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
          hidden?: boolean
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
          hidden?: boolean
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
      wallet_follows: {
        Row: {
          created_at: string
          followee: string
          follower: string
        }
        Insert: {
          created_at?: string
          followee: string
          follower: string
        }
        Update: {
          created_at?: string
          followee?: string
          follower?: string
        }
        Relationships: []
      }
      wallet_profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          edit_key_hash: string | null
          name: string
          updated_at: string
          wallet: string
          x_handle: string | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          edit_key_hash?: string | null
          name: string
          updated_at?: string
          wallet: string
          x_handle?: string | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          edit_key_hash?: string | null
          name?: string
          updated_at?: string
          wallet?: string
          x_handle?: string | null
        }
        Relationships: []
      }
      wallet_transfers: {
        Row: {
          created_at: string
          error: string | null
          from_wallet: string
          id: string
          kind: string
          recipient: string
          status: string
          tinybars: number
          tx_hash: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          from_wallet: string
          id: string
          kind: string
          recipient: string
          status?: string
          tinybars?: number
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          from_wallet?: string
          id?: string
          kind?: string
          recipient?: string
          status?: string
          tinybars?: number
          tx_hash?: string | null
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
      fee_total_between: {
        Args: { p_from: string; p_network: string; p_to: string }
        Returns: number
      }
      moderate_community_author: {
        Args: { p_author: string; p_block: boolean }
        Returns: undefined
      }
      send_community_message: {
        Args: { p_body: string; p_token_hash: string }
        Returns: string
      }
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
