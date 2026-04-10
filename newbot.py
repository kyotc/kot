from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters

from bot_config import TOKEN
from command_handlers import (
    back,
    cd,
    create,
    get_file,
    help_command,
    list_files,
    pwd,
    rename,
    start,
    stop,
    upload_command,
)
from message_handlers import handle_upload_any, password_handler


def main():
    app = ApplicationBuilder().token(TOKEN).build()

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
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, password_handler))
    app.add_handler(CommandHandler("upload", upload_command))
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, handle_upload_any))

    print("Бот запущен…")
    app.run_polling()


if __name__ == "__main__":
    main()