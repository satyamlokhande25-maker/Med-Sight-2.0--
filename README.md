# MedSight 2.0 - Agentic AI Healthcare Platform

MedSight 2.0 is a next-generation healthcare platform that bridges the gap between doctors and patients through advanced AI-driven insights, real-time consultations, and high-fidelity medical visualizations.

---

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
