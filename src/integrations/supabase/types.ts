export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      email_otps: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          otp: string;
          used: boolean;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          otp: string;
          used?: boolean;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          otp?: string;
          used?: boolean;
        };
        Relationships: [];
      };
      library_books: {
        Row: {
          author: string | null;
          borrowed_at: string;
          created_at: string;
          id: string;
          returned: boolean;
          returned_at: string | null;
          student_id: string;
          title: string;
        };
        Insert: {
          author?: string | null;
          borrowed_at?: string;
          created_at?: string;
          id?: string;
          returned?: boolean;
          returned_at?: string | null;
          student_id: string;
          title: string;
        };
        Update: {
          author?: string | null;
          borrowed_at?: string;
          created_at?: string;
          id?: string;
          returned?: boolean;
          returned_at?: string | null;
          student_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "library_books_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_admins: {
        Row: {
          created_at: string;
          id: string;
          password: string;
          portal: Database["public"]["Enums"]["portal_type"];
          username: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          password: string;
          portal: Database["public"]["Enums"]["portal_type"];
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          password?: string;
          portal?: Database["public"]["Enums"]["portal_type"];
          username?: string;
        };
        Relationships: [];
      };
      portal_notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          recipient_portal: Database["public"]["Enums"]["portal_type"];
          sender_portal: Database["public"]["Enums"]["portal_type"];
          student_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          recipient_portal: Database["public"]["Enums"]["portal_type"];
          sender_portal: Database["public"]["Enums"]["portal_type"];
          student_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          recipient_portal?: Database["public"]["Enums"]["portal_type"];
          sender_portal?: Database["public"]["Enums"]["portal_type"];
          student_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_notifications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_marks: {
        Row: {
          course_category: string;
          created_at: string;
          credits_earned: number;
          credits: number;
          grade: string;
          grade_points: number;
          id: string;
          marks_obtained: number;
          max_marks: number;
          student_id: string;
          subject: string;
          subject_code: string;
        };
        Insert: {
          course_category?: string;
          created_at?: string;
          credits_earned?: number;
          credits?: number;
          grade: string;
          grade_points?: number;
          id?: string;
          marks_obtained: number;
          max_marks?: number;
          student_id: string;
          subject: string;
          subject_code: string;
        };
        Update: {
          course_category?: string;
          created_at?: string;
          credits_earned?: number;
          credits?: number;
          grade?: string;
          grade_points?: number;
          id?: string;
          marks_obtained?: number;
          max_marks?: number;
          student_id?: string;
          subject?: string;
          subject_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_marks_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_grade_profiles: {
        Row: {
          created_at: string;
          exam_month_year: string;
          final_grade: string;
          id: string;
          issue_date: string;
          programme_code: string;
          programme_title: string;
          registration_no: string;
          semester_gpa: number;
          semester_label: string;
          student_id: string;
          total_credit_points: number;
          total_credits: number;
          total_credits_earned: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exam_month_year?: string;
          final_grade?: string;
          id?: string;
          issue_date?: string;
          programme_code?: string;
          programme_title?: string;
          registration_no?: string;
          semester_gpa?: number;
          semester_label?: string;
          student_id: string;
          total_credit_points?: number;
          total_credits?: number;
          total_credits_earned?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exam_month_year?: string;
          final_grade?: string;
          id?: string;
          issue_date?: string;
          programme_code?: string;
          programme_title?: string;
          registration_no?: string;
          semester_gpa?: number;
          semester_label?: string;
          student_id?: string;
          total_credit_points?: number;
          total_credits?: number;
          total_credits_earned?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_grade_profiles_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_card_details: {
        Row: {
          created_at: string;
          exam_month_year: string | null;
          final_grade: string | null;
          id: string;
          issue_date: string | null;
          programme_code: string;
          programme_title: string;
          registration_no: string | null;
          semester_gpa: number | null;
          semester_label: string | null;
          student_id: string;
          student_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exam_month_year?: string | null;
          final_grade?: string | null;
          id?: string;
          issue_date?: string | null;
          programme_code: string;
          programme_title: string;
          registration_no?: string | null;
          semester_gpa?: number | null;
          semester_label?: string | null;
          student_id: string;
          student_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exam_month_year?: string | null;
          final_grade?: string | null;
          id?: string;
          issue_date?: string | null;
          programme_code?: string;
          programme_title?: string;
          registration_no?: string | null;
          semester_gpa?: number | null;
          semester_label?: string | null;
          student_id?: string;
          student_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_card_details_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          admin_verified: boolean;
          created_at: string;
          faculty_verified: boolean;
          fully_verified: boolean;
          department: string;
          email: string;
          fees_cleared: boolean;
          fees_paid: number;
          fees_total: number;
          full_name: string;
          hostel_cleared: boolean;
          hostel_paid: number;
          hostel_total: number;
          id: string;
          library_remote_profile_id: string | null;
          in_fees: boolean;
          in_hostel: boolean;
          in_library: boolean;
          library_cleared: boolean;
          password: string;
          semester: number;
          student_id: string;
          year: number;
        };
        Insert: {
          admin_verified?: boolean;
          created_at?: string;
          faculty_verified?: boolean;
          fully_verified?: boolean;
          department: string;
          email: string;
          fees_cleared?: boolean;
          fees_paid?: number;
          fees_total?: number;
          full_name: string;
          hostel_cleared?: boolean;
          hostel_paid?: number;
          hostel_total?: number;
          id?: string;
          library_remote_profile_id?: string | null;
          in_fees?: boolean;
          in_hostel?: boolean;
          in_library?: boolean;
          library_cleared?: boolean;
          password: string;
          semester: number;
          student_id: string;
          year: number;
        };
        Update: {
          admin_verified?: boolean;
          created_at?: string;
          faculty_verified?: boolean;
          fully_verified?: boolean;
          department?: string;
          email?: string;
          fees_cleared?: boolean;
          fees_paid?: number;
          fees_total?: number;
          full_name?: string;
          hostel_cleared?: boolean;
          hostel_paid?: number;
          hostel_total?: number;
          id?: string;
          library_remote_profile_id?: string | null;
          in_fees?: boolean;
          in_hostel?: boolean;
          in_library?: boolean;
          library_cleared?: boolean;
          password?: string;
          semester?: number;
          student_id?: string;
          year?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      portal_type: "super_admin" | "faculty" | "admin" | "library" | "hostel" | "fees";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      portal_type: ["super_admin", "faculty", "admin", "library", "hostel", "fees"],
    },
  },
} as const;
