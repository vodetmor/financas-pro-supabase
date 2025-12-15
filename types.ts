
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
}

export enum ServiceStatus {
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  PAUSED = 'PAUSED',
}

export enum OfferStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

export enum PayoutModel {
  REVENUE = 'REVENUE', // Team gets % of Gross Revenue
  PROFIT = 'PROFIT',   // Team gets % of Net Profit (Revenue - Ads)
}

export enum ExpenseCategory {
  FIXED = 'Fixa',
  VARIABLE = 'Variável',
  ONE_TIME = 'Única',
  MARKETING = 'Marketing (Ads)',
  TOOLS = 'Ferramentas/Software',
  SALARY = 'Pró-labore',
}

export enum BillingCycle {
  MONTHLY = 'Mensal',
  YEARLY = 'Anual',
}

export interface Subscription {
  id: string;
  name: string; // Ex: Adobe Creative Cloud, Server
  amount: number; // Converted BRL amount
  currency?: string; // New: Original currency code (e.g. 'USD')
  originalAmount?: number; // New: Original amount in foreign currency
  billingCycle: BillingCycle;
  firstPaymentDate: string; // New: The start date of the subscription contract
  nextPaymentDate: string;
  category: ExpenseCategory;
  active: boolean;
  autoPay: boolean; // If true, automatically generates transaction on due date
  notes?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  defaultSharePercent: number; // 0-100
  avatarUrl: string;
}

export interface DailyEntry {
  id: string;
  date: string;
  revenue: number;    // Faturamento do dia
  adsSpend: number;   // Gasto em tráfego
  netProfit: number;  // (revenue - adsSpend)
  teamShare: number;  // Calculated based on PayoutModel
  note?: string;
}

export interface OfferParticipant {
  memberId: string;
  role: string;
  sharePercent: number; // % based on the PayoutModel (Relative to Team Pot)
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  status: OfferStatus;

  // Configuration
  payoutModel: PayoutModel;
  teamPotPercent: number; // Global % allocated to the team (Hierarchy top level)
  participants: OfferParticipant[];

  // Currency
  currency?: string; // New: Original currency code
  originalAmount?: number; // New: Original amount

  // Data
  dailyEntries: DailyEntry[];
  startDate: string;
  endDate?: string;

  active: boolean; // Legacy flag, kept for compatibility, sync with status
}

export interface ServiceStep {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ServiceParticipant {
  memberId: string;
  role: string; // Specific role for this service
  sharePercent: number; // Specific share for this service
}

export interface Service {
  id: string;
  title: string;
  description: string;
  clientName: string;
  value: number; // Total contract value
  amountPaid: number; // How much has been received so far
  currency?: string; // New
  originalAmount?: number; // New: Original contract value
  status: ServiceStatus;
  offerId?: string;

  // New detailed fields
  participants: ServiceParticipant[];
  steps: ServiceStep[];
  startDate: string;
  endDate?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: ExpenseCategory | string;
  description: string;
  amount: number; // Converted BRL amount
  currency?: string; // New: Original currency code
  originalAmount?: number; // New: Original amount in foreign currency
  status: TransactionStatus;
  serviceId?: string;
  offerId?: string;
  assignedMemberId?: string;
  subscriptionId?: string; // New: Link to subscription
}

export interface AppState {
  members: TeamMember[];
  offers: Offer[];
  services: Service[];
  transactions: Transaction[];
  subscriptions: Subscription[];
}

export const MOCK_STATE: AppState = {
  members: [
    { id: '1', name: 'Ana Silva', role: 'CEO / Vendas', defaultSharePercent: 40, avatarUrl: '' },
    { id: '2', name: 'Bruno Santos', role: 'Tech Lead', defaultSharePercent: 30, avatarUrl: '' },
    { id: '3', name: 'Carlos Lima', role: 'Marketing', defaultSharePercent: 30, avatarUrl: '' },
  ],
  offers: [],
  services: [],
  transactions: [],
  subscriptions: []
};
