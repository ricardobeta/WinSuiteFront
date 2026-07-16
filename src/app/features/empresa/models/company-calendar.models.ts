export interface CompanyCalendarEvent {
  id?: string;
  tenantId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: number;
  end: number;
  allDay: boolean;
  recipientMode: 'ALL' | 'SELECTED';
  recipientUserIds: string[];
  reminderOffsetsMinutes: number[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: number;
  updatedAt?: number;
  version?: number;
}

export interface CalendarRecipient {
  userId: string;
  fullName: string;
  email: string;
}
