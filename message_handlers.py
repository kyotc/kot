import os

from telegram import Update
from telegram.ext import ContextTypes

from access_service import require_access
from bot_config import PASSWORD, ROOT_FOLDER
from bot_state import ACCESS_GRANTED, PENDING_PASSWORD, USER_DIR, WAITING_UPLOAD
from fs_service import safe_path


async def password_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    entered = update.message.text.strip()
    if PENDING_PASSWORD.get(chat_id):
        if entered == PASSWORD:
            USER_DIR[chat_id] = PENDING_PASSWORD[chat_id]
            PENDING_PASSWORD[chat_id] = None
            await update.message.reply_text("Пароль верный. Доступ к папке открыт.")
            await update.message.reply_text(f"Перешёл в:\n{USER_DIR[chat_id]}")
        else:
            PENDING_PASSWORD[chat_id] = None
            await update.message.reply_text("Пароль неверный. Доступ запрещён.")
        return
    if not ACCESS_GRANTED.get(chat_id, False):
        if entered == PASSWORD:
            ACCESS_GRANTED[chat_id] = True
            USER_DIR[chat_id] = ROOT_FOLDER
            await update.message.reply_text("Пароль верный. Доступ к боту открыт.")
        else:
            await update.message.reply_text("Пароль неверный. Попробуйте ещё раз.")


@require_access
async def handle_upload_any(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not WAITING_UPLOAD.get(chat_id, False):
        return

    file_obj = None
    filename = None
    filesize = None

    if update.message.document:
        file_obj = update.message.document
        filename = file_obj.file_name
        filesize = file_obj.file_size

    elif update.message.photo:
        file_obj = update.message.photo[-1]
        filename = f"photo_{file_obj.file_id}.jpg"
        filesize = file_obj.file_size

    elif update.message.video:
        file_obj = update.message.video
        filename = file_obj.file_name or f"video_{file_obj.file_id}.mp4"
        filesize = file_obj.file_size

    elif update.message.audio:
        file_obj = update.message.audio
        filename = file_obj.file_name or f"audio_{file_obj.file_id}.mp3"
        filesize = file_obj.file_size

    elif update.message.voice:
        file_obj = update.message.voice
        filename = f"voice_{file_obj.file_id}.ogg"
        filesize = file_obj.file_size

    else:
        await update.message.reply_text("Этот тип файла пока не поддерживается.")
        WAITING_UPLOAD[chat_id] = False
        return

    if filesize and filesize > 400 * 1024 * 1024:
        await update.message.reply_text("Файл слишком большой (лимит 400 МБ).")
        WAITING_UPLOAD[chat_id] = False
        return

    current_folder = USER_DIR.get(chat_id, ROOT_FOLDER)
    save_path = os.path.join(current_folder, filename)
    safe = safe_path(ROOT_FOLDER, save_path)
    if safe is None:
        await update.message.reply_text("Неправильный путь.")
        WAITING_UPLOAD[chat_id] = False
        return

    try:
        telegram_file = await file_obj.get_file()
        await telegram_file.download_to_drive(safe)
        await update.message.reply_text(f"Файл сохранён:\n{safe}")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

    WAITING_UPLOAD[chat_id] = False
