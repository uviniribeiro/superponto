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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      adjustment_requests: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          original_time: string | null
          profile_id: string
          reason: string
          request_type: string
          requested_time: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_record_id: string | null
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          original_time?: string | null
          profile_id: string
          reason: string
          request_type: string
          requested_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_record_id?: string | null
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          original_time?: string | null
          profile_id?: string
          reason?: string
          request_type?: string
          requested_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_record_id?: string | null
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_requests_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "system_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_policies: {
        Row: {
          company_id: string | null
          created_at: string
          hierarchy_levels: number | null
          id: string
          is_active: boolean | null
          level_type: string | null
          name: string
          specific_user_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          hierarchy_levels?: number | null
          id?: string
          is_active?: boolean | null
          level_type?: string | null
          name: string
          specific_user_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          hierarchy_levels?: number | null
          id?: string
          is_active?: boolean | null
          level_type?: string | null
          name?: string
          specific_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_policies_specific_user_id_fkey"
            columns: ["specific_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_policies_specific_user_id_fkey"
            columns: ["specific_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          menu_section: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          transaction_hash: string | null
          user_agent: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          menu_section?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          transaction_hash?: string | null
          user_agent?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          menu_section?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          transaction_hash?: string | null
          user_agent?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_allowance_employees: {
        Row: {
          batch_allowance_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          batch_allowance_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          batch_allowance_id?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_allowance_employees_batch_allowance_id_fkey"
            columns: ["batch_allowance_id"]
            isOneToOne: false
            referencedRelation: "batch_allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allowance_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allowance_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_allowances: {
        Row: {
          allow_absences: boolean | null
          allow_delays: boolean | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string
          end_date: string
          id: string
          is_active: boolean | null
          justification_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          allow_absences?: boolean | null
          allow_delays?: boolean | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          end_date: string
          id?: string
          is_active?: boolean | null
          justification_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          allow_absences?: boolean | null
          allow_delays?: boolean | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          justification_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_allowances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allowances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allowances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allowances_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "justifications"
            referencedColumns: ["id"]
          },
        ]
      }
      class_hour_configurations: {
        Row: {
          activity_hours_percent: number | null
          company_id: string | null
          contract_type: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          educator_type: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          max_consecutive_classes: number | null
          min_interval_between_classes: number | null
          monthly_class_hours: number | null
          name: string
          night_class_end: string | null
          night_class_rate_multiplier: number | null
          night_class_start: string | null
          preparation_minutes_per_class: number | null
          updated_at: string
          weekly_class_hours: number | null
        }
        Insert: {
          activity_hours_percent?: number | null
          company_id?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          educator_type?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          max_consecutive_classes?: number | null
          min_interval_between_classes?: number | null
          monthly_class_hours?: number | null
          name: string
          night_class_end?: string | null
          night_class_rate_multiplier?: number | null
          night_class_start?: string | null
          preparation_minutes_per_class?: number | null
          updated_at?: string
          weekly_class_hours?: number | null
        }
        Update: {
          activity_hours_percent?: number | null
          company_id?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          educator_type?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          max_consecutive_classes?: number | null
          min_interval_between_classes?: number | null
          monthly_class_hours?: number | null
          name?: string
          night_class_end?: string | null
          night_class_rate_multiplier?: number | null
          night_class_start?: string | null
          preparation_minutes_per_class?: number | null
          updated_at?: string
          weekly_class_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_hour_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      class_records: {
        Row: {
          class_date: string
          class_hour_configuration_id: string
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          number_of_classes: number
          profile_id: string
          total_minutes: number
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          class_date: string
          class_hour_configuration_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number_of_classes?: number
          profile_id: string
          total_minutes: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          class_date?: string
          class_hour_configuration_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number_of_classes?: number
          profile_id?: string
          total_minutes?: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_records_class_hour_configuration_id_fkey"
            columns: ["class_hour_configuration_id"]
            isOneToOne: false
            referencedRelation: "class_hour_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          company_code: string
          created_at: string
          doctor_module_enabled: boolean | null
          id: string
          is_active: boolean
          license_status: string | null
          logo_url: string | null
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          parent_organization_id: string | null
          payroll_module_enabled: boolean | null
          phone: string | null
          sector: Database["public"]["Enums"]["city_hall_sector"] | null
          state: string | null
          teacher_module_enabled: boolean | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_code: string
          created_at?: string
          doctor_module_enabled?: boolean | null
          id?: string
          is_active?: boolean
          license_status?: string | null
          logo_url?: string | null
          name: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          payroll_module_enabled?: boolean | null
          phone?: string | null
          sector?: Database["public"]["Enums"]["city_hall_sector"] | null
          state?: string | null
          teacher_module_enabled?: boolean | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_code?: string
          created_at?: string
          doctor_module_enabled?: boolean | null
          id?: string
          is_active?: boolean
          license_status?: string | null
          logo_url?: string | null
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          payroll_module_enabled?: boolean | null
          phone?: string | null
          sector?: Database["public"]["Enums"]["city_hall_sector"] | null
          state?: string | null
          teacher_module_enabled?: boolean | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cei: string | null
          city: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string
          created_at: string
          daily_overtime_limit_hours: number | null
          id: string
          logo_url: string | null
          monthly_overtime_limit_hours: number | null
          overtime_alert_email: string | null
          phone: string | null
          rep_manufacturer: string | null
          rep_model: string | null
          rep_number: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          weekly_overtime_limit_hours: number | null
          whatsapp_alert_phone: string | null
        }
        Insert: {
          address?: string | null
          cei?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name: string
          created_at?: string
          daily_overtime_limit_hours?: number | null
          id?: string
          logo_url?: string | null
          monthly_overtime_limit_hours?: number | null
          overtime_alert_email?: string | null
          phone?: string | null
          rep_manufacturer?: string | null
          rep_model?: string | null
          rep_number?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          weekly_overtime_limit_hours?: number | null
          whatsapp_alert_phone?: string | null
        }
        Update: {
          address?: string | null
          cei?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string
          created_at?: string
          daily_overtime_limit_hours?: number | null
          id?: string
          logo_url?: string | null
          monthly_overtime_limit_hours?: number | null
          overtime_alert_email?: string | null
          phone?: string | null
          rep_manufacturer?: string | null
          rep_model?: string | null
          rep_number?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          weekly_overtime_limit_hours?: number | null
          whatsapp_alert_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_periods: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          end_date: string
          id: string
          is_active: boolean | null
          reference_month_year: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          end_date: string
          id?: string
          is_active?: boolean | null
          reference_month_year?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          reference_month_year?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competency_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_assignments: {
        Row: {
          company_id: string | null
          contract_monthly_hours: number | null
          contract_type: string | null
          contract_weekly_hours: number | null
          created_at: string
          crm: string | null
          crm_state: string | null
          end_date: string | null
          health_unit: string | null
          id: string
          is_active: boolean | null
          profile_id: string
          shift_configuration_id: string
          specialty: string | null
          start_date: string
          updated_at: string
          work_schedule_id: string | null
        }
        Insert: {
          company_id?: string | null
          contract_monthly_hours?: number | null
          contract_type?: string | null
          contract_weekly_hours?: number | null
          created_at?: string
          crm?: string | null
          crm_state?: string | null
          end_date?: string | null
          health_unit?: string | null
          id?: string
          is_active?: boolean | null
          profile_id: string
          shift_configuration_id: string
          specialty?: string | null
          start_date?: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Update: {
          company_id?: string | null
          contract_monthly_hours?: number | null
          contract_type?: string | null
          contract_weekly_hours?: number | null
          created_at?: string
          crm?: string | null
          crm_state?: string | null
          end_date?: string | null
          health_unit?: string | null
          id?: string
          is_active?: boolean | null
          profile_id?: string
          shift_configuration_id?: string
          specialty?: string | null
          start_date?: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_assignments_shift_configuration_id_fkey"
            columns: ["shift_configuration_id"]
            isOneToOne: false
            referencedRelation: "medical_shift_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_assignments_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedule_slots: {
        Row: {
          assignment_id: string
          company_id: string | null
          created_at: string
          day_of_week: number
          end_time: string
          health_unit: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          profile_id: string
          room: string | null
          sector: string | null
          shift_number: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          assignment_id: string
          company_id?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          health_unit?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          profile_id: string
          room?: string | null
          sector?: string | null
          shift_number?: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          company_id?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          health_unit?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          profile_id?: string
          room?: string | null
          sector?: string | null
          shift_number?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedule_slots_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "doctor_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_schedule_slots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_schedule_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_schedule_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_absences: {
        Row: {
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          end_date: string
          id: string
          medical_certificate_url: string | null
          notes: string | null
          profile_id: string
          reason: string | null
          start_date: string
          status: string
          total_days: number
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          absence_type: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          medical_certificate_url?: string | null
          notes?: string | null
          profile_id: string
          reason?: string | null
          start_date: string
          status?: string
          total_days: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          medical_certificate_url?: string | null
          notes?: string | null
          profile_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_class_hour_assignments: {
        Row: {
          class_hour_configuration_id: string
          company_id: string | null
          contract_monthly_hours: number | null
          contract_type: string | null
          contract_weekly_hours: number | null
          created_at: string
          educator_type: string | null
          end_date: string | null
          id: string
          is_active: boolean
          profile_id: string
          start_date: string
          subject: string | null
          teaching_level: string | null
          updated_at: string
          work_schedule_id: string | null
        }
        Insert: {
          class_hour_configuration_id: string
          company_id?: string | null
          contract_monthly_hours?: number | null
          contract_type?: string | null
          contract_weekly_hours?: number | null
          created_at?: string
          educator_type?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id: string
          start_date: string
          subject?: string | null
          teaching_level?: string | null
          updated_at?: string
          work_schedule_id?: string | null
        }
        Update: {
          class_hour_configuration_id?: string
          company_id?: string | null
          contract_monthly_hours?: number | null
          contract_type?: string | null
          contract_weekly_hours?: number | null
          created_at?: string
          educator_type?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id?: string
          start_date?: string
          subject?: string | null
          teaching_level?: string | null
          updated_at?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_class_hour_assignment_class_hour_configuration_id_fkey"
            columns: ["class_hour_configuration_id"]
            isOneToOne: false
            referencedRelation: "class_hour_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_class_hour_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_class_hour_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_class_hour_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_class_hour_assignments_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_fixed_scales: {
        Row: {
          company_id: string | null
          created_at: string
          end_date: string | null
          fixed_scale_id: string
          id: string
          is_active: boolean | null
          profile_id: string
          start_date: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          fixed_scale_id: string
          id?: string
          is_active?: boolean | null
          profile_id: string
          start_date: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          fixed_scale_id?: string
          id?: string
          is_active?: boolean | null
          profile_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_fixed_scales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_fixed_scales_fixed_scale_id_fkey"
            columns: ["fixed_scale_id"]
            isOneToOne: false
            referencedRelation: "fixed_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_fixed_scales_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_fixed_scales_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_georeferenced_locations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          location_id: string
          profile_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          location_id: string
          profile_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          location_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_georeferenced_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_georeferenced_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "georeferenced_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_georeferenced_locations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_georeferenced_locations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_identification_methods: {
        Row: {
          company_id: string | null
          created_at: string
          facial_data: string | null
          id: string
          identifier: string | null
          is_active: boolean
          method_type: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          facial_data?: string | null
          id?: string
          identifier?: string | null
          is_active?: boolean
          method_type: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          facial_data?: string | null
          id?: string
          identifier?: string | null
          is_active?: boolean
          method_type?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_identification_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_identification_methods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_identification_methods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_off_days: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_manual_override: boolean
          off_date: string
          profile_id: string
          reason: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_manual_override?: boolean
          off_date: string
          profile_id: string
          reason?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_manual_override?: boolean
          off_date?: string
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_off_days_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_off_days_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_off_days_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_scale_assignments: {
        Row: {
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          profile_id: string
          scale_configuration_id: string
          scale_start_day: string
          start_date: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id: string
          scale_configuration_id: string
          scale_start_day: string
          start_date: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id?: string
          scale_configuration_id?: string
          scale_start_day?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_scale_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scale_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scale_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scale_assignments_scale_configuration_id_fkey"
            columns: ["scale_configuration_id"]
            isOneToOne: false
            referencedRelation: "scale_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_schedules: {
        Row: {
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          profile_id: string
          schedule_id: string
          start_date: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          profile_id: string
          schedule_id: string
          start_date?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          profile_id?: string
          schedule_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_transfers: {
        Row: {
          created_at: string
          from_company_id: string
          id: string
          notes: string | null
          profile_id: string
          reason: string | null
          to_company_id: string
          transfer_date: string
          transferred_by: string
        }
        Insert: {
          created_at?: string
          from_company_id: string
          id?: string
          notes?: string | null
          profile_id: string
          reason?: string | null
          to_company_id: string
          transfer_date?: string
          transferred_by: string
        }
        Update: {
          created_at?: string
          from_company_id?: string
          id?: string
          notes?: string | null
          profile_id?: string
          reason?: string | null
          to_company_id?: string
          transfer_date?: string
          transferred_by?: string
        }
        Relationships: []
      }
      employee_types: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
          validate_pis: boolean | null
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          validate_pis?: boolean | null
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          validate_pis?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_communication_logs: {
        Row: {
          company_id: string | null
          created_at: string
          equipment_id: string
          id: string
          message: string | null
          records_synced: number | null
          request_type: string | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          equipment_id: string
          id?: string
          message?: string | null
          records_synced?: number | null
          request_type?: string | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          equipment_id?: string
          id?: string
          message?: string | null
          records_synced?: number | null
          request_type?: string | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_communication_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_communication_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "time_clock_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_communication_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "time_clock_equipment_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_pending_records: {
        Row: {
          company_id: string | null
          created_at: string
          employee_identifier: string
          equipment_id: string
          id: string
          is_processed: boolean
          processed_at: string | null
          profile_id: string | null
          raw_data: Json | null
          record_type: string | null
          recorded_at: string
          time_record_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_identifier: string
          equipment_id: string
          id?: string
          is_processed?: boolean
          processed_at?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          record_type?: string | null
          recorded_at: string
          time_record_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_identifier?: string
          equipment_id?: string
          id?: string
          is_processed?: boolean
          processed_at?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          record_type?: string | null
          recorded_at?: string
          time_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_pending_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pending_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "time_clock_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pending_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "time_clock_equipment_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pending_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pending_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pending_records_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_scale_cycles: {
        Row: {
          created_at: string
          cycle_order: number | null
          fixed_scale_id: string
          id: string
          off_days: number
          work_days: number
          work_schedule_id: string | null
        }
        Insert: {
          created_at?: string
          cycle_order?: number | null
          fixed_scale_id: string
          id?: string
          off_days: number
          work_days: number
          work_schedule_id?: string | null
        }
        Update: {
          created_at?: string
          cycle_order?: number | null
          fixed_scale_id?: string
          id?: string
          off_days?: number
          work_days?: number
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_scale_cycles_fixed_scale_id_fkey"
            columns: ["fixed_scale_id"]
            isOneToOne: false
            referencedRelation: "fixed_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_scale_cycles_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_scales: {
        Row: {
          calculate_dsr: boolean | null
          code: string | null
          company_id: string | null
          consider_holiday: boolean | null
          created_at: string
          description: string
          end_date: string | null
          id: string
          is_active: boolean | null
          start_date: string
          updated_at: string
        }
        Insert: {
          calculate_dsr?: boolean | null
          code?: string | null
          company_id?: string | null
          consider_holiday?: boolean | null
          created_at?: string
          description: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          start_date: string
          updated_at?: string
        }
        Update: {
          calculate_dsr?: boolean | null
          code?: string | null
          company_id?: string | null
          consider_holiday?: boolean | null
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_scales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      georeferenced_locations: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          radius_meters: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          radius_meters?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          radius_meters?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "georeferenced_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      groupings: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groupings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      in_itinere_hours: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          time_going: string | null
          time_returning: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          time_going?: string | null
          time_returning?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          time_going?: string | null
          time_returning?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "in_itinere_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inss_brackets: {
        Row: {
          company_id: string | null
          created_at: string
          deduction_value: number | null
          id: string
          is_active: boolean | null
          max_salary: number | null
          min_salary: number
          rate: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deduction_value?: number | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary: number
          rate: number
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deduction_value?: number | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number
          rate?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inss_brackets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      interval_mobility: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
          work_schedule_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          work_schedule_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          work_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interval_mobility_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interval_mobility_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      interval_mobility_days: {
        Row: {
          created_at: string
          day_of_week: number
          entry_end: string | null
          entry_start: string | null
          exit_end: string | null
          exit_start: string | null
          id: string
          interval_mobility_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          entry_end?: string | null
          entry_start?: string | null
          exit_end?: string | null
          exit_start?: string | null
          id?: string
          interval_mobility_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          entry_end?: string | null
          entry_start?: string | null
          exit_end?: string | null
          exit_start?: string | null
          id?: string
          interval_mobility_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interval_mobility_days_interval_mobility_id_fkey"
            columns: ["interval_mobility_id"]
            isOneToOne: false
            referencedRelation: "interval_mobility"
            referencedColumns: ["id"]
          },
        ]
      }
      irrf_brackets: {
        Row: {
          company_id: string | null
          created_at: string
          deduction_value: number | null
          id: string
          is_active: boolean | null
          max_salary: number | null
          min_salary: number
          rate: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deduction_value?: number | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary: number
          rate: number
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deduction_value?: number | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number
          rate?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irrf_brackets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          exempt_from_time_clock: boolean | null
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          exempt_from_time_clock?: boolean | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          exempt_from_time_clock?: boolean | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_functions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      justifications: {
        Row: {
          absence_days: number | null
          code: string | null
          company_id: string | null
          created_at: string
          deduct_hours: boolean | null
          description: string
          generate_extra: boolean | null
          id: string
          is_active: boolean | null
          justify_type: string | null
          payroll_code: string | null
          updated_at: string
          usage_limit: number | null
          usage_limit_period_months: number | null
          visible_to_employees: boolean | null
        }
        Insert: {
          absence_days?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          deduct_hours?: boolean | null
          description: string
          generate_extra?: boolean | null
          id?: string
          is_active?: boolean | null
          justify_type?: string | null
          payroll_code?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_limit_period_months?: number | null
          visible_to_employees?: boolean | null
        }
        Update: {
          absence_days?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          deduct_hours?: boolean | null
          description?: string
          generate_extra?: boolean | null
          id?: string
          is_active?: boolean | null
          justify_type?: string | null
          payroll_code?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_limit_period_months?: number | null
          visible_to_employees?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "justifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      license_renewals: {
        Row: {
          created_at: string
          id: string
          license_id: string
          new_valid_until: string
          notes: string | null
          previous_valid_until: string
          renewal_type: string
          renewed_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_id: string
          new_valid_until: string
          notes?: string | null
          previous_valid_until: string
          renewal_type: string
          renewed_by: string
        }
        Update: {
          created_at?: string
          id?: string
          license_id?: string
          new_valid_until?: string
          notes?: string | null
          previous_valid_until?: string
          renewal_type?: string
          renewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_renewals_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          license_key: string
          license_type: string
          max_employees: number | null
          notes: string | null
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          license_key: string
          license_type?: string
          max_employees?: number | null
          notes?: string | null
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          license_key?: string
          license_type?: string
          max_employees?: number | null
          notes?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_shift_configurations: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          duration_hours: number
          holiday_rate_multiplier: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          max_consecutive_hours: number | null
          min_rest_hours: number | null
          name: string
          night_shift_end: string | null
          night_shift_rate_multiplier: number | null
          night_shift_start: string | null
          on_call_rate_multiplier: number | null
          updated_at: string
          weekend_rate_multiplier: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          holiday_rate_multiplier?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_consecutive_hours?: number | null
          min_rest_hours?: number | null
          name: string
          night_shift_end?: string | null
          night_shift_rate_multiplier?: number | null
          night_shift_start?: string | null
          on_call_rate_multiplier?: number | null
          updated_at?: string
          weekend_rate_multiplier?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          holiday_rate_multiplier?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_consecutive_hours?: number | null
          min_rest_hours?: number | null
          name?: string
          night_shift_end?: string | null
          night_shift_rate_multiplier?: number | null
          night_shift_start?: string | null
          on_call_rate_multiplier?: number | null
          updated_at?: string
          weekend_rate_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_shift_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_shift_records: {
        Row: {
          company_id: string | null
          created_at: string
          end_time: string
          health_unit: string | null
          id: string
          is_holiday: boolean | null
          is_night_shift: boolean | null
          is_on_call: boolean | null
          is_weekend: boolean | null
          notes: string | null
          profile_id: string
          shift_configuration_id: string
          shift_date: string
          shift_type: string | null
          start_time: string
          total_hours: number
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_time: string
          health_unit?: string | null
          id?: string
          is_holiday?: boolean | null
          is_night_shift?: boolean | null
          is_on_call?: boolean | null
          is_weekend?: boolean | null
          notes?: string | null
          profile_id: string
          shift_configuration_id: string
          shift_date: string
          shift_type?: string | null
          start_time: string
          total_hours: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_time?: string
          health_unit?: string | null
          id?: string
          is_holiday?: boolean | null
          is_night_shift?: boolean | null
          is_on_call?: boolean | null
          is_weekend?: boolean | null
          notes?: string | null
          profile_id?: string
          shift_configuration_id?: string
          shift_date?: string
          shift_type?: string | null
          start_time?: string
          total_hours?: number
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_shift_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_shift_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_shift_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_shift_records_shift_configuration_id_fkey"
            columns: ["shift_configuration_id"]
            isOneToOne: false
            referencedRelation: "medical_shift_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_alerts: {
        Row: {
          alert_type: string
          company_id: string | null
          created_at: string
          hours_limit: number
          hours_worked: number
          id: string
          notified_at: string
          period_end: string
          period_start: string
          profile_id: string
        }
        Insert: {
          alert_type: string
          company_id?: string | null
          created_at?: string
          hours_limit: number
          hours_worked: number
          id?: string
          notified_at?: string
          period_end: string
          period_start: string
          profile_id: string
        }
        Update: {
          alert_type?: string
          company_id?: string | null
          created_at?: string
          hours_limit?: number
          hours_worked?: number
          id?: string
          notified_at?: string
          period_end?: string
          period_start?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_percentages: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          external_code: string | null
          id: string
          is_active: boolean | null
          is_night: boolean | null
          percentage_value: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean | null
          is_night?: boolean | null
          percentage_value: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean | null
          is_night?: boolean | null
          percentage_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_percentages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_exports: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          employee_count: number | null
          export_type: string
          file_url: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          status: string
          total_hours: number | null
          transaction_hash: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          employee_count?: number | null
          export_type: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
          total_hours?: number | null
          transaction_hash?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          employee_count?: number | null
          export_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_hours?: number | null
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          affects_fgts: boolean | null
          affects_inss: boolean | null
          affects_irrf: boolean | null
          calculation_type: string | null
          code: string
          company_id: string | null
          created_at: string
          default_value: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          item_type: string
          name: string
          percentage: number | null
          updated_at: string
        }
        Insert: {
          affects_fgts?: boolean | null
          affects_inss?: boolean | null
          affects_irrf?: boolean | null
          calculation_type?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          item_type: string
          name: string
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          affects_fgts?: boolean | null
          affects_inss?: boolean | null
          affects_irrf?: boolean | null
          calculation_type?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          item_type?: string
          name?: string
          percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          employee_count: number | null
          id: string
          notes: string | null
          payment_date: string | null
          period_end: string
          period_start: string
          reference_month: number
          reference_year: number
          status: string | null
          total_deductions: number | null
          total_earnings: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_end: string
          period_start: string
          reference_month: number
          reference_year: number
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_end?: string
          period_start?: string
          reference_month?: number
          reference_year?: number
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_delivery_log: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_method: string
          error_message: string | null
          id: string
          payslip_id: string
          recipient: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_method: string
          error_message?: string | null
          id?: string
          payslip_id: string
          recipient?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          error_message?: string | null
          id?: string
          payslip_id?: string
          recipient?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslip_delivery_log_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_items: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          item_type: string
          payroll_item_id: string | null
          payslip_id: string
          quantity: number | null
          reference: string | null
          total_value: number
          unit_value: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          item_type: string
          payroll_item_id?: string | null
          payslip_id: string
          quantity?: number | null
          reference?: string | null
          total_value: number
          unit_value?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          payroll_item_id?: string | null
          payslip_id?: string
          quantity?: number | null
          reference?: string | null
          total_value?: number
          unit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payslip_items_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_items_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          absence_days: number | null
          base_salary: number
          company_id: string | null
          created_at: string
          fgts_base: number | null
          fgts_value: number | null
          id: string
          inss_base: number | null
          inss_value: number | null
          irrf_base: number | null
          irrf_value: number | null
          net_salary: number | null
          overtime_hours: number | null
          payroll_id: string
          pdf_url: string | null
          profile_id: string
          sent_at: string | null
          sent_via: string | null
          status: string | null
          total_deductions: number | null
          total_earnings: number | null
          transaction_hash: string | null
          updated_at: string
          viewed_at: string | null
          worked_days: number | null
          worked_hours: number | null
        }
        Insert: {
          absence_days?: number | null
          base_salary: number
          company_id?: string | null
          created_at?: string
          fgts_base?: number | null
          fgts_value?: number | null
          id?: string
          inss_base?: number | null
          inss_value?: number | null
          irrf_base?: number | null
          irrf_value?: number | null
          net_salary?: number | null
          overtime_hours?: number | null
          payroll_id: string
          pdf_url?: string | null
          profile_id: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          transaction_hash?: string | null
          updated_at?: string
          viewed_at?: string | null
          worked_days?: number | null
          worked_hours?: number | null
        }
        Update: {
          absence_days?: number | null
          base_salary?: number
          company_id?: string | null
          created_at?: string
          fgts_base?: number | null
          fgts_value?: number | null
          id?: string
          inss_base?: number | null
          inss_value?: number | null
          irrf_base?: number | null
          irrf_value?: number | null
          net_salary?: number | null
          overtime_hours?: number | null
          payroll_id?: string
          pdf_url?: string | null
          profile_id?: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          transaction_hash?: string | null
          updated_at?: string
          viewed_at?: string | null
          worked_days?: number | null
          worked_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payrolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_company_users: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          company_id: string | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          level: number
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          cpf: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          is_system_user: boolean | null
          must_change_password: boolean | null
          phone: string | null
          photo_url: string | null
          pis: string | null
          position: string | null
          registration_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_system_user?: boolean | null
          must_change_password?: boolean | null
          phone?: string | null
          photo_url?: string | null
          pis?: string | null
          position?: string | null
          registration_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_system_user?: boolean | null
          must_change_password?: boolean | null
          phone?: string | null
          photo_url?: string | null
          pis?: string | null
          position?: string | null
          registration_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_history: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          company_id: string | null
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          notes: string | null
          previous_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          company_id?: string | null
          id?: string
          new_role: Database["public"]["Enums"]["app_role"]
          notes?: string | null
          previous_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          company_id?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          notes?: string | null
          previous_role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_change_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scale_configurations: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          holiday_treatment: Database["public"]["Enums"]["holiday_treatment"]
          id: string
          is_active: boolean
          name: string
          off_days: number
          scale_type: Database["public"]["Enums"]["scale_type"]
          updated_at: string
          work_days: number
          work_hours_per_day: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          holiday_treatment?: Database["public"]["Enums"]["holiday_treatment"]
          id?: string
          is_active?: boolean
          name: string
          off_days?: number
          scale_type?: Database["public"]["Enums"]["scale_type"]
          updated_at?: string
          work_days?: number
          work_hours_per_day?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          holiday_treatment?: Database["public"]["Enums"]["holiday_treatment"]
          id?: string
          is_active?: boolean
          name?: string
          off_days?: number
          scale_type?: Database["public"]["Enums"]["scale_type"]
          updated_at?: string
          work_days?: number
          work_hours_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scale_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_scales: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_work_day: boolean | null
          notes: string | null
          profile_id: string
          scale_date: string
          updated_at: string
          work_schedule_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_work_day?: boolean | null
          notes?: string | null
          profile_id: string
          scale_date: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_work_day?: boolean | null
          notes?: string | null
          profile_id?: string
          scale_date?: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_scales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_scales_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_scales_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_scales_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          announcement_type: string
          company_id: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          company_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_schedule_slots: {
        Row: {
          assignment_id: string
          class_name: string | null
          company_id: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          notes: string | null
          profile_id: string
          room: string | null
          school: string | null
          slot_number: number
          start_time: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          class_name?: string | null
          company_id?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          notes?: string | null
          profile_id: string
          room?: string | null
          school?: string | null
          slot_number: number
          start_time: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          class_name?: string | null
          company_id?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          profile_id?: string
          room?: string | null
          school?: string | null
          slot_number?: number
          start_time?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_schedule_slots_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "employee_class_hour_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_slots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_equipment: {
        Row: {
          api_endpoint: string | null
          communication_type: string
          company_id: string | null
          created_at: string
          firmware_version: string | null
          id: string
          ip_address: string
          is_active: boolean
          is_online: boolean
          last_communication: string | null
          last_sync: string | null
          location: string | null
          manufacturer: string
          model: string
          name: string
          notes: string | null
          password: string | null
          port: number
          portaria_compliance: string | null
          protocol: string
          rep_number: string | null
          serial_number: string | null
          sync_interval_seconds: number
          updated_at: string
          username: string | null
        }
        Insert: {
          api_endpoint?: string | null
          communication_type?: string
          company_id?: string | null
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          is_online?: boolean
          last_communication?: string | null
          last_sync?: string | null
          location?: string | null
          manufacturer: string
          model: string
          name: string
          notes?: string | null
          password?: string | null
          port?: number
          portaria_compliance?: string | null
          protocol?: string
          rep_number?: string | null
          serial_number?: string | null
          sync_interval_seconds?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          api_endpoint?: string | null
          communication_type?: string
          company_id?: string | null
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          is_online?: boolean
          last_communication?: string | null
          last_sync?: string | null
          location?: string | null
          manufacturer?: string
          model?: string
          name?: string
          notes?: string | null
          password?: string | null
          port?: number
          portaria_compliance?: string | null
          protocol?: string
          rep_number?: string | null
          serial_number?: string | null
          sync_interval_seconds?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          nsr: number
          photo_url: string | null
          profile_id: string
          record_type: string
          recorded_at: string
          transaction_hash: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          nsr?: number
          photo_url?: string | null
          profile_id: string
          record_type: string
          recorded_at?: string
          transaction_hash?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          nsr?: number
          photo_url?: string | null
          profile_id?: string
          record_type?: string
          recorded_at?: string
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_locks: {
        Row: {
          calculated_absence_minutes: number | null
          calculated_overtime_minutes: number | null
          calculated_worked_minutes: number | null
          company_id: string | null
          created_at: string
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_by: string | null
          month: number
          notes: string | null
          profile_id: string
          transaction_hash: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
          year: number
        }
        Insert: {
          calculated_absence_minutes?: number | null
          calculated_overtime_minutes?: number | null
          calculated_worked_minutes?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          month: number
          notes?: string | null
          profile_id: string
          transaction_hash?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          calculated_absence_minutes?: number | null
          calculated_overtime_minutes?: number | null
          calculated_worked_minutes?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          month?: number
          notes?: string | null
          profile_id?: string
          transaction_hash?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_locks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      unions: {
        Row: {
          abbreviation: string
          city: string | null
          cnpj: string
          code: string
          company_id: string | null
          complement: string | null
          created_at: string
          description: string | null
          email: string | null
          entity_type: string | null
          id: string
          is_active: boolean | null
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          state: string | null
          street: string | null
          union_type: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          abbreviation: string
          city?: string | null
          cnpj: string
          code: string
          company_id?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          union_type?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          abbreviation?: string
          city?: string | null
          cnpj?: string
          code?: string
          company_id?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          union_type?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          favorite_routes: string[] | null
          id: string
          last_visited_routes: string[] | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_routes?: string[] | null
          id?: string
          last_visited_routes?: string[] | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_routes?: string[] | null
          id?: string
          last_visited_routes?: string[] | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      work_locations: {
        Row: {
          anti_passback_enabled: boolean | null
          code: string | null
          company_id: string | null
          created_at: string
          current_employees: number | null
          description: string
          id: string
          is_active: boolean | null
          max_employees: number | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          anti_passback_enabled?: boolean | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          current_employees?: number | null
          description: string
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          anti_passback_enabled?: boolean | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          current_employees?: number | null
          description?: string
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          break_duration_minutes: number | null
          company_id: string | null
          created_at: string
          description: string | null
          friday_end: string | null
          friday_start: string | null
          holiday_treatment:
            | Database["public"]["Enums"]["holiday_treatment"]
            | null
          id: string
          interjornada_hours: number | null
          intrajornada_minutes: number | null
          is_active: boolean | null
          monday_end: string | null
          monday_start: string | null
          monthly_hours: number | null
          name: string
          night_shift_end: string | null
          night_shift_reduction_percent: number | null
          night_shift_start: string | null
          off_days: number | null
          overtime_100_percent_limit: number | null
          overtime_50_percent_limit: number | null
          saturday_end: string | null
          saturday_start: string | null
          scale_type: Database["public"]["Enums"]["scale_type"] | null
          sunday_end: string | null
          sunday_start: string | null
          thursday_end: string | null
          thursday_start: string | null
          tolerance_minutes: number | null
          tuesday_end: string | null
          tuesday_start: string | null
          updated_at: string
          wednesday_end: string | null
          wednesday_start: string | null
          weekly_hours: number | null
          work_days: number | null
          work_hours_per_day: number | null
          workload_type: Database["public"]["Enums"]["workload_type"] | null
        }
        Insert: {
          break_duration_minutes?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          friday_end?: string | null
          friday_start?: string | null
          holiday_treatment?:
            | Database["public"]["Enums"]["holiday_treatment"]
            | null
          id?: string
          interjornada_hours?: number | null
          intrajornada_minutes?: number | null
          is_active?: boolean | null
          monday_end?: string | null
          monday_start?: string | null
          monthly_hours?: number | null
          name: string
          night_shift_end?: string | null
          night_shift_reduction_percent?: number | null
          night_shift_start?: string | null
          off_days?: number | null
          overtime_100_percent_limit?: number | null
          overtime_50_percent_limit?: number | null
          saturday_end?: string | null
          saturday_start?: string | null
          scale_type?: Database["public"]["Enums"]["scale_type"] | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          tolerance_minutes?: number | null
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
          weekly_hours?: number | null
          work_days?: number | null
          work_hours_per_day?: number | null
          workload_type?: Database["public"]["Enums"]["workload_type"] | null
        }
        Update: {
          break_duration_minutes?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          friday_end?: string | null
          friday_start?: string | null
          holiday_treatment?:
            | Database["public"]["Enums"]["holiday_treatment"]
            | null
          id?: string
          interjornada_hours?: number | null
          intrajornada_minutes?: number | null
          is_active?: boolean | null
          monday_end?: string | null
          monday_start?: string | null
          monthly_hours?: number | null
          name?: string
          night_shift_end?: string | null
          night_shift_reduction_percent?: number | null
          night_shift_start?: string | null
          off_days?: number | null
          overtime_100_percent_limit?: number | null
          overtime_50_percent_limit?: number | null
          saturday_end?: string | null
          saturday_start?: string | null
          scale_type?: Database["public"]["Enums"]["scale_type"] | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          tolerance_minutes?: number | null
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
          weekly_hours?: number | null
          work_days?: number | null
          work_hours_per_day?: number | null
          workload_type?: Database["public"]["Enums"]["workload_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      payroll_exports_secure: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          employee_count: number | null
          export_type: string | null
          file_status: string | null
          id: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          status: string | null
          total_hours: number | null
          transaction_hash: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          export_type?: string | null
          file_status?: never
          id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          total_hours?: number | null
          transaction_hash?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          export_type?: string | null
          file_status?: never
          id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          total_hours?: number | null
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_secure: {
        Row: {
          company_id: string | null
          cpf: string | null
          created_at: string | null
          department: string | null
          email: string | null
          full_name: string | null
          hire_date: string | null
          id: string | null
          is_active: boolean | null
          must_change_password: boolean | null
          phone: string | null
          photo_url: string | null
          pis: string | null
          position: string | null
          registration_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          cpf?: never
          created_at?: string | null
          department?: string | null
          email?: never
          full_name?: string | null
          hire_date?: string | null
          id?: string | null
          is_active?: boolean | null
          must_change_password?: never
          phone?: never
          photo_url?: string | null
          pis?: never
          position?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          cpf?: never
          created_at?: string | null
          department?: string | null
          email?: never
          full_name?: string | null
          hire_date?: string | null
          id?: string | null
          is_active?: boolean | null
          must_change_password?: never
          phone?: never
          photo_url?: string | null
          pis?: never
          position?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_equipment_secure: {
        Row: {
          api_endpoint: string | null
          communication_type: string | null
          company_id: string | null
          created_at: string | null
          firmware_version: string | null
          id: string | null
          ip_address: string | null
          is_active: boolean | null
          is_online: boolean | null
          last_communication: string | null
          last_sync: string | null
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string | null
          notes: string | null
          password: string | null
          port: number | null
          portaria_compliance: string | null
          protocol: string | null
          rep_number: string | null
          serial_number: string | null
          sync_interval_seconds: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          api_endpoint?: never
          communication_type?: string | null
          company_id?: string | null
          created_at?: string | null
          firmware_version?: string | null
          id?: string | null
          ip_address?: never
          is_active?: boolean | null
          is_online?: boolean | null
          last_communication?: string | null
          last_sync?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string | null
          notes?: string | null
          password?: never
          port?: number | null
          portaria_compliance?: string | null
          protocol?: string | null
          rep_number?: string | null
          serial_number?: string | null
          sync_interval_seconds?: number | null
          updated_at?: string | null
          username?: never
        }
        Update: {
          api_endpoint?: never
          communication_type?: string | null
          company_id?: string | null
          created_at?: string | null
          firmware_version?: string | null
          id?: string | null
          ip_address?: never
          is_active?: boolean | null
          is_online?: boolean | null
          last_communication?: string | null
          last_sync?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string | null
          notes?: string | null
          password?: never
          port?: number | null
          portaria_compliance?: string | null
          protocol?: string | null
          rep_number?: string | null
          serial_number?: string | null
          sync_interval_seconds?: number | null
          updated_at?: string | null
          username?: never
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      decrypt_equipment_password: {
        Args: { encrypted_password: string }
        Returns: string
      }
      encrypt_equipment_password: {
        Args: { plain_password: string }
        Returns: string
      }
      get_equipment_basic_info: {
        Args: { _company_id: string }
        Returns: {
          company_id: string
          created_at: string
          firmware_version: string
          id: string
          is_active: boolean
          is_online: boolean
          last_communication: string
          last_sync: string
          location: string
          manufacturer: string
          model: string
          name: string
          notes: string
          portaria_compliance: string
          rep_number: string
          serial_number: string
          sync_interval_seconds: number
          updated_at: string
        }[]
      }
      get_equipment_for_sync: {
        Args: { equipment_id: string }
        Returns: {
          api_endpoint: string
          company_id: string
          id: string
          ip_address: string
          is_active: boolean
          last_sync: string
          manufacturer: string
          model: string
          name: string
          password: string
          port: number
          protocol: string
          sync_interval_seconds: number
          username: string
        }[]
      }
      get_manager_visible_profiles: {
        Args: { _company_id: string }
        Returns: {
          company_id: string
          department: string
          full_name: string
          hire_date: string
          id: string
          is_active: boolean
          photo_url: string
          position: string
          registration_number: string
          user_id: string
        }[]
      }
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_visible_profile_fields: {
        Args: {
          target_profile: Database["public"]["Tables"]["profiles"]["Row"]
          viewer_user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee" | "super_admin"
      city_hall_sector:
        | "education"
        | "health"
        | "culture"
        | "transport"
        | "administration"
        | "finance"
        | "environment"
        | "social_assistance"
        | "urban_planning"
        | "other"
      holiday_treatment: "normal" | "overtime" | "off"
      organization_type: "company" | "city_hall"
      scale_type: "standard" | "5x1" | "6x1" | "12x36"
      workload_type: "daily" | "weekly" | "monthly"
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
      app_role: ["admin", "manager", "employee", "super_admin"],
      city_hall_sector: [
        "education",
        "health",
        "culture",
        "transport",
        "administration",
        "finance",
        "environment",
        "social_assistance",
        "urban_planning",
        "other",
      ],
      holiday_treatment: ["normal", "overtime", "off"],
      organization_type: ["company", "city_hall"],
      scale_type: ["standard", "5x1", "6x1", "12x36"],
      workload_type: ["daily", "weekly", "monthly"],
    },
  },
} as const
