import os
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

# === НАСТРОЙКИ ===
TOKEN = "8495209839:AAGZ7YgGHMDtuLjJqqZpZpQwnwOpowBusi4"
ROOT_FOLDER = r"Q:\Documents"
PROTECTED_FOLDER_NAME = "Обсидиан"
PASSWORD = "330353BNM"

# Хранение данных пользователей
USER_DIR = {}           # chat_id -> текущая папка
PENDING_PASSWORD = {}   # chat_id -> путь к защищённой папке
ACCESS_GRANTED = {}     # chat_id -> True/False
WAITING_UPLOAD = {}     # chat_id -> True/False для режима /upload

# === БЕЗОПАСНЫЙ ПУТЬ ===
def safe_path(base: str, target: str) -> str:
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
        "/rename — переименовать\n"
        "/upload — отправить файл в текущую папку\n"
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
        "/upload — отправить файл в текущую папку\n"
        "/create file - создать какой-либо файл\n"
        "/create folder - создать папку\n"
        "/stop — остановить бота"
    )

@require_access
async def rename(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if len(context.args) < 2:
        await update.message.reply_text("Использование:\n/rename старое_имя новое_имя")
        return
    old_name = context.args[0]
    new_name = " ".join(context.args[1:])
    current = USER_DIR.get(chat_id, ROOT_FOLDER)
    old_path = os.path.join(current, old_name)
    new_path = os.path.join(current, new_name)
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
async def create(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    if len(context.args) < 2:
        await update.message.reply_text(
            "Использование:\n"
            "/create folder <название>\n"
            "/create file <название>"
        )
        return

    create_type = context.args[0].lower()
    name = " ".join(context.args[1:])
    current = USER_DIR.get(chat_id, ROOT_FOLDER)

    target_path = os.path.join(current, name)
    safe = safe_path(ROOT_FOLDER, target_path)
    if safe is None:
        await update.message.reply_text("Недопустимый путь.")
        return

    try:
        if create_type == "folder":
            os.makedirs(safe, exist_ok=False)
            await update.message.reply_text(f"Папка создана:\n{name}")

        elif create_type == "file":
            with open(safe, "x", encoding="utf-8"):
                pass
            await update.message.reply_text(f"Файл создан:\n{name}")

        else:
            await update.message.reply_text(
                "Тип неизвестен. Используйте:\n"
                "/create folder <название>\n"
                "/create file <название>"
            )

    except FileExistsError:
        await update.message.reply_text("Ошибка: уже существует.")
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

# === /upload (для любых файлов и медиа) ===
@require_access
async def upload_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    WAITING_UPLOAD[chat_id] = True
    await update.message.reply_text(
        "Отправьте файл, фото, видео или аудио (до 400 МБ). Он будет сохранён в текущую папку."
    )

@require_access
async def handle_upload_any(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not WAITING_UPLOAD.get(chat_id, False):
        return

    file_obj = None
    filename = None
    filesize = None

    # Документ (pdf, zip, exe и т.д.)
    if update.message.document:
        file_obj = update.message.document
        filename = file_obj.file_name
        filesize = file_obj.file_size

    # Фото (берём максимальное качество)
    elif update.message.photo:
        file_obj = update.message.photo[-1]
        filename = f"photo_{file_obj.file_id}.jpg"
        filesize = file_obj.file_size

    # Видео
    elif update.message.video:
        file_obj = update.message.video
        filename = file_obj.file_name or f"video_{file_obj.file_id}.mp4"
        filesize = file_obj.file_size

    # Аудио
    elif update.message.audio:
        file_obj = update.message.audio
        filename = file_obj.file_name or f"audio_{file_obj.file_id}.mp3"
        filesize = file_obj.file_size

    # Голосовое сообщение
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
        await update.message.reply_text("Ошибка: путь недопустим.")
        WAITING_UPLOAD[chat_id] = False
        return

    try:
        telegram_file = await file_obj.get_file()
        await telegram_file.download_to_drive(safe)
        await update.message.reply_text(f"Файл сохранён:\n{safe}")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

    WAITING_UPLOAD[chat_id] = False

# === ОБРАБОТКА ПАРОЛЯ ===
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
    app.add_handler(CommandHandler("create", create))
    app.add_handler(CommandHandler("stop", stop))

    # Пароль
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, password_handler))

    app.add_handler(CommandHandler("upload", upload_command))
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, handle_upload_any))

    print("Бот запущен…")
    app.run_polling()