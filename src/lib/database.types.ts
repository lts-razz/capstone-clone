export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus =
  | "pending"
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "completed";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type BookingPaymentRefundStatus = "not_required" | "not_eligible" | "pending" | "processed" | "failed";
export type PaymentTransactionStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded";

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
          updated_at: string;
          role: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string;
        };
        Relationships: [];
      };
      blocked_dates: {
        Row: {
          id: string;
          venue_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_dates_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_audit_log: {
        Row: {
          id: string;
          booking_id: string | null;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          old_status: string | null;
          new_status: string | null;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          old_status?: string | null;
          new_status?: string | null;
          reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          old_status?: string | null;
          new_status?: string | null;
          reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_audit_log_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_reschedule_requests: {
        Row: {
          id: string;
          booking_id: string;
          user_id: string;
          requested_start_date: string;
          requested_end_date: string;
          requested_event_date: string | null;
          requested_start_datetime: string | null;
          requested_end_datetime: string | null;
          customer_note: string | null;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_role: "admin" | "staff" | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          user_id: string;
          requested_start_date: string;
          requested_end_date: string;
          requested_event_date?: string | null;
          requested_start_datetime?: string | null;
          requested_end_datetime?: string | null;
          customer_note?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_role?: "admin" | "staff" | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          user_id?: string;
          requested_start_date?: string;
          requested_end_date?: string;
          requested_event_date?: string | null;
          requested_start_datetime?: string | null;
          requested_end_datetime?: string | null;
          customer_note?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_role?: "admin" | "staff" | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_reschedule_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_reschedule_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_payments: {
        Row: {
          id: string;
          booking_id: string;
          total_booking_amount: number;
          minimum_payment_amount: number;
          amount_paid: number;
          remaining_balance: number;
          payment_status: BookingPaymentStatus;
          payment_method: string | null;
          payment_notes: string | null;
          payment_recorded_at: string | null;
          refund_status: BookingPaymentRefundStatus;
          refund_amount: number;
          refund_processed_at: string | null;
          refund_notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          total_booking_amount?: number;
          minimum_payment_amount?: number;
          amount_paid?: number;
          remaining_balance?: number;
          payment_status?: BookingPaymentStatus;
          payment_method?: string | null;
          payment_notes?: string | null;
          payment_recorded_at?: string | null;
          refund_status?: BookingPaymentRefundStatus;
          refund_amount?: number;
          refund_processed_at?: string | null;
          refund_notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          total_booking_amount?: number;
          minimum_payment_amount?: number;
          amount_paid?: number;
          remaining_balance?: number;
          payment_status?: BookingPaymentStatus;
          payment_method?: string | null;
          payment_notes?: string | null;
          payment_recorded_at?: string | null;
          refund_status?: BookingPaymentRefundStatus;
          refund_amount?: number;
          refund_processed_at?: string | null;
          refund_notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_venue_assignments: {
        Row: {
          id: string;
          booking_id: string;
          venue_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          venue_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          venue_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_venue_assignments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_venue_assignments_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          venue_id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          email_notifications_enabled: boolean | null;
          sms_notifications_enabled: boolean | null;
          pax: number | null;
          event_date: string | null;
          start_date: string;
          end_date: string;
          start_datetime: string | null;
          end_datetime: string | null;
          package_id: string | null;
          event_type_id: string | null;
          event_type: string | null;
          special_requests: string | null;
          total_price: number | null;
          status: BookingStatus;
          status_updated_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          rescheduled_at: string | null;
          rescheduled_from_booking_id: string | null;
          created_at: string;
          updated_at: string;
          sms_id: string | null;
          email_id: string | null;
          one_week_notice_sent_at: string | null;
          address: string | null;
          caterer: string | null;
          use_woodberry_caterer: boolean;
          package_type: string | null;
          package_price: number | null;
          package_inclusions: Json | null;
          rooms_count: number | null;
          selected_rooms: Json | null;
          facility_time_ranges: Json | null;
          additionals: Json | null;
          add_ons: Json | null;
          extension_selections: Json | null;
          corkage_selections: Json | null;
          estimate_summary: Json | null;
          minimum_payment_amount: number | null;
          remaining_balance_amount: number | null;
          terms_accepted_at: string | null;
          one_week_email_sent_at: string | null;
          one_week_sms_sent_at: string | null;
          cancellation_reason: string | null;
          override_reason: string | null;
          payment_status: BookingPaymentStatus;
          down_payment_amount: number | null;
          amount_paid: number;
          balance_due: number | null;
          submission_key: string | null;
          reservation_created_at: string;
          reservation_expires_at: string | null;
          reservation_expired_at: string | null;
          expiration_reminder_sent_at: string | null;
          expiration_cancel_notice_sent_at: string | null;
          cancellation_source: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          venue_id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          email_notifications_enabled?: boolean | null;
          sms_notifications_enabled?: boolean | null;
          pax?: number | null;
          event_date?: string | null;
          start_date: string;
          end_date: string;
          start_datetime?: string | null;
          end_datetime?: string | null;
          package_id?: string | null;
          event_type_id?: string | null;
          event_type?: string | null;
          special_requests?: string | null;
          total_price?: number | null;
          status?: BookingStatus;
          status_updated_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_at?: string;
          updated_at?: string;
          sms_id?: string | null;
          email_id?: string | null;
          one_week_notice_sent_at?: string | null;
          address?: string | null;
          caterer?: string | null;
          use_woodberry_caterer?: boolean;
          package_type?: string | null;
          package_price?: number | null;
          package_inclusions?: Json | null;
          rooms_count?: number | null;
          selected_rooms?: Json | null;
          facility_time_ranges?: Json | null;
          additionals?: Json | null;
          add_ons?: Json | null;
          extension_selections?: Json | null;
          corkage_selections?: Json | null;
          estimate_summary?: Json | null;
          minimum_payment_amount?: number | null;
          remaining_balance_amount?: number | null;
          terms_accepted_at?: string | null;
          one_week_email_sent_at?: string | null;
          one_week_sms_sent_at?: string | null;
          cancellation_reason?: string | null;
          override_reason?: string | null;
          payment_status?: BookingPaymentStatus;
          down_payment_amount?: number | null;
          amount_paid?: number;
          balance_due?: number | null;
          submission_key?: string | null;
          reservation_created_at?: string;
          reservation_expires_at?: string | null;
          reservation_expired_at?: string | null;
          expiration_reminder_sent_at?: string | null;
          expiration_cancel_notice_sent_at?: string | null;
          cancellation_source?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          venue_id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          email_notifications_enabled?: boolean | null;
          sms_notifications_enabled?: boolean | null;
          pax?: number | null;
          event_date?: string | null;
          start_date?: string;
          end_date?: string;
          start_datetime?: string | null;
          end_datetime?: string | null;
          package_id?: string | null;
          event_type_id?: string | null;
          event_type?: string | null;
          special_requests?: string | null;
          total_price?: number | null;
          status?: BookingStatus;
          status_updated_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_at?: string;
          updated_at?: string;
          sms_id?: string | null;
          email_id?: string | null;
          one_week_notice_sent_at?: string | null;
          address?: string | null;
          caterer?: string | null;
          use_woodberry_caterer?: boolean;
          package_type?: string | null;
          package_price?: number | null;
          package_inclusions?: Json | null;
          rooms_count?: number | null;
          selected_rooms?: Json | null;
          facility_time_ranges?: Json | null;
          additionals?: Json | null;
          add_ons?: Json | null;
          extension_selections?: Json | null;
          corkage_selections?: Json | null;
          estimate_summary?: Json | null;
          minimum_payment_amount?: number | null;
          remaining_balance_amount?: number | null;
          terms_accepted_at?: string | null;
          one_week_email_sent_at?: string | null;
          one_week_sms_sent_at?: string | null;
          cancellation_reason?: string | null;
          override_reason?: string | null;
          payment_status?: BookingPaymentStatus;
          down_payment_amount?: number | null;
          amount_paid?: number;
          balance_due?: number | null;
          submission_key?: string | null;
          reservation_created_at?: string;
          reservation_expires_at?: string | null;
          reservation_expired_at?: string | null;
          expiration_reminder_sent_at?: string | null;
          expiration_cancel_notice_sent_at?: string | null;
          cancellation_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey";
            columns: ["event_type_id"];
            isOneToOne: false;
            referencedRelation: "event_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_rescheduled_from_booking_id_fkey";
            columns: ["rescheduled_from_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
          email_notifications_enabled: boolean;
          sms_notifications_enabled: boolean;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
          email_notifications_enabled?: boolean;
          sms_notifications_enabled?: boolean;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
          email_notifications_enabled?: boolean;
          sms_notifications_enabled?: boolean;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          position: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          position?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          position?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_types: {
        Row: { id: string; name: string; description: string | null; is_active: boolean; created_at: string };
        Insert: { id?: string; name: string; description?: string | null; is_active?: boolean; created_at?: string };
        Update: { id?: string; name?: string; description?: string | null; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      packages: {
        Row: {
          id: string; name: string; description: string | null; price: number;
          inclusions: string | null; max_pax: number | null; is_active: boolean;
          created_at: string; updated_at: string; min_pax: number | null;
          duration_label: string | null; time_options: Json | null;
          included_facilities: Json | null; rules: Json | null;
          venue_id: string | null;
          thumbnail_url: string | null;
          booking_options: Json;
        };
        Insert: {
          id?: string; name: string; description?: string | null; price: number;
          inclusions?: string | null; max_pax?: number | null; is_active?: boolean;
          created_at?: string; updated_at?: string; min_pax?: number | null;
          duration_label?: string | null; time_options?: Json | null;
          included_facilities?: Json | null; rules?: Json | null;
          venue_id?: string | null;
          thumbnail_url?: string | null;
          booking_options?: Json;
        };
        Update: {
          id?: string; name?: string; description?: string | null; price?: number;
          inclusions?: string | null; max_pax?: number | null; is_active?: boolean;
          created_at?: string; updated_at?: string; min_pax?: number | null;
          duration_label?: string | null; time_options?: Json | null;
          included_facilities?: Json | null; rules?: Json | null;
          venue_id?: string | null;
          thumbnail_url?: string | null;
          booking_options?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "packages_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      package_venue_assignments: {
        Row: {
          id: string;
          package_id: string;
          venue_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          package_id: string;
          venue_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          package_id?: string;
          venue_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_venue_assignments_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_venue_assignments_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      package_venues: {
        Row: {
          id: string;
          package_id: string;
          name: string;
          description: string;
          capacity: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          package_id: string;
          name: string;
          description: string;
          capacity: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          package_id?: string;
          name?: string;
          description?: string;
          capacity?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_venues_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_transactions: {
        Row: {
          id: string; booking_id: string; user_id: string; payment_type: string;
          amount: number; currency: string; gateway: string;
          gateway_checkout_id: string | null; gateway_payment_id: string | null;
          checkout_url: string | null; reference_number: string | null;
          payment_method: string | null; status: PaymentTransactionStatus;
          failure_reason: string | null; paid_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; booking_id: string; user_id: string; payment_type?: string;
          amount: number; currency?: string; gateway?: string;
          gateway_checkout_id?: string | null; gateway_payment_id?: string | null;
          checkout_url?: string | null; reference_number?: string | null;
          payment_method?: string | null; status?: PaymentTransactionStatus;
          failure_reason?: string | null; paid_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; booking_id?: string; user_id?: string; payment_type?: string;
          amount?: number; currency?: string; gateway?: string;
          gateway_checkout_id?: string | null; gateway_payment_id?: string | null;
          checkout_url?: string | null; reference_number?: string | null;
          payment_method?: string | null; status?: PaymentTransactionStatus;
          failure_reason?: string | null; paid_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Relationships: [{
          foreignKeyName: "payment_transactions_booking_id_fkey";
          columns: ["booking_id"]; isOneToOne: false;
          referencedRelation: "bookings"; referencedColumns: ["id"];
        }];
      };
      payments: {
        Row: {
          id: string; booking_id: string; user_id: string; payment_type: string;
          amount: number; currency: string; payment_method: string | null;
          gateway: string; gateway_checkout_id: string | null;
          gateway_payment_id: string | null; checkout_url: string | null;
          reference_number: string | null; status: PaymentTransactionStatus;
          failure_reason: string | null; paid_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; booking_id: string; user_id: string; payment_type?: string;
          amount: number; currency?: string; payment_method?: string | null;
          gateway?: string; gateway_checkout_id?: string | null;
          gateway_payment_id?: string | null; checkout_url?: string | null;
          reference_number?: string | null; status?: PaymentTransactionStatus;
          failure_reason?: string | null; paid_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; booking_id?: string; user_id?: string; payment_type?: string;
          amount?: number; currency?: string; payment_method?: string | null;
          gateway?: string; gateway_checkout_id?: string | null;
          gateway_payment_id?: string | null; checkout_url?: string | null;
          reference_number?: string | null; status?: PaymentTransactionStatus;
          failure_reason?: string | null; paid_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Relationships: [{
          foreignKeyName: "payments_booking_id_fkey";
          columns: ["booking_id"]; isOneToOne: false;
          referencedRelation: "bookings"; referencedColumns: ["id"];
        }];
      };
      reviews: {
        Row: { id: string; user_id: string; booking_id: string; rating: number; comment: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; booking_id: string; rating: number; comment?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; booking_id?: string; rating?: number; comment?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{
          foreignKeyName: "reviews_booking_id_fkey";
          columns: ["booking_id"]; isOneToOne: false;
          referencedRelation: "bookings"; referencedColumns: ["id"];
        }];
      };
      staff_roles: {
        Row: { user_id: string; role: string; created_at: string };
        Insert: { user_id: string; role: string; created_at?: string };
        Update: { user_id?: string; role?: string; created_at?: string };
        Relationships: [];
      };
      venues: {
        Row: { id: string; name: string; description: string | null; location: string | null; capacity: number | null; price_per_night: number; image_url: string | null; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; description?: string | null; location?: string | null; capacity?: number | null; price_per_night: number; image_url?: string | null; is_active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; description?: string | null; location?: string | null; capacity?: number | null; price_per_night?: number; image_url?: string | null; is_active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      add_review: { Args: { p_user_id: string; p_booking_id: string; p_rating: number; p_comment?: string | null }; Returns: string };
      cancel_booking: { Args: { p_booking_id: string; p_user_id: string }; Returns: boolean };
      change_booking_status: { Args: { p_booking_id: string; p_new_status: string; p_actor_id: string; p_actor_role: string; p_reason?: string | null; p_allow_override?: boolean | null }; Returns: Json };
      confirm_booking: { Args: { p_booking_id: string; p_user_id: string }; Returns: boolean };
      create_booking: { Args: { p_user_id: string; p_venue_id: string; p_start_date: string; p_end_date: string; p_event_date?: string | null; p_event_type?: string | null; p_event_type_id?: string | null; p_package_id?: string | null; p_pax?: number | null; p_special_requests?: string | null; p_full_name?: string | null; p_phone?: string | null }; Returns: string };
      approve_booking_reschedule_request: { Args: { p_request_id: string; p_actor_id: string; p_actor_role: string; p_reason?: string | null; p_admin_override_one_week?: boolean | null }; Returns: Json };
      reschedule_booking: { Args: { p_booking_id: string; p_new_start: string; p_new_end: string; p_new_event_date?: string | null }; Returns: string };
      valid_booking_transition: { Args: { old_status: string; new_status: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
