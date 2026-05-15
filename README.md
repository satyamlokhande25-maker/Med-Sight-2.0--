# 🩺 MedSight 2.0 - Agentic AI Healthcare Platform

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Multimodal-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-Styling-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**MedSight 2.0** is a next-generation, high-performance clinical management platform designed for modern healthcare professionals. It integrates state-of-the-art **Agentic AI** to streamline diagnostics, patient care, and administrative workflows.

---

## 🚀 [Live Demo](https://ais-pre-jnb4wxtkylcgnk4vv3452c-274181117707.asia-southeast1.run.app)

> **Note:** Access the demo with your Google account. Ensure you have your Gemini API key ready for AI features.

---

## 📸 Platform Overview

| **Intelligent Dashboard** | **AI Clinical Assistant** |
|:---:|:---:|
| ![Dashboard Capture](https://via.placeholder.com/600x400/09090b/emerald?text=Real-time+Clinical+Stats) | ![AI Assistant](https://via.placeholder.com/600x400/09090b/emerald?text=Context-Aware+Medical+AI) |

---

## ✨ Key Features

### 🔐 Secure Login & Onboarding
- **Google OAuth Integration:** Secure, one-tap authentication powered by Firebase.
- **Personalized Profile:** Clinicians can set their preferences, including high-contrast themes and multi-language support (English, Hindi, Spanish, etc.).

### 📊 Real-time Clinical Dashboard
- **Live Stats:** Instant overview of total patients, today's appointments, and critical cases.
- **Activity Feed:** real-time audit trail of patient record updates and diagnostic analysis.
- **Data Visualization:** High-fidelity charts showing patient status distribution and clinical trends.

### 🧠 MedSight AI - The Agentic Co-pilot
- **Differential Diagnosis:** Brainstorm potential health conditions based on symptoms.
- **Drug Interaction Checker:** Instantly verify potential contraindications between multiple medications.
- **Research Grounding:** AI responses are backed by real-time Google Search results from latest medical literature.

### 🖼️ Multimodal Medical Analysis (RAG 2.0)
- **Image Intelligence:** Analyze X-rays, MRIs, and CT scans for preliminary clinical findings using Gemini 3.1 Pro Vision.
- **Document RAG:** Upload physical lab reports or heavy PDFs. The system extracts structured medical data and allows you to "chat" with the document.
- **Parallel Processing:** Handles multiple file uploads simultaneously with high-speed extraction.

### 📋 Patient Management (EHR)
- **Comprehensive History:** Full tracking of vitals (BP, HR, Temp), medical history, and clinical notes.
- **Dynamic Status Tracking:** Visual indicators for 'Stable', 'Critical', or 'Recovering' status.
- **Smart Filtering:** Locate patient records instantly across thousands of entries.

### 📅 Automated Scheduling & Reminders
- **Interactive Calendar:** Manage clinician availability with a drag-and-drop interface.
- **SMTP Notification Engine:** Automated personalized email reminders sent via secure server-side proxy.

### 🎥 Patient Education 
- **AI Video Generation:** Create personalized anatomical explanation videos for patients using Google Veo AI.
- **Diagram Generator:** High-quality anatomical diagrams for clinical reference.

---

## 🛠️ Technology Stack

| Layer | Technology |
|:--- |:--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Node.js (Express), TSX (Server-side TS) |
| **Database** | Firebase Firestore (Real-time NoSQL) |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Intelligence** | Gemini 3.1 Pro/Flash, Google Search Grounding |
| **Visuals** | Recharts, D3.js, Lucide Icons |
| **Infrastructure** | Google Cloud Run, Docker |

---

## ⚙️ Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/medsight-2.0.git
   cd medsight-2.0
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Firebase Config
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # AI Credentials
   GEMINI_API_KEY=your_gemini_api_key
   
   # SMTP Config (Optional for reminders)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm run start
   ```

---

## 🔒 Security & Compliance

- **HIPAA-Ready Architecture:** Designed with data isolation and strict access control in mind.
- **Encrypted Communication:** All data is transmitted via TLS/SSL.
- **Rule-Based Access:** Firestore Security Rules ensure clinicians only access authorized patient data.
- **AI Accountability:** All AI insights strictly include clinical disclaimers for human verification.

---

## 🗺️ Roadmap

- [ ] **Telemedicine Native:** End-to-end encrypted video consultations.
- [ ] **IoT Wearable Sync:** Real-time vitals tracking from Apple Health & Google Fit.
- [ ] **Predictive Risk Modeling:** Use ML to predict patient readmission risks.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🤝 Contact & Support

Developed with ❤️ by the MedSight Team. For inquiries or collaborations, reach out via [Email](mailto:satyamlokhande01@gmail.com).

*"Empowering Clinicians with Intelligence. Saving Lives with Data."*
