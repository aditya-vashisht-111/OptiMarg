from pydantic import BaseModel, Field, model_validator
import random
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from enum import Enum

class CreateInput(BaseModel):
    vehicle_id: str = Field(
        ...,
        pattern=r"^VEH_\d{3}$",
        examples=["VEH_001"]
    )
    assignment_id: str = Field(
        ...,
        min_length=1,
        max_length=20,
        examples=["ASN_1234"]
    )

    assignment_confirmed: bool

    origin_location: Location

    destination_location: Location
class Location(str, Enum):
    DELHI = "Delhi"
    MUMBAI = "Mumbai"
    BENGALURU = "Bengaluru"
    CHENNAI = "Chennai"
    KOLKATA = "Kolkata"


LOCATION_COORDINATES: Dict[Location, Dict[str, float]] = {
    Location.DELHI: {"lat": 28.6139, "lon": 77.2090},
    Location.MUMBAI: {"lat": 19.0760, "lon": 72.8777},
    Location.BENGALURU: {"lat": 12.9716, "lon": 77.5946},
    Location.CHENNAI: {"lat": 13.0827, "lon": 80.2707},
    Location.KOLKATA: {"lat": 22.5726, "lon": 88.3639},
}


class UserCreatePostInput(BaseModel):
    vehicle_id: str = Field(
        ...,
        pattern=r"^VEH_\d{3}$",
        description="Vehicle identifier (e.g. VEH_001)",
        examples=["VEH_001"]
    )
    assignment_id: str = Field(
        ...,
        description="User-entered Assignment ID",
        examples=["ASN_1234"]
    )
    assignment_confirmed: bool = Field(
        ...,
        description="Whether the assignment is confirmed (Dropdown/Toggle)"
    )
    origin_location: Location = Field(
        ...,
        description="Select origin from the 5 available locations"
    )
    destination_location: Location = Field(
        ...,
        description="Select destination from the 5 available locations"
    )



class CreatePost(BaseModel):

    origin_lat: float = Field(default_factory=lambda: round(random.uniform(8.0, 37.0), 5), ge=8.0, le=37.0)
    origin_lon: float = Field(default_factory=lambda: round(random.uniform(68.0, 97.0), 5), ge=68.0, le=97.0)
    dest_lat: float = Field(default_factory=lambda: round(random.uniform(8.0, 37.0), 5), ge=8.0, le=37.0)
    dest_lon: float = Field(default_factory=lambda: round(random.uniform(68.0, 97.0), 5), ge=68.0, le=97.0)

    assignment_id: str
    assignment_confirmed: bool
    origin_location: Location
    destination_location: Location

    vehicle_id: str = Field(..., pattern=r"^VEH_\d{3}$", examples=["VEH_001"])

    utilization_pct: float = Field(default_factory=lambda: round(random.uniform(0, 100), 2), ge=0, le=100)
    speed_kmph: float = Field(default_factory=lambda: round(random.uniform(20, 90), 2), ge=20, le=90)
    telemetry_lat: float = Field(default_factory=lambda: round(random.uniform(8.0, 37.0), 5), ge=8.0, le=37.0)
    telemetry_lon: float = Field(default_factory=lambda: round(random.uniform(68.0, 97.0), 5), ge=68.0, le=97.0)
    telemetry_recorded_at: datetime = Field(default_factory=datetime.now)

    anomaly_type: Optional[str] = Field(default_factory=lambda: random.choice(["ROUTE_DEVIATION", "LOW_SPEED", None]))
    anomaly_severity: Optional[float] = None

    anomaly_detected_at: Optional[datetime] = None
    driver_status: str = Field(default_factory=lambda: random.choice(["ON_DUTY", "AVAILABLE"]))

    plate_number: str = Field(default_factory=lambda: random.choice(["RJ77A5713", "GJ23F8773", "MH42H2359"]))
    vehicle_capacity_kg: float = Field(default_factory=lambda: random.choice([3500, 5000, 7500, 10000]))
    vehicle_current_lat: float = Field(default_factory=lambda: round(random.uniform(8.0, 37.0), 5), ge=8.0, le=37.0)
    vehicle_current_lon: float = Field(default_factory=lambda: round(random.uniform(68.0, 97.0), 5), ge=68.0, le=97.0)

    waypoints_json: List[Dict[str, float]] = Field(default_factory=lambda: [{"lat": round(random.uniform(8.0, 37.0), 5), "lon": round(random.uniform(68.0, 97.0), 5)} for _ in range(random.randint(2, 5))])

    total_distance_km: float = Field(default_factory=lambda: round(random.uniform(50, 2500), 2), ge=0)
    planned_arrival: datetime = Field(default_factory=lambda: datetime.now() + timedelta(hours=random.randint(4, 48)))
    actual_arrival_at: Optional[datetime] = None
    stop_sequence: int = Field(default_factory=lambda: random.randint(1, 10), ge=1)

    shipment_id: str = Field(default_factory=lambda: f"SHIP_{random.randint(1000, 9999)}")
    
    shipment_weight_kg: float = Field(default_factory=lambda: round(random.uniform(500, 9000), 2), ge=0)
    shipment_priority: str = Field(default_factory=lambda: random.choice(["LOW", "MEDIUM", "HIGH"]))
    shipment_deadline: datetime = Field(default_factory=lambda: datetime.now() + timedelta(days=random.randint(1, 7)))
    time_to_deadline_minutes: float = 0

    @model_validator(mode="after")
    def sync_anomaly(self):
        orig_coords = LOCATION_COORDINATES[self.origin_location]
        self.origin_lat = orig_coords["lat"]
        self.origin_lon = orig_coords["lon"]

        dest_coords = LOCATION_COORDINATES[self.destination_location]
        self.dest_lat = dest_coords["lat"]
        self.dest_lon = dest_coords["lon"]

        if self.anomaly_type == "ROUTE_DEVIATION":
            self.anomaly_severity = 0.72
            self.anomaly_detected_at = self.telemetry_recorded_at
    
        elif self.anomaly_type == "LOW_SPEED":
            self.anomaly_severity = 0.34
            self.anomaly_detected_at = self.telemetry_recorded_at
    
        else:
            self.anomaly_severity = None
            self.anomaly_detected_at = None


        self.actual_arrival_at = self.planned_arrival + timedelta(
            minutes=random.randint(5, 120)
        )

        self.time_to_deadline_minutes = max(
            0,
            round(
                (self.shipment_deadline - datetime.now()).total_seconds() / 60,
                3
            )
        )

        return self


class ETARequest(BaseModel):
    vehicle_id: str