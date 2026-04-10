from functools import wraps

from telegram import Update
from telegram.ext import ContextTypes

from bot_state import ACCESS_GRANTED


def require_access(func):
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        if not ACCESS_GRANTED.get(chat_id, False):
            await update.message.reply_text("Доступ запрещён. Введите пароль:")
            return
        await func(update, context)

    return wrapper
