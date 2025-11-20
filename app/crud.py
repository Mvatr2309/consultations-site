from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_hex

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas


def get_all_experts(db: Session) -> list[models.Expert]:
    return db.scalars(select(models.Expert).order_by(models.Expert.full_name)).unique().all()


def create_expert(db: Session, payload: schemas.ExpertCreate) -> models.Expert:
    expert = models.Expert(**payload.model_dump())
    db.add(expert)
    db.commit()
    db.refresh(expert)
    return expert


def update_expert(db: Session, expert_id: int, payload: schemas.ExpertUpdate) -> models.Expert:
    expert = db.get(models.Expert, expert_id)
    if not expert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Эксперт не найден")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(expert, key, value)
    db.add(expert)
    db.commit()
    db.refresh(expert)
    return expert


def delete_expert(db: Session, expert_id: int) -> None:
    expert = db.get(models.Expert, expert_id)
    if not expert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Эксперт не найден")
    db.delete(expert)
    db.commit()


def create_slot(db: Session, payload: schemas.SlotCreate) -> models.Slot:
    expert = db.get(models.Expert, payload.expert_id)
    if not expert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Эксперт не найден")
    slot = models.Slot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def create_slots_batch(db: Session, payload: schemas.SlotBatchCreate) -> list[models.Slot]:
    expert = db.get(models.Expert, payload.expert_id)
    if not expert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Эксперт не найден")
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="Конец периода должен быть позже начала")

    step = timedelta(minutes=payload.slot_duration_minutes)
    total = payload.end_at - payload.start_at
    if total < step:
        raise HTTPException(status_code=400, detail="Период меньше длительности одного слота")

    slot_count = total // step
    remainder = total % step
    if remainder != timedelta(0):
        raise HTTPException(
            status_code=400,
            detail="Период должен делиться на длительность слота без остатка",
        )

    created: list[models.Slot] = []
    for i in range(int(slot_count)):
        slot = models.Slot(
            expert_id=payload.expert_id,
            start_at=payload.start_at + i * step,
            duration_minutes=payload.slot_duration_minutes,
        )
        db.add(slot)
        created.append(slot)

    db.commit()
    for slot in created:
        db.refresh(slot)
    return created


def get_slots(db: Session) -> list[models.Slot]:
    return db.scalars(select(models.Slot).order_by(models.Slot.start_at)).unique().all()


def update_slot(db: Session, slot_id: int, payload: schemas.SlotUpdate) -> models.Slot:
    slot = db.get(models.Slot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Слот не найден")
    if slot.booking:
        raise HTTPException(status_code=400, detail="Нельзя изменить занятый слот")
    data = payload.model_dump(exclude_unset=True)
    if "start_at" in data and data["start_at"]:
        slot.start_at = data["start_at"]
    if "duration_minutes" in data and data["duration_minutes"]:
        slot.duration_minutes = data["duration_minutes"]
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def delete_slot(db: Session, slot_id: int) -> None:
    slot = db.get(models.Slot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Слот не найден")
    if slot.booking:
        raise HTTPException(status_code=400, detail="Нельзя удалить занятый слот. Сначала отмените запись.")
    db.delete(slot)
    db.commit()


def book_slot(db: Session, slot_id: int, payload: schemas.BookingCreate) -> models.Booking:
    slot = db.get(models.Slot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Слот не найден")
    if slot.booking:
        raise HTTPException(status_code=400, detail="Слот уже занят")

    booking = models.Booking(
        slot_id=slot_id,
        cancellation_code=token_hex(3),
        **payload.model_dump(),
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Слот уже занят")
    db.refresh(booking)
    return booking


def delete_booking_as_student(db: Session, booking_id: int, cancellation_code: str) -> None:
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if booking.cancellation_code != cancellation_code:
        raise HTTPException(status_code=403, detail="Неверный код отмены")
    db.delete(booking)
    db.commit()


def delete_booking_as_admin(db: Session, booking_id: int) -> None:
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(booking)
    db.commit()


def list_bookings(db: Session) -> list[models.Booking]:
    return db.scalars(select(models.Booking).order_by(models.Booking.created_at.desc())).unique().all()


def list_bookings_by_expert(db: Session, expert_id: int) -> list[models.Booking]:
    stmt = (
        select(models.Booking)
        .join(models.Slot)
        .where(models.Slot.expert_id == expert_id)
        .order_by(models.Slot.start_at)
    )
    return db.scalars(stmt).unique().all()


def update_booking_admin(db: Session, booking_id: int, payload: schemas.BookingAdminUpdate) -> models.Booking:
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    data = payload.model_dump(exclude_unset=True)
    if "slot_id" in data and data["slot_id"] != booking.slot_id:
        new_slot = db.get(models.Slot, data["slot_id"])
        if not new_slot:
            raise HTTPException(status_code=404, detail="Новый слот не найден")
        if new_slot.booking:
            raise HTTPException(status_code=400, detail="Новый слот уже занят")
        booking.slot_id = data["slot_id"]
    if "question" in data and data["question"]:
        booking.question = data["question"]

    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
