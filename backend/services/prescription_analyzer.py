import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Gemini API key not found in backend/.env")

client = genai.Client(api_key=api_key, http_options={"timeout": 25000, "retry_options": {"attempts": 1}})


async def analyze_prescription(image_bytes: bytes, mime_type: str):

    prompt = """
    You are an advanced medical prescription understanding
    and information extraction assistant.

    Carefully examine the ENTIRE uploaded prescription.
    Do not focus only on medicines.

    Extract ALL information actually written by the doctor.

    Return the following sections:

    1. PATIENT AND DOCTOR DETAILS
    - Patient name
    - Doctor name
    - Hospital or clinic
    - Prescription date

    2. SYMPTOMS AND COMPLAINTS
    - Pain
    - Swelling
    - Fever
    - Discomfort
    - Other symptoms explicitly mentioned

    3. DIAGNOSIS AND ASSESSMENT
    - Medical condition or diagnosis written by the doctor
    - Clinical observations, if mentioned

    4. MEDICINES
    For each medicine extract:
    - Name
    - Active ingredient, if identifiable
    - Strength
    - Dosage
    - Route
    - Frequency
    - Duration
    - Uncertain fields

    5. NON-MEDICINE TREATMENT
    Extract instructions such as:
    - Exercises
    - Physiotherapy
    - Ice application
    - Heat application
    - Massage
    - Other treatment procedures

    6. CARE AND PRECAUTIONS
    - Bed rest
    - Activity restrictions
    - Diet instructions
    - Precautions
    - Other lifestyle instructions

    7. FOLLOW-UP
    - Follow-up date
    - Recommended tests
    - Review instructions
    - Other follow-up notes

    IMPORTANT SAFETY RULES:

    - Examine the complete prescription, including handwritten notes.
    - Never guess unclear handwriting.
    - Never invent symptoms, diagnosis, medicines or instructions.
    - Extract only information explicitly written in the prescription.
    - Preserve the original meaning of instructions.
    - If a section contains no information, return an empty array
      or null as appropriate.
    - If no medicine is prescribed, return an empty medicines array.
    - Do not return a fake medicine with name "Not Identified".
    - Mark unreadable or uncertain information clearly.
    - Do not generate new treatment recommendations.
    - Do not recommend changing medicines or treatment.
    - This is information extraction, not medical diagnosis.

    Return ONLY valid JSON in this exact structure:

    {
        "patient_name": null,
        "doctor_name": null,
        "hospital_name": null,
        "prescription_date": null,

        "symptoms": [],

        "diagnosis": [],

        "medicines": [
            {
                "name": "",
                "active_ingredient": null,
                "strength": null,
                "dosage_form": null,
                "dosage": null,
                "route": null,
                "frequency": null,
                "duration": null,
                "uncertain_fields": []
            }
        ],

        "non_medicine_treatment": [
            {
                "type": "",
                "instruction": "",
                "frequency": null,
                "duration": null,
                "uncertain_fields": []
            }
        ],

        "care_instructions": [],

        "precautions": [],

        "follow_up": [],

        "additional_notes": [],

        "uncertain_information": [],

        "requires_human_verification": true
    }
    """

    response = await client.aio.models.generate_content(
        model="gemini-3.5-flash-lite",
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