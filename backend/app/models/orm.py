from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base

class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    gmail_message_id = Column(String, unique=True, index=True)
    thread_id = Column(String)
    sender = Column(String)
    subject = Column(String)
    body = Column(String)
    received_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    prediction = relationship("Prediction", back_populates="email", uselist=False)

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"))
    intent = Column(String)
    confidence = Column(Float)
    top3 = Column(JSON)
    department = Column(String)
    priority = Column(String)
    sla_minutes = Column(Integer)
    processed_at = Column(DateTime, default=datetime.utcnow)
    reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime, nullable=True)
    original_intent = Column(String, nullable=True)
    was_corrected = Column(Boolean, default=False)

    email = relationship("Email", back_populates="prediction")

class Credential(Base):
    __tablename__ = "credentials"
    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, default="gmail")
    account_email = Column(String)
    encrypted_refresh_token = Column(String)
    status = Column(String, default="active") # "active" | "needs_reauth"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
