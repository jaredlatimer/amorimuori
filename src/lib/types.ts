export type PizzaCategory = "Pizze Rosse" | "Pizze Bianche";

export type OrderStatus =
  | "pending_payment"
  | "new"
  | "making"
  | "ready"
  | "picked_up"
  | "cancelled"
  | "refunded";

export type ServiceNightStatus = "scheduled" | "open" | "closed";

export interface Pizza {
  id: string;
  name: string;
  description: string;
  category: PizzaCategory;
  price_cents: number;
  nightly_cap: number;
  allergens: string[];
  is_active: boolean;
  is_special: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceNight {
  id: string;
  service_date: string;
  is_enabled: boolean;
  nightly_total: number;
  service_start: string;
  last_pickup: string;
  order_open_at: string;
  order_close_at: string;
  status: ServiceNightStatus;
  sold_out_overrides: Record<string, boolean>;
}

export interface Settings {
  id: string;
  service_start: string;
  last_pickup: string;
  order_open_day: string;
  order_close_time: string;
  bake_minutes: number;
  nightly_pool: number;
}

export interface Order {
  id: string;
  service_night_id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  pickup_at: string;
  status: OrderStatus;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
  stripe_payment_intent_id: string | null;
  placed_at: string;
  cancellable_until: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  pizza_id: string;
  pizza_name: string;
  unit_price_cents: number;
  quantity: number;
}

export interface ReminderSignup {
  id: string;
  email: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      pizzas: {
        Row: Pizza;
        Insert: Omit<Pizza, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Pizza, "id" | "created_at" | "updated_at">>;
      };
      service_nights: {
        Row: ServiceNight;
        Insert: Omit<ServiceNight, "id">;
        Update: Partial<Omit<ServiceNight, "id">>;
      };
      settings: {
        Row: Settings;
        Insert: Omit<Settings, "id">;
        Update: Partial<Omit<Settings, "id">>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id">;
        Update: Partial<Omit<Order, "id">>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id">;
        Update: Partial<Omit<OrderItem, "id">>;
      };
      reminder_signups: {
        Row: ReminderSignup;
        Insert: Omit<ReminderSignup, "id" | "created_at">;
        Update: never;
      };
    };
  };
}
