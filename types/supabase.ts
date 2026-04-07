export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      graphs: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_favorite: boolean;
          memo: string;
          saved_at: string;
          seed: Json;
          title: string;
          topic: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_favorite?: boolean;
          memo?: string;
          saved_at?: string;
          seed: Json;
          title: string;
          topic: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_favorite?: boolean;
          memo?: string;
          saved_at?: string;
          seed?: Json;
          title?: string;
          topic?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "graphs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          ai_quota: number;
          ai_used: number;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          plan: string;
          pro_expires_at: string | null;
          quota_period_end: string | null;
          quota_period_start: string | null;
          stripe_customer_id: string | null;
          stripe_status: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_quota?: number;
          ai_used?: number;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          plan?: string;
          pro_expires_at?: string | null;
          quota_period_end?: string | null;
          quota_period_start?: string | null;
          stripe_customer_id?: string | null;
          stripe_status?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_quota?: number;
          ai_used?: number;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          plan?: string;
          pro_expires_at?: string | null;
          quota_period_end?: string | null;
          quota_period_start?: string | null;
          stripe_customer_id?: string | null;
          stripe_status?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      supporter_requests: {
        Row: {
          created_at: string;
          depositor_name: string;
          email: string;
          id: string;
          memo: string | null;
          proof_url: string | null;
          status: string;
          support_amount: number;
          supporter_name: string;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          depositor_name: string;
          email: string;
          id?: string;
          memo?: string | null;
          proof_url?: string | null;
          status?: string;
          support_amount: number;
          supporter_name: string;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          depositor_name?: string;
          email?: string;
          id?: string;
          memo?: string | null;
          proof_url?: string | null;
          status?: string;
          support_amount?: number;
          supporter_name?: string;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supporter_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
