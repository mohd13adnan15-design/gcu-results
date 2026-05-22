export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      departments: {
        Row: {
          name: string;
          created_at: string;
        };
        Insert: {
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
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
      portal_profiles: {
        Row: {
          created_at: string;
          email: string;
          portal: Database["public"]["Enums"]["portal_type"];
          student_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          portal: Database["public"]["Enums"]["portal_type"];
          student_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          portal?: Database["public"]["Enums"]["portal_type"];
          student_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_profiles_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          is_resolved: boolean;
          message: string;
          recipient_portal: Database["public"]["Enums"]["portal_type"];
          resolved_at: string | null;
          sender_portal: Database["public"]["Enums"]["portal_type"];
          student_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          is_resolved?: boolean;
          message: string;
          recipient_portal: Database["public"]["Enums"]["portal_type"];
          resolved_at?: string | null;
          sender_portal: Database["public"]["Enums"]["portal_type"];
          student_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          is_resolved?: boolean;
          message?: string;
          recipient_portal?: Database["public"]["Enums"]["portal_type"];
          resolved_at?: string | null;
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
          course_priority: number;
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
          cia_max_marks_theory: number | null;
          cia_max_marks_practical: number | null;
          cia_marks_obtained_theory: number | null;
          cia_marks_obtained_practical: number | null;
          ese_max_marks_theory: number | null;
          ese_max_marks_practical: number | null;
          ese_marks_obtained_theory: number | null;
          ese_marks_obtained_practical: number | null;
          total_marks_theory: number | null;
          total_marks_practical: number | null;
          semester: number | null;
          semester_label: string | null;
        };
        Insert: {
          course_category?: string;
          course_priority?: number;
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
          cia_max_marks_theory?: number | null;
          cia_max_marks_practical?: number | null;
          cia_marks_obtained_theory?: number | null;
          cia_marks_obtained_practical?: number | null;
          ese_max_marks_theory?: number | null;
          ese_max_marks_practical?: number | null;
          ese_marks_obtained_theory?: number | null;
          ese_marks_obtained_practical?: number | null;
          total_marks_theory?: number | null;
          total_marks_practical?: number | null;
          semester?: number | null;
          semester_label?: string | null;
        };
        Update: {
          course_category?: string;
          course_priority?: number;
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
          cia_max_marks_theory?: number | null;
          cia_max_marks_practical?: number | null;
          cia_marks_obtained_theory?: number | null;
          cia_marks_obtained_practical?: number | null;
          ese_max_marks_theory?: number | null;
          ese_max_marks_practical?: number | null;
          ese_marks_obtained_theory?: number | null;
          ese_marks_obtained_practical?: number | null;
          total_marks_theory?: number | null;
          total_marks_practical?: number | null;
          semester?: number | null;
          semester_label?: string | null;
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
      student_marksheets: {
        Row: {
          courses: Json;
          created_at: string;
          exam_month_year: string;
          final_grade: string;
          grade_card_no: string;
          id: string;
          issue_date: string;
          photo_bucket: string | null;
          photo_path: string | null;
          programme_code: string;
          programme_title: string;
          qr_data: string;
          registration_no: string;
          school_name: string;
          semester_label: string;
          sgpa: number;
          student_id: string;
          student_name: string;
          student_roll_no: string;
          total_credit_points: number;
          total_credits: number;
          total_credits_earned: number;
          university: string;
          updated_at: string;
        };
        Insert: {
          courses: Json;
          created_at?: string;
          exam_month_year: string;
          final_grade?: string;
          grade_card_no: string;
          id?: string;
          issue_date: string;
          photo_bucket?: string | null;
          photo_path?: string | null;
          programme_code: string;
          programme_title: string;
          qr_data: string;
          registration_no: string;
          school_name: string;
          semester_label: string;
          sgpa?: number;
          student_id: string;
          student_name: string;
          student_roll_no: string;
          total_credit_points?: number;
          total_credits?: number;
          total_credits_earned?: number;
          university?: string;
          updated_at?: string;
        };
        Update: {
          courses?: Json;
          created_at?: string;
          exam_month_year?: string;
          final_grade?: string;
          grade_card_no?: string;
          id?: string;
          issue_date?: string;
          photo_bucket?: string | null;
          photo_path?: string | null;
          programme_code?: string;
          programme_title?: string;
          qr_data?: string;
          registration_no?: string;
          school_name?: string;
          semester_label?: string;
          sgpa?: number;
          student_id?: string;
          student_name?: string;
          student_roll_no?: string;
          total_credit_points?: number;
          total_credits?: number;
          total_credits_earned?: number;
          university?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_marksheets_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      main_grade_card: {
        Row: {
          id: string;
          student_id: string;
          programme_title: string | null;
          programme_code: string | null;
          student_name: string | null;
          registration_no: string | null;
          semester_label: string | null;
          exam_month_year: string | null;
          row_number: number;
          course_code: string | null;
          course_title: string | null;
          course_credits: number | null;
          credits_earned: number | null;
          grade: string | null;
          grade_points: number | null;
          course_category: string | null;
          total_credit_points: number | null;
          total_credits: number | null;
          semester_gpa: number | null;
          final_grade: string | null;
          issue_date: string | null;
          qr_data: string | null;
          photo_url: string | null;
          subject: string | null;
          subject_code: string | null;
          credits: number | null;
          practical_1: string | null;
          ability_enhancement_compulsory_course: string | null;
          skill_enhancement_course: string | null;
          practical_2: string | null;
          objective_enhancement_course: string | null;
          marks_obtained: number | null;
          max_marks: number | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          programme_title?: string | null;
          programme_code?: string | null;
          student_name?: string | null;
          registration_no?: string | null;
          semester_label?: string | null;
          exam_month_year?: string | null;
          row_number: number;
          course_code?: string | null;
          course_title?: string | null;
          course_credits?: number | null;
          credits_earned?: number | null;
          grade?: string | null;
          grade_points?: number | null;
          course_category?: string | null;
          total_credit_points?: number | null;
          total_credits?: number | null;
          semester_gpa?: number | null;
          final_grade?: string | null;
          issue_date?: string | null;
          qr_data?: string | null;
          photo_url?: string | null;
          subject?: string | null;
          subject_code?: string | null;
          credits?: number | null;
          practical_1?: string | null;
          ability_enhancement_compulsory_course?: string | null;
          skill_enhancement_course?: string | null;
          practical_2?: string | null;
          objective_enhancement_course?: string | null;
          marks_obtained?: number | null;
          max_marks?: number | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          programme_title?: string | null;
          programme_code?: string | null;
          student_name?: string | null;
          registration_no?: string | null;
          semester_label?: string | null;
          exam_month_year?: string | null;
          row_number?: number;
          course_code?: string | null;
          course_title?: string | null;
          course_credits?: number | null;
          credits_earned?: number | null;
          grade?: string | null;
          grade_points?: number | null;
          course_category?: string | null;
          total_credit_points?: number | null;
          total_credits?: number | null;
          semester_gpa?: number | null;
          final_grade?: string | null;
          issue_date?: string | null;
          qr_data?: string | null;
          photo_url?: string | null;
          subject?: string | null;
          subject_code?: string | null;
          credits?: number | null;
          practical_1?: string | null;
          ability_enhancement_compulsory_course?: string | null;
          skill_enhancement_course?: string | null;
          practical_2?: string | null;
          objective_enhancement_course?: string | null;
          marks_obtained?: number | null;
          max_marks?: number | null;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "main_grade_card_student_id_fkey";
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
          auth_user_id: string | null;
          created_at: string;
          faculty_verified: boolean;
          fully_verified: boolean;
          marksheet_verification_requested_at: string | null;
          marks_uploaded_at: string | null;
          grade_card_issue_date: string | null;
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
          semester: number;
          student_id: string;
          year: number;
          image_path: string | null;
        };
        Insert: {
          admin_verified?: boolean;
          auth_user_id?: string | null;
          created_at?: string;
          faculty_verified?: boolean;
          fully_verified?: boolean;
          marksheet_verification_requested_at?: string | null;
          marks_uploaded_at?: string | null;
          grade_card_issue_date?: string | null;
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
          semester: number;
          student_id: string;
          year: number;
          image_path?: string | null;
        };
        Update: {
          admin_verified?: boolean;
          auth_user_id?: string | null;
          created_at?: string;
          faculty_verified?: boolean;
          fully_verified?: boolean;
          marksheet_verification_requested_at?: string | null;
          marks_uploaded_at?: string | null;
          grade_card_issue_date?: string | null;
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
          semester?: number;
          student_id?: string;
          year?: number;
          image_path?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      link_student_auth_user: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      portal_profiles_is_head_of_coe: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      portal_type:
      | "super_admin"
      | "faculty"
      | "admin"
      | "admin_1"
      | "admin_2"
      | "head_of_coe"
      | "library"
      | "hostel"
      | "fees";
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
      portal_type: [
        "super_admin",
        "faculty",
        "admin",
        "admin_1",
        "admin_2",
        "head_of_coe",
        "library",
        "hostel",
        "fees",
      ],
    },
  },
} as const;
