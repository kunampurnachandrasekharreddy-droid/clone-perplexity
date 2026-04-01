from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

try:
    print("Testing gemini-2.5-flash...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say 'OK' if you are alive."
    )
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error with gemini-2.5-flash: {e}")

try:
    print("\nTesting gemini-2.0-flash...")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Say 'OK' if you are alive."
    )
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error with gemini-2.0-flash: {e}")
