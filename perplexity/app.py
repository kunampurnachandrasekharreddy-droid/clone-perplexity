import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from dotenv import load_dotenv
from pypdf import PdfReader
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration for uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize the Google GenAI client
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

def extract_text_from_pdf(pdf_path):
    """Simple RAG tool to reach into PDF content."""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        # Handle multipart/form-data for file uploads
        prompt = request.form.get('prompt')
        file = request.files.get('file')
        
        context = ""
        if file and file.filename.endswith('.pdf'):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            print(f"DEBUG: Processing PDF: {filename}")
            # Extract text from the PDF
            context = extract_text_from_pdf(filepath)
            
            # Truncate context to a safe limit (e.g., 50,000 characters) 
            # to avoid excessively large requests while still being very helpful
            if len(context) > 50000:
                print(f"DEBUG: Truncating PDF text from {len(context)} to 50000 chars")
                context = context[:50000] + "... [Text Truncated for Length]"
            
            # Cleanup
            os.remove(filepath)

        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400

        # Construct final prompt
        final_prompt = prompt
        if context:
            final_prompt = (
                f"You are a helpful AI assistant. Below is the content of an uploaded PDF file.\n"
                f"--- DOCUMENT START ---\n{context}\n--- DOCUMENT END ---\n\n"
                f"User Question: {prompt}\n\nPlease answer accurately using the provided document content."
            )

        print(f"DEBUG: Sending request to Gemini for prompt: {prompt[:50]}...")
        
        # Call Gemini with the requested 2.5 model
        try:
            print("DEBUG: Attempting gemini-2.5-flash...")
            response = client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=final_prompt,
            )
            print("DEBUG: Received response from gemini-2.5-flash")
            return jsonify({
                "response": response.text,
                "status": "success",
                "has_context": bool(context)
            })
        except Exception as api_err:
            print(f"DEBUG: gemini-2.5-flash failed or not found: {api_err}")
            # Fallback to 2.0 Flash (as 1.5 is often retired in current SDK environments)
            print("DEBUG: Retrying with gemini-2.0-flash...")
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=final_prompt,
                )
                return jsonify({
                    "response": response.text,
                    "status": "success",
                    "has_context": bool(context)
                })
            except Exception as e2:
                print(f"DEBUG: gemini-2.0-flash also failed: {e2}")
                return jsonify({
                    "error": "All available models (2.5, 2.0) failed. Please check your API key permissions.",
                    "details": str(e2),
                    "status": "error"
                }), 500

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR: {error_details}")
        return jsonify({
            "error": str(e),
            "status": "error",
            "details": "Check server logs for full traceback"
        }), 500

if __name__ == '__main__':
    # Running on 5000 by default
    app.run(host='0.0.0.0', port=5000, debug=True)
