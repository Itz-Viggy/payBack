from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend dir so GEMINI_API_KEY etc. are in os.environ (works regardless of cwd)
load_dotenv(Path(__file__).resolve().parent / ".env")

# MongoDB Atlas connection setup
URI = os.getenv("MONGODB_URI")
print(URI)
client = MongoClient(URI, server_api=ServerApi('1'))
# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)