from fastapi import FastAPI, status, HTTPException

from app.database import createtable, createpost, get_info, create_users
from app.pydantic_schemas import CreatePost, CreateInput, ETARequest
from app.users.users import router as user_router
from app.dataset_for_ml import router as fleet_router
import io
import sys
from eta.tracker import predict_by_vehicle_number

app = FastAPI()

app.include_router(user_router)
app.include_router(fleet_router)




@app.get("/")
def root():
    return {"message": "Welcome to my API"}


@app.post("/create/table", status_code=status.HTTP_201_CREATED)
def create():
    createtable()
    return {"message": "Created table"}


@app.post("/create/entry", status_code=status.HTTP_201_CREATED)
def create_entry(info: CreateInput):

    existing = get_info(info.vehicle_id)

    if existing:
        raise HTTPException(
            status_code=status.HTTP_208_ALREADY_REPORTED,
            detail="Vehicle already exists"
        )

    data = CreatePost(
    assignment_id=info.assignment_id,
    assignment_confirmed=info.assignment_confirmed,
    origin_location=info.origin_location,
    destination_location=info.destination_location,

    vehicle_id=info.vehicle_id
)

    return createpost(data)
    
    


@app.get("/info/{vehicle_id}")
def get_vehicle(vehicle_id: str):
    data= get_info(vehicle_id)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return data

@app.post("/create/users")
def create_user_table():
    create_users()
    return {"message": "Users table created"}



@app.post("/eta/output", status_code=status.HTTP_200_OK)
def run_vehicle_eta(payload : ETARequest):
    vehicle_id = payload.vehicle_id
    buffer = io.StringIO()
    sys.stdout = buffer

    try:
        predict_by_vehicle_number(vehicle_id)
    finally:
        sys.stdout = sys.__stdout__

    report_content = buffer.getvalue()

    if "No records found" in report_content or not report_content.strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{vehicle_id}' not found in live status records.",
        )

    output_file_path = "output.txt"
    with open(output_file_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    return {
        "status": "success",
        "message": f"Report successfully generated and saved to {output_file_path}",
        "vehicle_id": vehicle_id,
        "report": report_content.strip(),
    }