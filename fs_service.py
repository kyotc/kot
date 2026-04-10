import os


def safe_path(base: str, target: str) -> str | None:
    full = os.path.abspath(target)
    root = os.path.abspath(base)
    if os.path.commonpath([root, full]) != root:
        return None
    return full
