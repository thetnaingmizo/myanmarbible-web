export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          author_id: string | null
          content_en: string | null
          content_my: string | null
          created_at: string
          excerpt_en: string | null
          excerpt_my: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title_en: string
          title_my: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content_en?: string | null
          content_my?: string | null
          created_at?: string
          excerpt_en?: string | null
          excerpt_my?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title_en: string
          title_my?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content_en?: string | null
          content_my?: string | null
          created_at?: string
          excerpt_en?: string | null
          excerpt_my?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title_en?: string
          title_my?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          user_id: string
          verse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
          verse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          abbreviation_en: string
          abbreviation_my: string | null
          book_number: number
          chapter_count: number
          created_at: string
          id: string
          name_en: string
          name_my: string | null
          testament: string
          translation_id: string
        }
        Insert: {
          abbreviation_en: string
          abbreviation_my?: string | null
          book_number: number
          chapter_count: number
          created_at?: string
          id?: string
          name_en: string
          name_my?: string | null
          testament: string
          translation_id: string
        }
        Update: {
          abbreviation_en?: string
          abbreviation_my?: string | null
          book_number?: number
          chapter_count?: number
          created_at?: string
          id?: string
          name_en?: string
          name_my?: string | null
          testament?: string
          translation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          bio_en: string | null
          bio_my: string | null
          created_at: string
          description_en: string | null
          description_my: string | null
          id: string
          image_url: string | null
          key_verse_ids: string[]
          name_en: string
          name_my: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          testament: string | null
          updated_at: string
        }
        Insert: {
          bio_en?: string | null
          bio_my?: string | null
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          id?: string
          image_url?: string | null
          key_verse_ids?: string[]
          name_en: string
          name_my?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          testament?: string | null
          updated_at?: string
        }
        Update: {
          bio_en?: string | null
          bio_my?: string | null
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          id?: string
          image_url?: string | null
          key_verse_ids?: string[]
          name_en?: string
          name_my?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          testament?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          token_count: number | null
          verse_references: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
          verse_references?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
          verse_references?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer_en: string
          answer_my: string | null
          created_at: string
          id: string
          question_en: string
          question_my: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          answer_en: string
          answer_my?: string | null
          created_at?: string
          id?: string
          question_en: string
          question_my?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          answer_en?: string
          answer_my?: string | null
          created_at?: string
          id?: string
          question_en?: string
          question_my?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content_en: string | null
          content_my: string | null
          created_at: string
          id: string
          image_url: string | null
          key_verse_ids: string[]
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          summary_en: string | null
          summary_my: string | null
          title_en: string
          title_my: string | null
          updated_at: string
        }
        Insert: {
          content_en?: string | null
          content_my?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          key_verse_ids?: string[]
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          summary_en?: string | null
          summary_my?: string | null
          title_en: string
          title_my?: string | null
          updated_at?: string
        }
        Update: {
          content_en?: string | null
          content_my?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          key_verse_ids?: string[]
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          summary_en?: string | null
          summary_my?: string | null
          title_en?: string
          title_my?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_url: string
          created_at: string
          description_en: string | null
          description_my: string | null
          duration_seconds: number | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title_en: string
          title_my: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title_en: string
          title_my?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title_en?: string
          title_my?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          denomination: string | null
          display_name: string | null
          id: string
          is_active: boolean
          preferred_locale: string
          preferred_translation_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          denomination?: string | null
          display_name?: string | null
          id: string
          is_active?: boolean
          preferred_locale?: string
          preferred_translation_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          denomination?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          preferred_locale?: string
          preferred_translation_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      question_votes: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_en: string | null
          answer_my: string | null
          answered_by: string | null
          body_en: string | null
          body_my: string | null
          created_at: string
          id: string
          slug: string
          status: Database["public"]["Enums"]["question_status"]
          title_en: string
          title_my: string | null
          updated_at: string
          upvote_count: number
          user_id: string | null
        }
        Insert: {
          answer_en?: string | null
          answer_my?: string | null
          answered_by?: string | null
          body_en?: string | null
          body_my?: string | null
          created_at?: string
          id?: string
          slug: string
          status?: Database["public"]["Enums"]["question_status"]
          title_en: string
          title_my?: string | null
          updated_at?: string
          upvote_count?: number
          user_id?: string | null
        }
        Update: {
          answer_en?: string | null
          answer_my?: string | null
          answered_by?: string | null
          body_en?: string | null
          body_my?: string | null
          created_at?: string
          id?: string
          slug?: string
          status?: Database["public"]["Enums"]["question_status"]
          title_en?: string
          title_my?: string | null
          updated_at?: string
          upvote_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          author_title: string | null
          content_en: string
          content_my: string | null
          created_at: string
          id: string
          is_featured: boolean
          rating: number | null
          status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          author_title?: string | null
          content_en: string
          content_my?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          rating?: number | null
          status?: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          author_title?: string | null
          content_en?: string
          content_my?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          rating?: number | null
          status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: []
      }
      translations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean
          is_licensed: boolean
          language: string
          license_info: string | null
          name_en: string
          name_my: string | null
          source_url: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_licensed?: boolean
          language: string
          license_info?: string | null
          name_en: string
          name_my?: string | null
          source_url?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_licensed?: boolean
          language?: string
          license_info?: string | null
          name_en?: string
          name_my?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      trivia_questions: {
        Row: {
          category: string | null
          correct_index: number
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_en: string | null
          explanation_my: string | null
          id: string
          is_ai_generated: boolean
          options_en: Json
          options_my: Json | null
          question_en: string
          question_my: string | null
          status: Database["public"]["Enums"]["question_status"]
          verse_reference: string | null
        }
        Insert: {
          category?: string | null
          correct_index: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_en?: string | null
          explanation_my?: string | null
          id?: string
          is_ai_generated?: boolean
          options_en: Json
          options_my?: Json | null
          question_en: string
          question_my?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          verse_reference?: string | null
        }
        Update: {
          category?: string | null
          correct_index?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_en?: string | null
          explanation_my?: string | null
          id?: string
          is_ai_generated?: boolean
          options_en?: Json
          options_my?: Json | null
          question_en?: string
          question_my?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          verse_reference?: string | null
        }
        Relationships: []
      }
      trivia_scores: {
        Row: {
          category: string | null
          completed_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      verse_categories: {
        Row: {
          created_at: string
          description_en: string | null
          description_my: string | null
          icon: string | null
          id: string
          name_en: string
          name_my: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          icon?: string | null
          id?: string
          name_en: string
          name_my?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          icon?: string | null
          id?: string
          name_en?: string
          name_my?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: []
      }
      verse_collections: {
        Row: {
          category_id: string | null
          created_at: string
          description_en: string | null
          description_my: string | null
          id: string
          image_url: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_my: string | null
          updated_at: string
          verse_ids: string[]
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          id?: string
          image_url?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_my?: string | null
          updated_at?: string
          verse_ids?: string[]
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_my?: string | null
          id?: string
          image_url?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en?: string
          title_my?: string | null
          updated_at?: string
          verse_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "verse_collections_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "verse_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      verse_embeddings: {
        Row: {
          created_at: string
          embedding: string
          id: string
          model: string
          verse_id: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          model?: string
          verse_id: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          model?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verse_embeddings_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: true
            referencedRelation: "verses"
            referencedColumns: ["id"]
          },
        ]
      }
      verses: {
        Row: {
          book_id: string
          chapter_number: number
          created_at: string
          id: string
          text: string
          text_search: unknown
          verse_number: number
        }
        Insert: {
          book_id: string
          chapter_number: number
          created_at?: string
          id?: string
          text: string
          text_search?: unknown
          verse_number: number
        }
        Update: {
          book_id?: string
          chapter_number?: number
          created_at?: string
          id?: string
          text?: string
          text_search?: unknown
          verse_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_verses: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          book_id: string
          chapter_number: number
          similarity: number
          text: string
          verse_id: string
          verse_number: number
        }[]
      }
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      difficulty_level: "easy" | "medium" | "hard"
      message_role: "user" | "assistant" | "system"
      question_status: "pending" | "approved" | "rejected"
      user_role: "user" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ["draft", "published", "archived"],
      difficulty_level: ["easy", "medium", "hard"],
      message_role: ["user", "assistant", "system"],
      question_status: ["pending", "approved", "rejected"],
      user_role: ["user", "admin"],
    },
  },
} as const

