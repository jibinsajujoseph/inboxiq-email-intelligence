from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config.settings import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def enable_sqlite_wal_mode() -> None:
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as connection:
        connection.execute(text("PRAGMA journal_mode=WAL;"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
