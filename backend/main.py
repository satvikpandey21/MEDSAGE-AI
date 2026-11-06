from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.bill_analyzer import analyze_pharmacy_bill

app = FastAPI(
    title="MedSage AI Backend",
    description="Intelligent Medication Management Platform",
    version="1.0.0"
)

# Allow React frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
         "http://localhost:5174",
    "http://127.0.0.1:5174"
    ],
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
from services.prescription_analyzer import analyze_prescription


@app.post("/analyze-prescription")
async def analyze_prescription_endpoint(
    file: UploadFile = File(...)
):
    allowed_types = [
        "image/jpeg",
        "image/png",
        "application/pdf"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and PDF files are allowed."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size must be below 10 MB."
        )

    try:
        result = await analyze_prescription(
            file_bytes,
            file.content_type
        )

        return {
            "status": "success",
            "message": "Prescription analyzed successfully.",
            "requires_human_verification": True,
            "data": result
        }

    except Exception as error:
        print("PRESCRIPTION ANALYSIS ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Prescription analysis failed. Please try again."
        )
@app.post("/analyze-bill")
async def analyze_bill_endpoint(
    file: UploadFile = File(...)
):
    allowed_types = [
        "image/jpeg",
        "image/png",
        "application/pdf"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and PDF files are allowed."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size must be below 10 MB."
        )

    try:
        result = await analyze_pharmacy_bill(
            file_bytes,
            file.content_type
        )

        return {
            "status": "success",
            "message": "Pharmacy bill analyzed successfully.",
            "requires_human_verification": True,
            "data": result
        }

    except Exception as error:
        print("PHARMACY BILL ANALYSIS ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Bill analysis failed. Please try again."
        )