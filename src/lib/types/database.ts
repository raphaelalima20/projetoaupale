export type UserRole = "admin" | "collaborator";
export type AppointmentOrigin = "manual" | "app";
export type AppointmentStatus = "agendado" | "concluido" | "cancelado";
export type PaymentMethod = "pix" | "dinheiro" | "credito" | "debito" | "promissoria";
export type TransactionType = "entrada" | "saida";
export type ServiceType = "individual" | "pacote";
export type CashStatus = "aberto" | "fechado";
export type ScheduleBlockType = "full_day" | "morning" | "afternoon";

export interface SalonSettings {
  id: string;
  name: string;
  subtitle: string | null;
  phone: string | null;
  address: string | null;
  city: string;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  pix_key: string | null;
  pix_key_type: string | null;
  pix_beneficiary: string | null;
  mercado_pago_token: string | null;
  mercado_pago_enabled: boolean;
  /** Public Mercado Pago payment link shown to customers who pay by card. */
  mercado_pago_link: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/** What the anonymous `salon_public` view exposes — never the Mercado Pago token. */
export type SalonPublicSettings = Pick<
  SalonSettings,
  | "id"
  | "name"
  | "subtitle"
  | "phone"
  | "address"
  | "city"
  | "opening_time"
  | "closing_time"
  | "working_days"
  | "pix_key"
  | "pix_key_type"
  | "pix_beneficiary"
  | "mercado_pago_enabled"
  | "mercado_pago_link"
  | "logo_url"
>;

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  address: string | null;
  role: UserRole;
  specialty: string;
  commission_percentage: number;
  commission_chemical_percentage: number;
  photo_url: string | null;
  avatar_color: string | null;
  is_active: boolean;
  invite_token: string | null;
  invite_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  /** ISO date (YYYY-MM-DD). Optional: only the admin fills it in, never the customer. */
  data_nascimento: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  price: number;
  duration_minutes: number;
  commission_value: number;
  commission_is_percentage: boolean;
  is_chemical: boolean;
  is_variable_price: boolean;
  package_services: string | null;
  package_period: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  collaborator_id: string | null;
  service_id: string | null;
  service_name: string;
  service_price: number;
  commission_value: number;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string | null;
  concluded_at: string | null;
  discount_amount: number;
  surcharge_amount: number;
  surcharge_description: string | null;
  final_amount: number | null;
  is_package_session: boolean;
  package_id: string | null;
  package_session_value: number | null;
  is_split_payment: boolean;
  payment_method_2: PaymentMethod | null;
  payment_amount_1: number | null;
  payment_amount_2: number | null;
  created_at: string;
  updated_at: string;
}

export interface CashRegister {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  status: CashStatus;
  total_pix: number;
  total_dinheiro: number;
  total_credito: number;
  total_debito: number;
  total_entries: number;
  total_exits: number;
  total_day: number;
  opened_by: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  cash_register_id: string | null;
  type: TransactionType;
  amount: number;
  payment_method: PaymentMethod;
  description: string;
  category: string | null;
  appointment_id: string | null;
  product_sale_id: string | null;
  commission_payment_id: string | null;
  affect_cash: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Commission {
  id: string;
  collaborator_id: string;
  appointment_id: string | null;
  service_name: string;
  client_name: string;
  service_value: number;
  commission_value: number;
  commission_date: string;
  is_paid: boolean;
  payment_id: string | null;
  created_at: string;
}

export interface CommissionPayment {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  total_amount: number;
  payment_method: PaymentMethod;
  affect_cash: boolean;
  period_start: string;
  period_end: string;
  services_count: number;
  notes: string | null;
  paid_by: string | null;
  paid_at: string;
  vale_amount: number;
  original_amount: number | null;
  created_at: string;
}

export interface ScheduleBlock {
  id: string;
  collaborator_id: string;
  start_date: string;
  end_date: string;
  /** @deprecated Superseded by end_time — kept only as a fallback for rows predating that column. */
  block_type: ScheduleBlockType;
  /**
   * When set, the collaborator is available again from this time on `end_date` onward
   * (every day before `end_date` is blocked all day). `null` means blocked all day on
   * `end_date` too. `undefined` means the column doesn't exist yet in this database —
   * i.e. the `start_time`/`end_time` migration hasn't been run, so `block_type` is used
   * as a fallback instead.
   */
  end_time?: string | null;
  start_time?: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ClientPackage {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  package_service_id: string | null;
  package_name: string;
  package_description: string | null;
  total_sessions: number;
  used_sessions: number;
  total_price: number;
  session_value: number;
  payment_method: PaymentMethod | null;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  cash_transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A package as returned by the `find_active_packages` RPC (safe subset, usable without login). */
export type ActivePackage = Pick<
  ClientPackage,
  "id" | "package_name" | "total_sessions" | "used_sessions" | "expires_at" | "client_name"
>;

export interface Receivable {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  appointment_id: string | null;
  service_name: string | null;
  original_amount: number;
  remaining_amount: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivablePayment {
  id: string;
  receivable_id: string;
  amount: number;
  payment_method: PaymentMethod;
  cash_transaction_id: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  promotional_price: number | null;
  stock_quantity: number;
  min_stock_alert: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSale {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  payment_method: PaymentMethod;
  client_name: string | null;
  client_phone: string | null;
  sold_by: string | null;
  created_at: string;
}

export interface CartOrder {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  items: Record<string, unknown>;
  total: number;
  payment_method: PaymentMethod | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type WhatsappProvider = "z-api" | "evolution" | "meta";
export type WhatsappMessageType = "lembrete" | "aniversario" | "confirmacao";
export type WhatsappMessageStatus = "pendente" | "enviando" | "enviado" | "erro";

/** Server-only table — the browser only ever sees `WhatsappConfigPublic` (token masked). */
export interface WhatsappConfig {
  id: string;
  token_api: string | null;
  url_api: string | null;
  instancia: string | null;
  provider: WhatsappProvider;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappConfigPublic {
  provider: WhatsappProvider;
  url_api: string;
  instancia: string;
  ativo: boolean;
  /** True when a token is stored; the token itself never leaves the server. */
  token_configurado: boolean;
}

export interface WhatsappTemplate {
  id: string;
  tipo: WhatsappMessageType;
  nome: string;
  mensagem_template: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappQueueMessage {
  id: string;
  cliente_id: string | null;
  agendamento_id: string | null;
  tipo: WhatsappMessageType;
  mensagem: string;
  telefone: string;
  status: WhatsappMessageStatus;
  agendado_para: string;
  enviado_em: string | null;
  erro_msg: string | null;
  tentativas: number;
  chave_unica: string | null;
  created_at: string;
}
