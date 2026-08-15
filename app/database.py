
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from psycopg2.extras import Json as PsycopgJson

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


try:
    conn = psycopg2.connect(
    DATABASE_URL,
    cursor_factory=RealDictCursor,
    sslmode="require"
)
    cursor = conn.cursor()
    print("Supabase connected successfully")

except Exception as error:
    print("Supabase connection failed:", error)

def createtable():
    try:
        conn.rollback()  # clear any previous failed transaction

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fleet_data (
                assignment_id VARCHAR(20),
                utilization_pct NUMERIC(5,2),
                assignment_confirmed BOOLEAN,
                speed_kmph NUMERIC(6,2),
                telemetry_lat NUMERIC(10,6),
                telemetry_lon NUMERIC(10,6),
                telemetry_recorded_at TIMESTAMPTZ,
                anomaly_type VARCHAR(50),
                anomaly_severity NUMERIC(5,2),
                anomaly_detected_at TIMESTAMPTZ,
                driver_status VARCHAR(30),
                vehicle_id VARCHAR(20) PRIMARY KEY,
                plate_number VARCHAR(20),
                vehicle_capacity_kg NUMERIC(10,2),
                vehicle_current_lat NUMERIC(10,6),
                vehicle_current_lon NUMERIC(10,6),
                waypoints_json JSONB,
                total_distance_km NUMERIC(10,2),
                planned_arrival TIMESTAMPTZ,
                actual_arrival_at TIMESTAMPTZ,
                stop_sequence INTEGER,
                shipment_id VARCHAR(20),
                origin_lat NUMERIC(10,6),
                origin_lon NUMERIC(10,6),
                dest_lat NUMERIC(10,6),
                dest_lon NUMERIC(10,6),
                shipment_weight_kg NUMERIC(10,2),
                shipment_priority VARCHAR(20),
                shipment_deadline TIMESTAMPTZ,
                time_to_deadline_minutes NUMERIC(12,3)
            );
        """)

        conn.commit()
        print("fleet_data table created successfully")

    except Exception as error:
        conn.rollback()
        print("Table creation failed:", error)
        raise


def createpost(info):
    data = info.model_dump()

    data["waypoints_json"] = PsycopgJson(data["waypoints_json"])

    cursor.execute("""
        INSERT INTO fleet_data (
            assignment_id,
            utilization_pct,
            assignment_confirmed,
            speed_kmph,
            telemetry_lat,
            telemetry_lon,
            telemetry_recorded_at,
            anomaly_type,
            anomaly_severity,
            anomaly_detected_at,
            driver_status,
            vehicle_id,
            plate_number,
            vehicle_capacity_kg,
            vehicle_current_lat,
            vehicle_current_lon,
            waypoints_json,
            total_distance_km,
            planned_arrival,
            actual_arrival_at,
            stop_sequence,
            shipment_id,
            origin_lat,
            origin_lon,
            dest_lat,
            dest_lon,
            shipment_weight_kg,
            shipment_priority,
            shipment_deadline,
            time_to_deadline_minutes
        )
        VALUES (
            %(assignment_id)s,
            %(utilization_pct)s,
            %(assignment_confirmed)s,
            %(speed_kmph)s,
            %(telemetry_lat)s,
            %(telemetry_lon)s,
            %(telemetry_recorded_at)s,
            %(anomaly_type)s,
            %(anomaly_severity)s,
            %(anomaly_detected_at)s,
            %(driver_status)s,
            %(vehicle_id)s,
            %(plate_number)s,
            %(vehicle_capacity_kg)s,
            %(vehicle_current_lat)s,
            %(vehicle_current_lon)s,
            %(waypoints_json)s,
            %(total_distance_km)s,
            %(planned_arrival)s,
            %(actual_arrival_at)s,
            %(stop_sequence)s,
            %(shipment_id)s,
            %(origin_lat)s,
            %(origin_lon)s,
            %(dest_lat)s,
            %(dest_lon)s,
            %(shipment_weight_kg)s,
            %(shipment_priority)s,
            %(shipment_deadline)s,
            %(time_to_deadline_minutes)s
        )
        RETURNING *;
    """, data)

    result = cursor.fetchone()
    conn.commit()

    return result

def get_info(vehicle_id):
    cursor.execute("""
        SELECT *
        FROM fleet_data
        WHERE vehicle_id = %s;
    """, (vehicle_id,))

    return cursor.fetchall()

def create_users():
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        """)

        conn.commit()
        print("users table created successfully")

    except Exception as error:
        conn.rollback()
        print("Users table creation failed:", error)
        raise