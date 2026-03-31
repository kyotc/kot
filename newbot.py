import os
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

# === НАСТРОЙКИ ===
TOKEN = "8495209839:AAGZ7YgGHMDtuLjJqqZpZpQwnwOpowBusi4"
ROOT_FOLDER = r"Q:\Documents"
PROTECTED_FOLDER_NAME = "Обсидиан"
PASSWORD = "330353BNM"  # пароль для всего бота и защищённой папки

# Хранение данных пользователей
USER_DIR = {}           # chat_id -> текущая папка
PENDING_PASSWORD = {}   # chat_id -> путь к защищённой папке
ACCESS_GRANTED = {}     # chat_id -> True/False

def safe_path(base: str, target: str) -> str:
    """Безопасный путь, нельзя выходить за пределы ROOT_FOLDER."""
    full = os.path.abspath(target)
    root = os.path.abspath(base)
    if os.path.commonpath([root, full]) != root:
        return None
    return full

# === ДЕКОРАТОР ДЛЯ КОМАНД ===
def require_access(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        if not ACCESS_GRANTED.get(chat_id, False):
            await update.message.reply_text("Доступ запрещён. Введите пароль:")
            return
        await func(update, context)
    return wrapper

# === КОМАНДЫ ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not ACCESS_GRANTED.get(chat_id, False):
        await update.message.reply_text("Бот запущен. Введите пароль для доступа:")
        return
    if chat_id not in USER_DIR:
        USER_DIR[chat_id] = ROOT_FOLDER
    text = (
        "Бот готов.\n\n"
        "Команды:\n"
        "/help — список команд\n"
        "/pwd — текущая папка\n"
        "/list — показать файлы и папки\n"
        "/cd Папка — перейти в папку\n"
        "/back — назад\n"
        "/get Файл — скачать файл\n"
        "/stop — выключить бота"
    )
    await update.message.reply_text(text)

@require_access
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "/pwd — текущая папка\n"
        "/list — вывод содержимого\n"
        "/cd <папка> — перейти в папку\n"
        "/back — на уровень выше\n"
        "/get <файл> — скачать файл\n"
        "/rename <старое> <новое> — переименовать\n"
        "/stop — остановить бота"
    )

@require_access
async def rename(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    if len(context.args) < 2:
        await update.message.reply_text("Использование:\n/rename старое_имя новое_имя")
        return

    old_name = context.args[0]
    new_name = " ".join(context.args[1:])  # чтобы поддерживались имена с пробелами

    current = USER_DIR.get(chat_id, ROOT_FOLDER)

    old_path = os.path.join(current, old_name)
    new_path = os.path.join(current, new_name)

    # Безопасность
    old_safe = safe_path(ROOT_FOLDER, old_path)
    new_safe = safe_path(ROOT_FOLDER, new_path)

    if old_safe is None or not os.path.exists(old_safe):
        await update.message.reply_text("Файл или папка не найдены.")
        return

    if new_safe is None:
        await update.message.reply_text("Недопустимое имя (выход за пределы корня).")
        return

    try:
        os.rename(old_safe, new_safe)
        await update.message.reply_text(f"Переименовано:\n{old_name} → {new_name}")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

@require_access
async def pwd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await update.message.reply_text(USER_DIR.get(chat_id, ROOT_FOLDER))

@require_access
async def list_files(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    folder = USER_DIR.get(chat_id, ROOT_FOLDER)
    try:
        items = os.listdir(folder)
        if not items:
            await update.message.reply_text("Папка пуста.")
            return
        output = []
        for i in items:
            p = os.path.join(folder, i)
            if os.path.isdir(p):
                if i == PROTECTED_FOLDER_NAME:
                    output.append(f"[DIR] {i} (защищено)")
                else:
                    output.append(f"[DIR] {i}")
            else:
                output.append(i)
        await update.message.reply_text("\n".join(output))
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

@require_access
async def cd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not context.args:
        await update.message.reply_text("Пример: /cd Папка")
        return
    folder_name = " ".join(context.args)
    current = USER_DIR.get(chat_id, ROOT_FOLDER)
    target = os.path.join(current, folder_name)
    safe = safe_path(ROOT_FOLDER, target)
    if safe is None or not os.path.isdir(safe):
        await update.message.reply_text("Папка не найдена или выходит за пределы корня.")
        return
    # Защищённая папка
    if folder_name == PROTECTED_FOLDER_NAME:
        PENDING_PASSWORD[chat_id] = safe
        await update.message.reply_text("Введите пароль для доступа к защищённой папке:")
        return
    USER_DIR[chat_id] = safe
    await update.message.reply_text(f"Перешёл в:\n{safe}")

@require_access
async def back(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    current = USER_DIR.get(chat_id, ROOT_FOLDER)
    parent = os.path.dirname(current)
    safe = safe_path(ROOT_FOLDER, parent)
    if safe is None:
        await update.message.reply_text("Это корневая папка.")
        return
    USER_DIR[chat_id] = safe
    await update.message.reply_text(f"Перешёл в:\n{safe}")


@require_access
async def get_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not context.args:
        await update.message.reply_text("Пример: /get file.pdf")
        return
    filename = " ".join(context.args)
    path = os.path.join(USER_DIR.get(chat_id, ROOT_FOLDER), filename)
    safe = safe_path(ROOT_FOLDER, path)
    if safe is None or not os.path.isfile(safe):
        await update.message.reply_text("Файл не найден.")
        return
    try:
        await update.message.reply_document(open(safe, "rb"))
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

@require_access
async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Бот выключается…")
    await context.application.shutdown()
    await context.application.stop_running()

# === ОБРАБОТКА ПАРОЛЯ ===
async def password_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    entered = update.message.text.strip()

    # Защищённая папка
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

    # Доступ к боту
    if not ACCESS_GRANTED.get(chat_id, False):
        if entered == PASSWORD:
            ACCESS_GRANTED[chat_id] = True
            USER_DIR[chat_id] = ROOT_FOLDER
            await update.message.reply_text("Пароль верный. Доступ к боту открыт.")
        else:
            await update.message.reply_text("Пароль неверный. Попробуйте ещё раз.")

# === ЗАПУСК ===
if __name__ == "__main__":
    app = ApplicationBuilder().token(TOKEN).build()

    # Команды
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("pwd", pwd))
    app.add_handler(CommandHandler("list", list_files))
    app.add_handler(CommandHandler("cd", cd))
    app.add_handler(CommandHandler("back", back))
    app.add_handler(CommandHandler("get", get_file))
    app.add_handler(CommandHandler("rename", rename))
    app.add_handler(CommandHandler("stop", stop))

    # Пароль
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, password_handler))

    print("Бот запущен…")
    app.run_polling()