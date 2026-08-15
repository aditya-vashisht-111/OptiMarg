from fastapi import APIRouter, HTTPException, status
from app.users.schemas import UserCreate
from dotenv import load_dotenv
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate):

    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor
    )

    cursor = conn.cursor()

    try:
        # Check whether user already exists
        cursor.execute(
            "SELECT id FROM users WHERE email = %s",
            (user.email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already exists"
            )

        # Hash password
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        # Create user
        cursor.execute(
            """
            INSERT INTO users (email, password)
            VALUES (%s, %s)
            RETURNING id, email, created_at;
            """,
            (user.email, hashed_password)
        )

        new_user = cursor.fetchone()

        conn.commit()

        return {
            "message": "User created successfully",
            "user": new_user
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as error:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        cursor.close()
        conn.close()