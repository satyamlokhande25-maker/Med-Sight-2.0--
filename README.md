# MedSight 2.0 - Agentic AI Healthcare Platform

MedSight 2.0 is a next-generation healthcare platform that bridges the gap between doctors and patients through advanced AI-driven insights, real-time consultations, and high-fidelity medical visualizations.

---

 Executive Summary
MedSight 2.0 is a state-of-the-art, AI-integrated clinical management platform designed to revolutionize healthcare delivery. By combining real-time data synchronization, advanced generative AI, and a user-centric interface, MedSight 2.0 empowers healthcare professionals with tools for diagnostic assistance, patient management, and clinical research.

2.# Project Vision & Objectives
The primary objective of MedSight 2.0 is to reduce the administrative burden on clinicians while enhancing the accuracy and speed of medical decision-making.

Efficiency: Automate routine tasks like appointment reminders and report generation.
Intelligence: Provide real-time AI insights grounded in the latest medical research.
Accessibility: Ensure critical patient data is available anytime, anywhere, with a responsive and intuitive UI.
3#. System Architecture
MedSight 2.0 follows a modern full-stack architecture optimized for scalability and security.

3.1 Frontend
Framework: React 19 with TypeScript for type safety and robust component architecture.
Styling: Tailwind CSS for a utility-first, highly customizable design system.
Animations: Framer Motion for smooth, meaningful transitions and interactive elements.
State Management: React Hooks (useState, useEffect, useContext) for local and global state.
3.2 Backend & Infrastructure
Authentication: Firebase Authentication for secure Google Sign-In and session management.
Database: Firebase Firestore (NoSQL) for real-time data synchronization and flexible schema.
Hosting: Google Cloud Run for high-availability containerized deployment.
Server: Express.js (Node.js) for handling API routes and SMTP integrations.
3.3 AI Integration Layer
Core Engine: Google Gemini API (Gemini 3.1 Pro, Flash, Live).
Multimodal Analysis: Gemini 2.5 Flash for analyzing medical images and documents.
Video Generation: Veo 3.1 for creating patient education materials.
Search Grounding: Google Search integration for evidence-based medical research.
4. Detailed Feature Breakdown
4.1 Dynamic Dashboard
The central hub for clinicians, providing:

Real-time Stats: Total patients, today's appointments, and critical cases.
Activity Feed: Recent updates to patient records and diagnostic results.
Quick Actions: Instant access to common tasks like adding patients or scheduling visits.
4.2 Patient Management
A comprehensive system for tracking patient journeys:

Electronic Health Records (EHR): Secure storage of patient history, vitals, and diagnoses.
Status Tracking: Visual indicators for patient condition (Stable, Critical, Recovering).
Search & Filter: High-performance filtering to find patients by name, ID, or status.
4.3 AI Clinical Assistant
A persistent, context-aware chat interface:

Diagnostic Support: Query the AI for potential differential diagnoses based on symptoms.
Drug Interactions: Instantly check for contraindications and side effects.
Medical Summarization: Condense long patient histories into actionable summaries.
4.4 Medical Imaging & Analysis
Advanced diagnostic tools:

X-ray/MRI Analysis: Upload imaging for AI-powered preliminary findings.
Diagram Generation: Generate high-quality anatomical diagrams for clinical reference.
Report Analyzer: Extract key findings from scanned medical reports using OCR and RAG.
4.5 Appointment & Reminder System
Streamlining clinical schedules:

Interactive Calendar: Visual representation of daily, weekly, and monthly schedules.
Automated Reminders: SMS and Email alerts for patients with appointment details.
Conflict Detection: Prevents double-booking and optimizes clinician time.
4.6 Patient Education
Empowering patients with knowledge:

Custom Videos: Generate educational videos tailored to a patient's specific condition.
Multilingual Support: Content available in multiple languages (English, Hindi, Spanish, etc.).
5. Database Design (Firestore)
5.1 Collections Structure
patients: Stores core patient data, demographics, and clinical status.
appointments: Manages scheduling, including date, time, and visit type.
prescriptions: Records medication history and dosage instructions.
user_preferences: Stores clinician-specific settings (Theme, Notifications, Language).
medical_records: Links to diagnostic reports and imaging metadata.
5.2 Security Rules
Authentication Required: All data access requires a valid Firebase Auth token.
Role-Based Access: Clinicians can only access data within their authorized scope.
Data Validation: Strict schema enforcement to ensure data integrity.
6. Security & Compliance
PII Protection: Sensitive patient information is encrypted and access-controlled.
Audit Logs: Tracking of data modifications for accountability.
AI Disclaimers: Every AI-generated insight includes a clinical verification prompt.
7. Integration Guide
7.1 SMTP Setup
To enable automated reminders, clinicians must configure an App Password in their Google Account settings. This allows the server to send emails securely on their behalf.

7.2 API Key Management
MedSight 2.0 requires API keys for Gemini and Google Maps. These are managed via the platform's secure key selection dialog, ensuring keys are never exposed in client-side code.

8. Future Roadmap
Telemedicine Integration: Native video conferencing for remote consultations.
Wearable Sync: Real-time vitals tracking from patient smartwatches.
Predictive Analytics: AI models to predict patient readmission risks.
MedSight 2.0 - Empowering Clinicians with Intelligence. Report Version: 1.0.0 | Date: March 2026

## 🚀 Key Features

### 1. AI-Powered Medical Imaging & Visualization
- **High-Definition Illustrations**: Generates 4K-quality medical diagrams, clinical illustrations, and anatomical cross-sections.
- **4-Tier Robust Fallback**: To ensure 24/7 availability, the system automatically cycles through multiple AI models if one is busy:
  - `gemini-2.5-flash-image` (Primary)
  - `gemini-3.1-flash-image-preview` (Secondary)
  - `gemini-3-pro-image-preview` (Tertiary)
  - **Pollinations.ai** (Final Safety Net - Free, no key required)
- **Scientific Accuracy**: Prompts are optimized for medical textbook quality and clinical precision.

### 2. Intelligent Clinic Locator
- **AI-Grounded Search**: Uses Gemini's grounding tools to find real-world clinics and hospitals near the user's location.
- **3-Tier AI Fallback**: Automatically switches between `Pro`, `Flash`, and `Lite` models to bypass quota limits.
- **Direct Maps Fallback**: If AI models are temporarily unavailable, the system provides a direct "Search on Google Maps" link as a backup.
- **Real-Time Geolocation**: Integrated browser geolocation for precise local results.

### 3. Patient Education & Consultation
- **Visual Learning**: Combines AI-generated images and videos to explain complex medical conditions to patients.
- **Real-Time AI Assistant**: A specialized medical AI assistant for symptom analysis and general health inquiries.
- **Document Analysis**: Upload and analyze medical reports or prescriptions using Gemini's vision capabilities.

### 4. High Reliability & Performance
- **Advanced Retry Logic**: Implements `fetchWithRetry` with exponential backoff and timeout support for all network operations.
- **Quota Management**: Intelligent handling of `429 RESOURCE_EXHAUSTED` errors with user-friendly retry options.
- **Optimized Server-Side Proxies**: Centralized AI logic on the server for better security and model management.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Tailwind CSS, Framer Motion, Lucide React |
| **Backend** | Node.js, Express |
| **AI Integration** | Google Gemini API, Pollinations.ai |
| **State Management** | React Hooks, Context API |

---

## 📦 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file and add your Gemini API Key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 🛡️ Disclaimer
MedSight 2.0 is an AI-powered educational and visualization tool. It is **not** a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for any medical concerns.
