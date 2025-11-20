from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings


settings = get_settings()

# Создаем папку data, если используем SQLite и папка не существует
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.replace("sqlite:///", "")
    # Если путь относительный (начинается с ./)
    if db_path.startswith("./"):
        db_path = db_path[2:]  # Убираем ./
    db_file = Path(db_path)
    # Создаем родительскую директорию, если её нет
    if db_file.parent and not db_file.parent.exists():
        db_file.parent.mkdir(parents=True, exist_ok=True)
    # Параметры подключения для SQLite
    connect_args = {"check_same_thread": False}
else:
    # Для PostgreSQL и других БД параметры не нужны
    connect_args = {}

# Создаем движок базы данных
# Для PostgreSQL URL будет вида: postgresql://user:password@host:port/database
# Для SQLite URL будет вида: sqlite:///./data/consultations.db
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
