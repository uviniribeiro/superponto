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
            foreignKeyName: "adjustment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      class_hour_configurations: {
        Row: {
          activity_hours_percent: number | null
          company_id: string | null
          contract_type: string | null
          created_at: string
          description: string | null
          duration_minutes: number
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
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          company_code: string
          created_at: string
          id: string
          is_active: boolean
          license_status: string | null
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          parent_organization_id: string | null
          sector: Database["public"]["Enums"]["city_hall_sector"] | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          license_status?: string | null
          name: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          sector?: Database["public"]["Enums"]["city_hall_sector"] | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          license_status?: string | null
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          sector?: Database["public"]["Enums"]["city_hall_sector"] | null
          state?: string | null
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
          monthly_overtime_limit_hours: number | null
          overtime_alert_email: string | null
          rep_manufacturer: string | null
          rep_model: string | null
          rep_number: string | null
          state: string | null
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
          monthly_overtime_limit_hours?: number | null
          overtime_alert_email?: string | null
          rep_manufacturer?: string | null
          rep_model?: string | null
          rep_number?: string | null
          state?: string | null
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
          monthly_overtime_limit_hours?: number | null
          overtime_alert_email?: string | null
          rep_manufacturer?: string | null
          rep_model?: string | null
          rep_number?: string | null
          state?: string | null
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
      employee_class_hour_assignments: {
        Row: {
          class_hour_configuration_id: string
          company_id: string | null
          contract_monthly_hours: number | null
          contract_type: string | null
          contract_weekly_hours: number | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          profile_id: string
          start_date: string
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
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id: string
          start_date: string
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
          end_date?: string | null
          id?: string
          is_active?: boolean
          profile_id?: string
          start_date?: string
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
            foreignKeyName: "employee_class_hour_assignments_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
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
            foreignKeyName: "employee_schedules_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
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
      licenses: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          license_key: string
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
      [_ in never]: never
    }
    Functions: {
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
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
