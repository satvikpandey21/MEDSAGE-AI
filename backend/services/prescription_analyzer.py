import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Gemini API key not found in backend/.env")

client = genai.Client(api_key=api_key)


async def analyze_prescription(image_bytes: bytes, mime_type: str):

    prompt = """
    You are a medical prescription information extraction assistant.

    Carefully examine the uploaded prescription.

    Extract the following information:
    1. Patient name (if visible)
    2. Doctor name (if visible)
    3. Prescription date (if visible)
    4. Medicine name
    5. Active ingredient (if identifiable)
    6. Strength
    7. Dosage instructions
    8. Route of administration
    9. Frequency
    10. Duration

    IMPORTANT SAFETY RULES:
    - Never guess unclear handwriting.
    - Never invent medicine names or doses.
    - Mark unreadable information as uncertain.
    - Preserve the original instructions.
    - Do not provide diagnosis or treatment advice.
    - Do not recommend changing any medicine.

    Return ONLY valid JSON in this format:

    {
        "patient_name": null,
        "doctor_name": null,
        "prescription_date": null,
        "medicines": [
            {
                "name": "",
                "active_ingredient": null,
                "strength": null,
                "dosage": null,
                "route": null,
                "frequency": null,
                "duration": null,
                "uncertain_fields": []
            }
        ],
        "additional_notes": [],
        "requires_human_verification": true
    }
    """

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=[
            prompt,
            genai.types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        ],
        config={
            "response_mime_type": "application/json"
        }
    )

    return json.loads(response.text)