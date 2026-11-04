import os
from dotenv import load_dotenv
from google import genai

# Load API key from .env
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: Gemini API key not found!")
else:
    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents="Say Hello to MedSage AI in one sentence."
        )

        print("\nGemini Connection Successful!")
        print(response.text)

    except Exception as e:
        print("\nGemini Connection Failed!")
        print("Error:", str(e))