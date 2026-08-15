import csv
import io
import os
import psycopg2 # Or your preferred driver (e.g., sqlite3)
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import Response
import os
import psycopg2
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter()
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
# Database connection dependency (using raw psycopg2 connection)
def dataset():
    # Connects to Supabase via DATABASE_URL instead of localhost
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

DROP_VIEW_SQL='''DROP VIEW public.v_fleet_live_status CASCADE;'''


CREATE_VIEW_SQL = """
CREATE OR REPLACE VIEW public.v_fleet_live_status AS

WITH live_data AS (

    SELECT
        f.assignment_id,
        f.shipment_id,
        f.vehicle_id,
        f.plate_number,
        f.driver_status,
        f.assignment_confirmed,
        f.speed_kmph,

        f.telemetry_recorded_at,

        f.anomaly_type,
        f.anomaly_severity,
        f.anomaly_detected_at,

        f.vehicle_capacity_kg,
        f.shipment_weight_kg,

        f.planned_arrival,
        f.actual_arrival_at,
        f.shipment_deadline,

        f.total_distance_km,
        f.stop_sequence,
        f.origin_lat,
        f.origin_lon,
        f.dest_lat,
        f.dest_lon,

        f.waypoints_json,
        f.shipment_priority,

        -- Total journey duration in seconds
        EXTRACT(
            EPOCH FROM (
                f.planned_arrival - f.telemetry_recorded_at
            )
        ) AS total_duration_seconds,

        -- Time elapsed since telemetry started
        EXTRACT(
            EPOCH FROM (
                NOW() - f.telemetry_recorded_at
            )
        ) AS elapsed_seconds

    FROM public.fleet_data f
)

SELECT

    assignment_id,
    shipment_id,
    vehicle_id,
    plate_number,
    driver_status,
    assignment_confirmed,

    speed_kmph,

    -- =====================================================
    -- DYNAMIC TELEMETRY LOCATION
    -- =====================================================

    (
    ROUND(
        (
            origin_lat
            + (
                (dest_lat - origin_lat)
                *
                LEAST(
                    1,
                    GREATEST(
                        0,
                        elapsed_seconds
                        / NULLIF(total_duration_seconds, 0)
                    )
                )
            )
        )::numeric,
        6
    )
)::numeric(10,6) AS telemetry_lat,

    (
    ROUND(
        (
            origin_lon
            + (
                (dest_lon - origin_lon)
                *
                LEAST(
                    1,
                    GREATEST(
                        0,
                        elapsed_seconds
                        / NULLIF(total_duration_seconds, 0)
                    )
                )
            )
        )::numeric,
        6
    )
)::numeric(10,6) AS telemetry_lon,

    NOW() AS telemetry_recorded_at,

    anomaly_type,
    anomaly_severity,
    anomaly_detected_at,

    vehicle_capacity_kg,
    shipment_weight_kg,

    -- =====================================================
    -- UTILIZATION
    -- =====================================================

    ROUND(
        (
            shipment_weight_kg
            / NULLIF(vehicle_capacity_kg, 0)
        ) * 100,
        2
    ) AS utilization_pct,

    -- =====================================================
    -- OVERWEIGHT
    -- =====================================================

    CASE

        WHEN shipment_weight_kg > vehicle_capacity_kg
        THEN TRUE

        ELSE FALSE

    END AS is_overweight_alert,

    planned_arrival,
    actual_arrival_at,
    shipment_deadline,

    -- =====================================================
    -- LIVE TIME
    -- =====================================================

    ROUND(
        EXTRACT(
            EPOCH FROM (
                shipment_deadline - NOW()
            )
        ) / 60,
        2
    ) AS time_to_deadline_minutes,

    -- =====================================================
    -- DELIVERY STATUS
    -- =====================================================

    CASE

        WHEN actual_arrival_at IS NOT NULL
             AND actual_arrival_at > planned_arrival
        THEN 'DELAYED'

        WHEN actual_arrival_at IS NOT NULL
             AND actual_arrival_at <= planned_arrival
        THEN 'ON_TIME'

        WHEN NOW() > planned_arrival
             AND actual_arrival_at IS NULL
        THEN 'RUNNING_LATE'

        ELSE 'IN_TRANSIT'

    END AS delivery_status,

    total_distance_km,
    stop_sequence,

    -- =====================================================
    -- DYNAMIC VEHICLE POSITION
    -- =====================================================

    (
    origin_lat
    + (
        (dest_lat - origin_lat)
        *
        LEAST(
            1,
            GREATEST(
                0,
                elapsed_seconds
                / NULLIF(total_duration_seconds, 0)
            )
        )
    )
)::numeric(10,6) AS vehicle_current_lat,

    (
    origin_lon
    + (
        (dest_lon - origin_lon)
        *
        LEAST(
            1,
            GREATEST(
                0,
                elapsed_seconds
                / NULLIF(total_duration_seconds, 0)
            )
        )
    )
)::numeric(10,6) AS vehicle_current_lon,

    origin_lat,
    origin_lon,
    dest_lat,
    dest_lon,
    waypoints_json,
    shipment_priority

FROM live_data;
"""

SELECT_VIEW_SQL = "SELECT * FROM public.v_fleet_live_status;"


@router.get("/fleet/export-csv", summary="Export Fleet Live Status as CSV")
def export_fleet_live_status_csv(conn = Depends(dataset)):
    """Creates/refreshes the view and streams out the records as a CSV download."""
    try:
        with conn.cursor() as cursor:
            # 1. Execute DDL to ensure view is updated
            # cursor.execute(DROP_VIEW_SQL)
            # conn.commit()
            cursor.execute(CREATE_VIEW_SQL)
            conn.commit()

            # 2. Query the view
            cursor.execute(SELECT_VIEW_SQL)

            # Extract column headers directly from cursor metadata
            headers = [desc[0] for desc in cursor.description]

            # Fetch all record rows
            rows = cursor.fetchall()

        # 3. Build CSV string in memory
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)

        writer.writerow(headers)
        writer.writerows(rows)

        csv_output = csv_buffer.getvalue()

        csv_output = csv_buffer.getvalue()

# 4. SAVE CSV INSIDE THE SAME FOLDER AS dataset_for_ml.py
        file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "fleet_live_status.csv"
        )

        with open(
            file_path,
            "w",
            newline="",
            encoding="utf-8"
        ) as file:
            file.write(csv_output)

# 5. Return CSV to browser/Swagger as well
        return Response(
            content=csv_output,
            media_type="text/csv",
            headers={
                "Content-Disposition":
                "attachment; filename=fleet_live_status.csv"
            }
        )

    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate CSV export: {str(e)}"
        )