# 🚚 FleetPulse

**FleetPulse** is a FastAPI-based fleet management backend that connects fleet data, live vehicle tracking, and ML-powered ETA prediction.

## ✨ Features

* 🚛 Vehicle and shipment management
* 🆔 Vehicle-ID-based data retrieval
* 📍 Live vehicle position calculation
* 📊 Fleet utilization monitoring
* ⚠️ Anomaly and overweight detection
* 🚦 Dynamic delivery status
* 📄 Live fleet data CSV export
* 🤖 Vehicle-specific ETA prediction
* 👤 User registration with bcrypt password hashing
* 🗄️ PostgreSQL / Supabase integration
* 📚 Interactive Swagger API documentation

## 🛠️ Tech Stack

* **Python**
* **FastAPI**
* **Pydantic**
* **PostgreSQL**
* **Supabase**
* **psycopg2**
* **bcrypt**
* **Pandas / ML pipeline**

## 🔄 How It Works

```text
Vehicle ID
    ↓
FastAPI Backend
    ↓
Supabase / PostgreSQL
    ↓
Live Fleet Data
    ↓
ETA / ML Pipeline
    ↓
Prediction Report
```

The main ETA workflow accepts only the **Vehicle ID** and passes it to the prediction pipeline.

## 🔌 API Endpoints

| Method | Endpoint             | Purpose                         |
| ------ | -------------------- | ------------------------------- |
| `GET`  | `/`                  | API health/welcome              |
| `POST` | `/create/table`      | Create fleet table              |
| `POST` | `/create/entry`      | Add a vehicle                   |
| `GET`  | `/info/{vehicle_id}` | Get vehicle information         |
| `POST` | `/create/users`      | Create users table              |
| `POST` | `/users/register`    | Register a user                 |
| `GET`  | `/fleet/export-csv`  | Export live fleet data          |
| `POST` | `/eta/output`        | Generate vehicle ETA prediction |

The API prevents duplicate vehicle IDs and returns an appropriate error when a vehicle is not found.

## 🤖 ETA Prediction

The core workflow is:

```text
User enters Vehicle ID
        ↓
POST /eta/output
        ↓
Vehicle data lookup
        ↓
ML / ETA prediction
        ↓
Prediction report
```

Example request:

```json
{
  "vehicle_id": "VEH_001"
}
```

## 📄 Live Fleet Data

FleetPulse generates a live fleet-status view and can export the current results as:

```text
fleet_live_status.csv
```

The export endpoint creates the live view, retrieves the records, generates the CSV, saves it locally, and returns it to the client.

## 🔐 Configuration

Create a `.env` file:

```env
DATABASE_URL=your_supabase_database_url
```

The backend uses this variable to connect to Supabase/PostgreSQL.

**Never commit `.env` or database credentials to GitHub.**

## ▶️ Run Locally

```bash
git clone <your-repository-url>
cd FleetPulse

python -m venv env
env\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

API:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

## ☁️ Deployment

For production deployment, configure:

```text
DATABASE_URL
```

and use:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## 📌 Project Goal

FleetPulse simplifies fleet monitoring and ETA prediction by allowing the system to identify a vehicle through its **Vehicle ID** and handle the underlying fleet-data and ML workflow automatically.

---

**FleetPulse — Track. Analyze. Predict. 🚚**
