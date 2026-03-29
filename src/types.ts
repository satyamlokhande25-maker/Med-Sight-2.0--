export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  lastVisit: string;
  status: 'Stable' | 'Critical' | 'Recovering';
  diagnosis: string;
  email?: string;
  phone?: string;
  profileImage?: string | null;
  createdAt?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface MedicalAnalysis {
  id: string;
  patientId: string;
  analysis: string;
  timestamp: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  medicines: {
    name: string;
    dosage: string;
    duration: string;
  }[];
  notes: string;
}

export interface Bill {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending';
  items: {
    description: string;
    price: number;
  }[];
}
