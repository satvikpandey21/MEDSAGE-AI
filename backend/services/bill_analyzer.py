
import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Gemini API key not found")

client = genai.Client(api_key=api_key, http_options={"timeout":25000,"retry_options":{"attempts":1}})


async def analyze_pharmacy_bill(image_bytes: bytes, mime_type: str):

    prompt = """
    You are a pharmacy bill information extraction assistant.

    Extract the following information from the uploaded pharmacy bill:

    1. Pharmacy name
    2. Bill number
    3. Bill date
    4. Total amount
    5. For each medicine:
       - Medicine name
       - Strength
       - Dosage form
       - Quantity
       - Unit price
       - Total price

    SAFETY RULES:
    - Never guess unreadable information.
    - Use null for missing or unclear values.
    - Do not declare medicines equivalent or interchangeable.
    - Do not provide medical advice.
    - Flag uncertain information for human verification.

    Return ONLY valid JSON in this format:

    {
        "pharmacy_name": null,
        "bill_number": null,
        "bill_date": null,
        "total_amount": null,
        "medicines": [
            {
                "name": null,
                "strength": null,
                "dosage_form": null,
                "quantity": null,
                "unit_price": null,
                "total_price": null,
                "uncertain_fields": []
            }
        ],
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
