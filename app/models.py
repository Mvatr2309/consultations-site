from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Expert(Base):
    __tablename__ = "experts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    expertise_area: Mapped[str] = mapped_column(String(200), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, default=None)
    contact_info: Mapped[str | None] = mapped_column(String(200), default=None)
    meeting_room: Mapped[str | None] = mapped_column(String(500), default=None)

    slots: Mapped[List[Slot]] = relationship("Slot", back_populates="expert", cascade="all, delete-orphan")


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expert_id: Mapped[int] = mapped_column(ForeignKey("experts.id", ondelete="CASCADE"), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    expert: Mapped[Expert] = relationship("Expert", back_populates="slots")
    booking: Mapped[Booking | None] = relationship("Booking", back_populates="slot", uselist=False, cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("slot_id", name="uq_bookings_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id", ondelete="CASCADE"), nullable=False, unique=True)
    student_name: Mapped[str] = mapped_column(String(120), nullable=False)
    student_email: Mapped[str] = mapped_column(String(200), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    vkr_type: Mapped[str | None] = mapped_column(String(100), default=None)
    magistracy: Mapped[str | None] = mapped_column(String(200), default=None)
    artifacts_link: Mapped[str | None] = mapped_column(String(500), default=None)
    cancellation_code: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    slot: Mapped[Slot] = relationship("Slot", back_populates="booking")
