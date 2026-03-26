import { Container, Token } from './types';

export const MOCK_CONTAINERS: Container[] = [
  { id: '1', number: 'MSCU1234567', size: '40ft', type: 'Dry', status: 'In Yard', location: 'Block A-12', vessel: 'MSC OSCAR' },
  { id: '2', number: 'MAEU7654321', size: '20ft', type: 'Reefer', status: 'Discharged', location: 'Block R-05', vessel: 'MAERSK MC-KINNEY' },
  { id: '3', number: 'CMAU9876543', size: '40ft', type: 'Hazmat', status: 'In Yard', location: 'Block H-01', vessel: 'CMA CGM ANTOINE' },
  { id: '4', number: 'HLCU1122334', size: '45ft', type: 'Dry', status: 'At Sea', vessel: 'HAPAG AL DHAHRA' },
  { id: '5', number: 'ONEU5566778', size: '40ft', type: 'Dry', status: 'Loaded', vessel: 'ONE STORK' },
];

export const MOCK_TOKENS: Token[] = [
  {
    id: 'TKN-8821-XP',
    containerNumber: 'MSCU1234567',
    truckPlate: 'DXB-A-12345',
    driverName: 'Ahmed Hassan',
    appointmentTime: '2026-03-26T10:00:00Z',
    expiryDate: '2026-03-27T10:00:00Z',
    type: 'Export',
    status: 'Active',
    qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TKN-8821-XP',
    history: [
      { status: 'Active', timestamp: '2026-03-25T08:00:00Z', user: 'Terminal Manager', note: 'Token generated' }
    ],
    ocrData: {
      billOfLading: 'BL-9988776655',
      manifestId: 'MF-12345',
      extractedAt: '2026-03-25T08:05:00Z'
    }
  },
  {
    id: 'TKN-4432-LQ',
    containerNumber: 'MAEU7654321',
    truckPlate: 'SHJ-B-99887',
    driverName: 'John Doe',
    appointmentTime: '2026-03-26T14:30:00Z',
    expiryDate: '2026-03-27T14:30:00Z',
    type: 'Import',
    status: 'Active',
    qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TKN-4432-LQ',
    history: [
      { status: 'Active', timestamp: '2026-03-25T09:15:00Z', user: 'Terminal Manager', note: 'Token generated' }
    ]
  },
];
