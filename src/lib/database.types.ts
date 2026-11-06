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
      access_information: {
        Row: {
          attraction_id: string | null
          created_at: string
          destination_id: string
          details: string
          excluded_transport_modes: Database["public"]["Enums"]["transport_mode"][]
          id: string
          is_essential: boolean
          restriction_type: Database["public"]["Enums"]["restriction_type"]
          review_due_at: string
          source_id: string
          status: Database["public"]["Enums"]["access_status"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          verified_at: string
        }
        Insert: {
          attraction_id?: string | null
          created_at?: string
          destination_id: string
          details: string
          excluded_transport_modes?: Database["public"]["Enums"]["transport_mode"][]
          id?: string
          is_essential: boolean
          restriction_type: Database["public"]["Enums"]["restriction_type"]
          review_due_at: string
          source_id: string
          status: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at: string
        }
        Update: {
          attraction_id?: string | null
          created_at?: string
          destination_id?: string
          details?: string
          excluded_transport_modes?: Database["public"]["Enums"]["transport_mode"][]
          id?: string
          is_essential?: boolean
          restriction_type?: Database["public"]["Enums"]["restriction_type"]
          review_due_at?: string
          source_id?: string
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_information_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_information_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_information_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "information_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      algorithm_configs: {
        Row: {
          created_at: string
          curves: Json
          diversity: Json
          flexible_date_window_days: number
          is_active: boolean
          notes: string | null
          updated_at: string
          version: string
          weights: Json
        }
        Insert: {
          created_at?: string
          curves: Json
          diversity: Json
          flexible_date_window_days?: number
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          version: string
          weights: Json
        }
        Update: {
          created_at?: string
          curves?: Json
          diversity?: Json
          flexible_date_window_days?: number
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          anonymous_id_hash: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          trip_id: string | null
        }
        Insert: {
          anonymous_id_hash?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          trip_id?: string | null
        }
        Update: {
          anonymous_id_hash?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      attractions: {
        Row: {
          activity_duration_minutes: number | null
          created_at: string
          description: string | null
          destination_id: string
          entry_fee_currency: string
          entry_fee_minor: number | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          opening_information: Json | null
          priority: number
          review_due_at: string | null
          source_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          activity_duration_minutes?: number | null
          created_at?: string
          description?: string | null
          destination_id: string
          entry_fee_currency?: string
          entry_fee_minor?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_information?: Json | null
          priority?: number
          review_due_at?: string | null
          source_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          activity_duration_minutes?: number | null
          created_at?: string
          description?: string | null
          destination_id?: string
          entry_fee_currency?: string
          entry_fee_minor?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_information?: Json | null
          priority?: number
          review_due_at?: string | null
          source_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attractions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attractions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "information_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cost_assumptions: {
        Row: {
          created_at: string
          key: string
          review_due_at: string
          source_id: string | null
          unit: string
          updated_at: string
          value: number
          verified_at: string
        }
        Insert: {
          created_at?: string
          key: string
          review_due_at: string
          source_id?: string | null
          unit: string
          updated_at?: string
          value: number
          verified_at: string
        }
        Update: {
          created_at?: string
          key?: string
          review_due_at?: string
          source_id?: string | null
          unit?: string
          updated_at?: string
          value?: number
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_assumptions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "information_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_categories: {
        Row: {
          category_id: string
          created_at: string
          destination_id: string
          is_primary: boolean
        }
        Insert: {
          category_id: string
          created_at?: string
          destination_id: string
          is_primary?: boolean
        }
        Update: {
          category_id?: string
          created_at?: string
          destination_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "destination_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_categories_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_costs: {
        Row: {
          amount_minor: number | null
          assumptions: string | null
          cost_type: Database["public"]["Enums"]["cost_type"]
          created_at: string
          currency: string
          destination_id: string
          id: string
          is_essential: boolean
          label: string
          maximum_amount_minor: number | null
          minimum_amount_minor: number | null
          review_due_at: string | null
          source_id: string | null
          transport_mode: Database["public"]["Enums"]["transport_mode"] | null
          unit: Database["public"]["Enums"]["cost_unit"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          verified_at: string | null
        }
        Insert: {
          amount_minor?: number | null
          assumptions?: string | null
          cost_type: Database["public"]["Enums"]["cost_type"]
          created_at?: string
          currency?: string
          destination_id: string
          id?: string
          is_essential?: boolean
          label: string
          maximum_amount_minor?: number | null
          minimum_amount_minor?: number | null
          review_due_at?: string | null
          source_id?: string | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"] | null
          unit: Database["public"]["Enums"]["cost_unit"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
        }
        Update: {
          amount_minor?: number | null
          assumptions?: string | null
          cost_type?: Database["public"]["Enums"]["cost_type"]
          created_at?: string
          currency?: string
          destination_id?: string
          id?: string
          is_essential?: boolean
          label?: string
          maximum_amount_minor?: number | null
          minimum_amount_minor?: number | null
          review_due_at?: string | null
          source_id?: string | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"] | null
          unit?: Database["public"]["Enums"]["cost_unit"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "destination_costs_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_costs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "information_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_images: {
        Row: {
          alt_text: string
          caption: string | null
          created_at: string
          credit: string
          destination_id: string
          external_url: string | null
          id: string
          is_primary: boolean
          licence: string
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          alt_text: string
          caption?: string | null
          created_at?: string
          credit: string
          destination_id: string
          external_url?: string | null
          id?: string
          is_primary?: boolean
          licence: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string
          caption?: string | null
          created_at?: string
          credit?: string
          destination_id?: string
          external_url?: string | null
          id?: string
          is_primary?: boolean
          licence?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_images_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          accessibility_notes: string | null
          best_season_months: number[] | null
          content_verified_at: string | null
          created_at: string
          description: string | null
          destination_type: string
          district_id: string
          group_suitability: Json
          id: string
          latitude: number
          longitude: number
          name: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          requires_permit: boolean
          review_due_at: string | null
          short_description: string
          slug: string
          suggested_duration_label: string | null
          suitable_durations: Database["public"]["Enums"]["duration_code"][]
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          best_season_months?: number[] | null
          content_verified_at?: string | null
          created_at?: string
          description?: string | null
          destination_type: string
          district_id: string
          group_suitability?: Json
          id?: string
          latitude: number
          longitude: number
          name: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          requires_permit?: boolean
          review_due_at?: string | null
          short_description: string
          slug: string
          suggested_duration_label?: string | null
          suitable_durations?: Database["public"]["Enums"]["duration_code"][]
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          best_season_months?: number[] | null
          content_verified_at?: string | null
          created_at?: string
          description?: string | null
          destination_type?: string
          district_id?: string
          group_suitability?: Json
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          requires_permit?: boolean
          review_due_at?: string | null
          short_description?: string
          slug?: string
          suggested_duration_label?: string | null
          suitable_durations?: Database["public"]["Enums"]["duration_code"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      duration_rules: {
        Row: {
          created_at: string
          duration_code: Database["public"]["Enums"]["duration_code"]
          label: string
          max_one_way_minutes: number
          nights: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_code: Database["public"]["Enums"]["duration_code"]
          label: string
          max_one_way_minutes: number
          nights: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_code?: Database["public"]["Enums"]["duration_code"]
          label?: string
          max_one_way_minutes?: number
          nights?: number
          updated_at?: string
        }
        Relationships: []
      }
      information_sources: {
        Row: {
          accessed_at: string
          created_at: string
          id: string
          notes: string | null
          publisher: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string | null
          updated_at: string
        }
        Insert: {
          accessed_at: string
          created_at?: string
          id?: string
          notes?: string | null
          publisher?: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          accessed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          publisher?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      location_destination_routes: {
        Row: {
          computed_at: string
          created_at: string
          destination_id: string
          distance_km: number
          duration_minutes: number
          location_id: string
          provider: string
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at: string
        }
        Insert: {
          computed_at: string
          created_at?: string
          destination_id: string
          distance_km: number
          duration_minutes: number
          location_id: string
          provider: string
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          destination_id?: string
          distance_km?: number
          duration_minutes?: number
          location_id?: string
          provider?: string
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_destination_routes_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_destination_routes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          aliases: string[]
          created_at: string
          district_id: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          normalized_name: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          district_id: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          normalized_name: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          district_id?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          normalized_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          count: number
          created_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          created_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          created_at?: string
          window_start?: string
        }
        Relationships: []
      }
      roulette_results: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          public_code: string
          recommendation_id: string
          rng: string
          selection_index: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          public_code: string
          recommendation_id: string
          rng: string
          selection_index: number
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          public_code?: string
          recommendation_id?: string
          rng?: string
          selection_index?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_results_recommendation_id_trip_id_fkey"
            columns: ["recommendation_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_recommendations"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "roulette_results_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_itinerary_items: {
        Row: {
          attraction_id: string | null
          created_at: string
          day: number
          end_local: string | null
          id: string
          kind: Database["public"]["Enums"]["itinerary_kind"]
          notes: string | null
          sequence: number
          start_local: string | null
          title: string
          trip_id: string
        }
        Insert: {
          attraction_id?: string | null
          created_at?: string
          day?: number
          end_local?: string | null
          id?: string
          kind: Database["public"]["Enums"]["itinerary_kind"]
          notes?: string | null
          sequence: number
          start_local?: string | null
          title: string
          trip_id: string
        }
        Update: {
          attraction_id?: string | null
          created_at?: string
          day?: number
          end_local?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["itinerary_kind"]
          notes?: string | null
          sequence?: number
          start_local?: string | null
          title?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_items_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_recommendations: {
        Row: {
          access_snapshot: Json
          cost_snapshot: Json
          created_at: string
          destination_id: string
          id: string
          match_reason: string
          match_score: number
          position: number
          route_snapshot: Json
          score_components: Json
          trip_id: string
          warnings: Json
        }
        Insert: {
          access_snapshot: Json
          cost_snapshot: Json
          created_at?: string
          destination_id: string
          id?: string
          match_reason: string
          match_score: number
          position: number
          route_snapshot: Json
          score_components: Json
          trip_id: string
          warnings?: Json
        }
        Update: {
          access_snapshot?: Json
          cost_snapshot?: Json
          created_at?: string
          destination_id?: string
          id?: string
          match_reason?: string
          match_score?: number
          position?: number
          route_snapshot?: Json
          score_components?: Json
          trip_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "trip_recommendations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_share_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          snapshot: Json
          token_hash: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          snapshot: Json
          token_hash: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          snapshot?: Json
          token_hash?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_share_links_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          accessibility_needs: string[]
          algorithm_version: string
          budget_per_person_minor: number
          created_at: string
          currency: string
          date_flexible: boolean
          duration_code: Database["public"]["Enums"]["duration_code"]
          expires_at: string
          id: string
          moods: string[]
          overnight_stay: boolean | null
          owner_user_id: string
          preference_snapshot: Json
          start_location_id: string
          status: Database["public"]["Enums"]["trip_status"]
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          travel_date: string | null
          travel_group: Database["public"]["Enums"]["travel_group"]
          traveller_count: number
          updated_at: string
        }
        Insert: {
          accessibility_needs?: string[]
          algorithm_version: string
          budget_per_person_minor: number
          created_at?: string
          currency?: string
          date_flexible?: boolean
          duration_code: Database["public"]["Enums"]["duration_code"]
          expires_at?: string
          id?: string
          moods: string[]
          overnight_stay?: boolean | null
          owner_user_id: string
          preference_snapshot: Json
          start_location_id: string
          status?: Database["public"]["Enums"]["trip_status"]
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          travel_date?: string | null
          travel_group: Database["public"]["Enums"]["travel_group"]
          traveller_count: number
          updated_at?: string
        }
        Update: {
          accessibility_needs?: string[]
          algorithm_version?: string
          budget_per_person_minor?: number
          created_at?: string
          currency?: string
          date_flexible?: boolean
          duration_code?: Database["public"]["Enums"]["duration_code"]
          expires_at?: string
          id?: string
          moods?: string[]
          overnight_stay?: boolean | null
          owner_user_id?: string
          preference_snapshot?: Json
          start_location_id?: string
          status?: Database["public"]["Enums"]["trip_status"]
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          travel_date?: string | null
          travel_group?: Database["public"]["Enums"]["travel_group"]
          traveller_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_algorithm_version_fkey"
            columns: ["algorithm_version"]
            isOneToOne: false
            referencedRelation: "algorithm_configs"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "trips_start_location_id_fkey"
            columns: ["start_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_destination: { Args: { destination_id: string }; Returns: Json }
    }
    Enums: {
      access_status: "open" | "restricted" | "closed" | "advisory" | "unknown"
      admin_role: "editor" | "admin"
      cost_type:
        | "food"
        | "parking"
        | "toll"
        | "accommodation"
        | "public_transport"
        | "guide"
        | "other"
      cost_unit: "per_person" | "per_vehicle" | "per_group" | "per_room_night"
      duration_code: "few_hours" | "one_day" | "two_days" | "three_to_five_days"
      itinerary_kind: "travel" | "attraction" | "meal" | "rest" | "return"
      publication_status: "draft" | "review" | "published" | "archived"
      restriction_type:
        | "general"
        | "seasonal"
        | "permit"
        | "entry"
        | "safety"
        | "road"
        | "transport"
        | "weather"
      source_type: "official" | "operator" | "field_visit" | "secondary"
      transport_mode: "car" | "bike" | "public_transport"
      travel_group: "solo" | "friends" | "couple" | "family"
      trip_status: "recommended" | "spun" | "expired"
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
    Enums: {
      access_status: ["open", "restricted", "closed", "advisory", "unknown"],
      admin_role: ["editor", "admin"],
      cost_type: [
        "food",
        "parking",
        "toll",
        "accommodation",
        "public_transport",
        "guide",
        "other",
      ],
      cost_unit: ["per_person", "per_vehicle", "per_group", "per_room_night"],
      duration_code: ["few_hours", "one_day", "two_days", "three_to_five_days"],
      itinerary_kind: ["travel", "attraction", "meal", "rest", "return"],
      publication_status: ["draft", "review", "published", "archived"],
      restriction_type: [
        "general",
        "seasonal",
        "permit",
        "entry",
        "safety",
        "road",
        "transport",
        "weather",
      ],
      source_type: ["official", "operator", "field_visit", "secondary"],
      transport_mode: ["car", "bike", "public_transport"],
      travel_group: ["solo", "friends", "couple", "family"],
      trip_status: ["recommended", "spun", "expired"],
    },
  },
} as const
