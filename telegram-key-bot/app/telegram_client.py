from pyrogram import Client
import asyncio
import os
import re

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME", "tg_user_session")
TARGET_BOT = "MicrosoftLeo_Bot"
COMMAND = "/402"

app = Client(SESSION_NAME, api_id=API_ID, api_hash=API_HASH)


def extract_key_from_message(text: str) -> str:
    """
    Ищет лицензионный ключ в формате XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
    """
    match = re.search(r"\b([A-Z0-9]{5}-){4}[A-Z0-9]{5}\b", text)
    return match.group(0) if match else None


async def buy_key():
    await app.start()
    try:
        print(f"💬 Отправляем команду {COMMAND} боту @{TARGET_BOT}...")
        await app.send_message(TARGET_BOT, COMMAND)

        print("⏳ Ждём 15 секунд ответа от бота...")
        await asyncio.sleep(15)

        print(f"🔍 Читаем последние 2 сообщения от @{TARGET_BOT}...")
        async for message in app.get_chat_history(TARGET_BOT, limit=2):
            if message.text and "Purchase Successful" in message.text:
                key = extract_key_from_message(message.text)
                if key:
                    print(f"\n✅ Ключ активации найден:\n{key}")
                    return key
                else:
                    print("⚠️ Сообщение найдено, но ключ не удалось извлечь.")
        print("❌ Сообщение с ключом не найдено.")
        return None
    finally:
        await app.stop()


if __name__ == "__main__":
    asyncio.run(buy_key())
