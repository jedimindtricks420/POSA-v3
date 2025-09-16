from dotenv import load_dotenv
import os

load_dotenv()

print("✅ Telegram Key Bot Started")
print("API ID:", os.getenv("API_ID"))
