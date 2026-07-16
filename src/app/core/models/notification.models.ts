export type NotificationCategory = 'CALENDAR' | 'SALES' | 'FORMS' | string;

export interface CompanyNotification {
  id: string;
  tenantId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string;
  sourceId?: string;
  createdAt: number;
  readAt?: number;
}

export interface NotificationSummary { items: CompanyNotification[]; unreadCount: number; }

export interface NotificationPreferences {
  tenantId?: string;
  userId?: string;
  inApp: boolean;
  pushEnabled: boolean;
  sales: boolean;
  forms: boolean;
  calendar: boolean;
}
