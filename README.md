<div align="center">
  
  # 🚛 OptiMarg
  **Autonomous Fleet Intelligence & Logistics Command Center**

  <p align="center">
    <img src="https://img.shields.io/badge/Smart%20India%20Hackathon-2026-FF9900?style=for-the-badge&logo=hackaday&logoColor=white" alt="SIH 2026" />
    <img src="https://img.shields.io/badge/Team-Null_Terminators-8A2BE2?style=for-the-badge" alt="Null Terminators" />
    <img src="https://img.shields.io/badge/Status-Active_Development-4CAF50?style=for-the-badge" alt="Status" />
  </p>

  <p align="center">
    <em>Transforming raw fleet telemetry into real-time actionable intelligence, optimized routing, and dynamic ETA predictions.</em>
  </p>
</div>

---

## 🚀 Overview

Modern fleet operations generate massive volumes of vehicle and shipment data, but converting that data into real-time dispatch decisions remains a critical bottleneck. **OptiMarg** eliminates static schedules and fragmented visibility by accepting a single Vehicle ID to auto-fetch live telemetry. It seamlessly feeds this data into a dual-engine architecture: a **Machine Learning ETA Predictor** and a **Google OR-Tools Route Solver**, allowing dispatchers to execute the absolute least-cost multi-stop routes with high-confidence arrival times.

---

## 🛠️ Tech Stack

### Frontend & UI
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=Leaflet&logoColor=white)

### Backend & Database
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

### AI, ML & Optimization Engines
![Google OR-Tools](https://img.shields.io/badge/Google_OR--Tools-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Scikit-Learn](https://img.shields.io/badge/scikit--learn-%23F7931E.svg?style=for-the-badge&logo=scikit-learn&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

### Deployment & Version Control
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)

---

## ✨ Key Features (USPs)

* 🗺️ **Command Overview & Spatial Telemetry:** A live grid mapping active logistics corridors across India. Instantly track unit coordinates, transit lines, and operational status in real-time.
* 🧠 **OR-Tools Optimization Center:** Execute constraint programming (`RoutingModel`, `CP-SAT Solver`) for multi-stop deliveries. Instantly calculates the mathematical least-cost sequence, detailing exact distance (km), time (min), and $CO_2$ (kg) saved per run.
* ⏱️ **ML ETA Engine:** Replaces static timetables with dynamic forecasting. Evaluates real-time traffic delay factors (e.g., 1.2x) and historical models to generate highly accurate arrival timestamps with a model confidence score.
* 💬 **Conversational AI Query Assistant:** A natural-language interface allowing dispatchers to instantly fetch diagnostics (e.g., *"Where is vehicle 8?"* or *"Check tire pressure"*), eliminating the need to hunt through data tables.
* 🔍 **Intelligent Vehicle Inspector:** Granular, live diagnostic dashboard monitoring speed, fuel/battery capacity, tire vitals, and driver duty hours to proactively manage fatigue and safety.
* 🗄️ **Admin & Dispatch Hub:** One-click confirmation for new route assignments, seamless user management, and direct CSV exports of raw fleet telemetry.

---

## ⚙️ System Architecture Flow

```mermaid
graph TD
    A[Vehicle ID Input] --> B(Live Telemetry & Diagnostics API)
    B --> C[FastAPI Backend]
    
    C --> D{Dual Core Processing Engine}
    
    D -->|Google OR-Tools| E[Routing Model & CP-SAT Solver]
    D -->|Machine Learning| F[Traffic & ETA Predictor]
    D -->|Rules Engine| G[Anomaly & Vitals Detection]
    
    E --> H[Optimized Dispatch & Route Matrix]
    F --> I[High-Confidence Arrival Report]
    G --> J[Driver Safety & Hardware Alerts]
    
    H --> K((OptiMarg Command Center))
    I --> K
    J --> K

## 💻 Local Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* PostgreSQL

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/optimarg.git](https://github.com/your-username/optimarg.git)
cd optimarg
```

### 2. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup (React)
```bash
cd ../frontend
npm install
npm start
```

### 4. Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/optimarg_db
ML_API_KEY=your_key_here
PORT=8000
```

---

## 👥 The Team: Null Terminators

Proudly built for **Smart India Hackathon 2026**.

| S.No | Name | Role / Domain | GitHub |
| :---: | :--- | :--- | :--- |
| 1 | **Aditya Kumar Sharma** | Team Lead | [B25BS1019] |
| 2 | **Arsh Zahid Shaikh** | [@username](https://github.com/arshshaikh16) | 
| 3 | **Thalaj Bhati** | [@username](https://github.com/bhatithalaj) |
| 4 | **Samiksha Kaushik** |@username(https://github.com/SamikshaKaushik-developer) | [B24BS2312]
| 5 | **[Teammate 5]** | [@username](https://github.com/) |
| 6 | **[Teammate 6]** | [@username](https://github.com/) |

---

<div align="center">
  <sub>Built with ❤️ by Team Null Terminators | Smart India Hackathon 2026</sub>
</div>
