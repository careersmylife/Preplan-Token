export interface Container {
  id: string;
  number: string;
  size: '20ft' | '40ft' | '45ft';
  type: 'Dry' | 'Reefer' | 'Hazmat' | 'Open Top';
  status: 'In Yard' | 'At Sea' | 'Discharged' | 'Loaded';
  location?: string;
  vessel?: string;
}

export interface HistoryEntry {
  status: 'Active' | 'Used' | 'Expired' | 'Cancelled';
  timestamp: string;
  user: string;
  note?: string;
  gateId?: string;
}

export interface Token {
  id: string;
  containerNumber: string;
  truckPlate: string;
  driverName: string;
  appointmentTime: string;
  expiryDate: string;
  type: 'Import' | 'Export';
  status: 'Active' | 'Used' | 'Expired' | 'Cancelled';
  qrCode: string;
  history: HistoryEntry[];
  ocrData?: {
    billOfLading?: string;
    manifestId?: string;
    extractedAt: string;
  };
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
  tokenId?: string;
}

export interface GateEvent {
  id: string;
  tokenId: string;
  containerNumber: string;
  truckPlate: string;
  driverName: string;
  type: 'Used' | 'Cancelled';
  timestamp: string;
  gateId: string;
}

export interface DashboardStats {
  totalContainers: number;
  activeTokens: number;
  gateActivity: number;
  yardCapacity: number;
}
