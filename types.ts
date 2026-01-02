export interface Meter {
  id: string;
  serialNumber: string;
  name: string; // e.g., "Main Line" or "Boiler Room"
}

export interface Industry {
  id: string;
  name: string;
  subscriptionId: string;
  city: string;
  address: string;
  meters: Meter[];
  allowedDailyConsumption: number; // In cubic meters
}

export type AlertLevel = 'normal' | 'low' | 'medium' | 'high' | 'critical';

export interface Reading {
  id: string;
  industryId: string;
  meterId: string;
  timestamp: number; // Unix timestamp of creation
  manualYear?: number; // Detected or manually entered year
  manualMonth?: number; // Detected or manually entered month
  value: number; // The counter number
  imageUrl?: string; // Optional base64 image
  isManual: boolean;
  calculatedDailyUsage?: number; // The extrapolated daily usage based on this reading vs previous
  alertLevel?: AlertLevel;
  reason?: string; // Reason for excess consumption
  recordedBy?: string; // Username of the person who recorded it
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface SyncConfig {
  masterKey: string;
  binId: string;
}

export interface AppState {
  industries: Industry[];
  readings: Reading[];
  users: User[];
  currentUser: User | null;
  // Key is username, Value is the list of industries assigned to them
  pendingConfigs?: Record<string, Industry[]>;
  syncConfig?: SyncConfig;
}