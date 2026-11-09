from request_limits import JsonBodyLimit
from config import cors_origins
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.bill_pipeline import router as bill_router
from services.medicine_assistant import router as medicine_assistant_router
from services.medicine_assistant import log_configuration_presence
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app):
    log_configuration_presence()
    yield

app = FastAPI(
    title="MedSage AI Backend",
    description="Intelligent Medication Management Platform",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(medicine_assistant_router)

app.add_middleware(JsonBodyLimit)

# Allow React frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to MedSage AI Backend!",
        "status": "Running successfully"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "project": "MedSage AI"
    }
from services.prescription_pipeline import router as prescription_router
app.include_router(prescription_router)


app.include_router(bill_router)
