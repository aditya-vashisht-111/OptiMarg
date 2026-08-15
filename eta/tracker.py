import os
import joblib
import pandas as pd
from geopy.distance import geodesic
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

rf = joblib.load(os.path.join(BASE_DIR, "eta_model.pkl"))
encoders = joblib.load(os.path.join(BASE_DIR, "encoders.pkl"))
feature_columns = joblib.load(os.path.join(BASE_DIR, "feature_columns.pkl"))

df_raw = pd.read_csv(os.path.join(BASE_DIR, "fleet_live_status.csv"))


def predict_eta(
    telemetry_lat, telemetry_lon, dest_lat, dest_lon, origin_lat, origin_lon,
    speed_kmph, stop_sequence, total_stops, total_distance_km,
    shipment_weight_kg, shipment_priority, vehicle_capacity_kg, utilization_pct,
    driver_status, anomaly_type, anomaly_severity, anomaly_detected_at,
    telemetry_recorded_at, shipment_deadline, assignment_confirmed,
    planned_arrival
):
    # ---- Derived features (same logic as training) ----
    distance_remaining_km = geodesic((telemetry_lat, telemetry_lon), (dest_lat, dest_lon)).km
    time_of_day_hr = telemetry_recorded_at.hour + telemetry_recorded_at.minute / 60
    day_of_week = telemetry_recorded_at.weekday()
    stops_remaining = total_stops - stop_sequence

    if anomaly_detected_at is not None:
        anomaly_recency_minutes = (telemetry_recorded_at - anomaly_detected_at).total_seconds() / 60
    else:
        anomaly_recency_minutes = -1
        anomaly_type = "None"
        anomaly_severity = 0

    time_to_deadline_minutes = max(0, (shipment_deadline - telemetry_recorded_at).total_seconds() / 60)

    # ---- Build a single-row dataframe matching training structure ----
    row = pd.DataFrame([{
        "utilization_pct": utilization_pct,
        "assignment_confirmed": assignment_confirmed,
        "speed_kmph": speed_kmph,
        "telemetry_lat": telemetry_lat,
        "telemetry_lon": telemetry_lon,
        "anomaly_type": anomaly_type,
        "anomaly_severity": anomaly_severity,
        "driver_status": driver_status,
        "vehicle_capacity_kg": vehicle_capacity_kg,
        "total_distance_km": total_distance_km,
        "stop_sequence": stop_sequence,
        "origin_lat": origin_lat,
        "origin_lon": origin_lon,
        "dest_lat": dest_lat,
        "dest_lon": dest_lon,
        "shipment_weight_kg": shipment_weight_kg,
        "shipment_priority": shipment_priority,
        "distance_remaining_km": distance_remaining_km,
        "time_of_day_hr": time_of_day_hr,
        "day_of_week": day_of_week,
        "stops_remaining": stops_remaining,
        "anomaly_recency_minutes": anomaly_recency_minutes,
        "time_to_deadline_minutes": time_to_deadline_minutes,
    }])

    # ---- Encode categoricals using the SAME encoders from training ----
    for col in ["anomaly_type", "driver_status", "shipment_priority"]:
        le = encoders[col]
        row[col] = le.transform(row[col])

    row["assignment_confirmed"] = row["assignment_confirmed"].astype(bool)

    # ---- Ensure column order matches training exactly ----
    row = row[feature_columns]

    # ---- Predict ----
    predicted_minutes = rf.predict(row)[0]
    predicted_arrival = telemetry_recorded_at + pd.Timedelta(minutes=predicted_minutes)

    # ---- Classify EARLY / ON_TIME / DELAYED ----
    delta_minutes = (predicted_arrival - planned_arrival).total_seconds() / 60
    TOLERANCE = 10
    if delta_minutes < -TOLERANCE:
        status = "EARLY"
    elif delta_minutes > TOLERANCE:
        status = "DELAYED"
    else:
        status = "ON_TIME"

    return {
        "predicted_remaining_minutes": round(predicted_minutes, 1),
        "predicted_arrival": predicted_arrival,
        "delta_minutes": round(delta_minutes, 1),
        "status": status,
    }


import pandas as pd

def predict_by_vehicle_number(vehicle_identifier):
    # 1. Load the features database/dataset
    df_raw = pd.read_csv("eta/fleet_live_status.csv")    # 2. Filter by Vehicle ID or Plate Number
    vehicle_data = df_raw[
    (df_raw["plate_number"].str.upper() == vehicle_identifier.upper()) |
    (df_raw["vehicle_id"].str.upper() == vehicle_identifier.upper())
    ].copy()
    vehicle_data.loc[:, "telemetry_recorded_at"] = pd.to_datetime(vehicle_data["telemetry_recorded_at"])
    
    if vehicle_data.empty:
        print(f"❌ No records found for vehicle: {vehicle_identifier}")
        return

    # 3. Get the latest telemetry record for this vehicle
    vehicle_data["telemetry_recorded_at"] = pd.to_datetime(vehicle_data["telemetry_recorded_at"])
    latest_record = vehicle_data.sort_values("telemetry_recorded_at").iloc[-1]

    # 4. Extract parameters automatically
    telemetry_recorded_at = latest_record["telemetry_recorded_at"]
    
    # Format anomaly times/details if available
    anomaly_detected_at = pd.to_datetime(latest_record["anomaly_detected_at"]) if pd.notna(latest_record["anomaly_detected_at"]) else None
    anomaly_type = latest_record["anomaly_type"] if pd.notna(latest_record["anomaly_type"]) else None
    anomaly_severity = latest_record["anomaly_severity"] if pd.notna(latest_record["anomaly_severity"]) else None

    # Calculate deadlines based on stored timestamps
    shipment_deadline = pd.to_datetime(latest_record["shipment_deadline"])
    planned_arrival = pd.to_datetime(latest_record["planned_arrival"])

    # Total stops calculation for active shipment
    shipment_rows = df_raw[df_raw["shipment_id"] == latest_record["shipment_id"]]
    total_stops = shipment_rows["stop_sequence"].max()

    # 5. Run Prediction using auto-filled parameters
    result = predict_eta(
        telemetry_lat=latest_record["telemetry_lat"],
        telemetry_lon=latest_record["telemetry_lon"],
        dest_lat=latest_record["dest_lat"],
        dest_lon=latest_record["dest_lon"],
        origin_lat=latest_record["origin_lat"],
        origin_lon=latest_record["origin_lon"],
        speed_kmph=latest_record["speed_kmph"],
        stop_sequence=int(latest_record["stop_sequence"]),
        total_stops=int(total_stops),
        total_distance_km=latest_record["total_distance_km"],
        shipment_weight_kg=latest_record["shipment_weight_kg"],
        shipment_priority=latest_record["shipment_priority"],
        vehicle_capacity_kg=latest_record["vehicle_capacity_kg"],
        utilization_pct=latest_record["utilization_pct"],
        driver_status=latest_record["driver_status"],
        anomaly_type=anomaly_type,
        anomaly_severity=anomaly_severity,
        anomaly_detected_at=anomaly_detected_at,
        telemetry_recorded_at=telemetry_recorded_at,
        shipment_deadline=shipment_deadline,
        assignment_confirmed=(latest_record["assignment_confirmed"] == 't'),
        planned_arrival=planned_arrival
    )

    # 6. Display Clean Summary
    print(f"\n================ VEHICLE ETA REPORT ================")
    print(f" Vehicle Plate    : {latest_record['plate_number']} ({latest_record['vehicle_id']})")
    print(f" Shipment ID      : {latest_record['shipment_id']}")
    print(f" Current Location : ({latest_record['telemetry_lat']:.4f}, {latest_record['telemetry_lon']:.4f})")
    print(f" Current Speed    : {latest_record['speed_kmph']} km/h")
    print(f"----------------------------------------------------")
    print(f" Estimated Time   : {result['predicted_remaining_minutes']} minutes (~{round(result['predicted_remaining_minutes']/60, 1)} hrs)")
    print(f" Predicted Arrival: {result['predicted_arrival']}")
    print(f" Delivery Status  : {result['status']} (Delta: {result['delta_minutes']} min)")
    print(f"====================================================\n")

# --- Interactive Call ---
if __name__ == "__main__":
    v_num = input("Enter Vehicle ID or Plate Number (e.g. RJ77A5713 or VEH_001): ")
    predict_by_vehicle_number(v_num)