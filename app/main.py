from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.config import get_settings
from app.database import Base, engine, get_db

settings = get_settings()
app = FastAPI(title="Consultation Booking Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Base.metadata.create_all(bind=engine)


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
ADMIN_COOKIE_NAME = "admin_auth"
EXPERT_COOKIE_NAME = "expert_auth"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def require_admin(x_admin_token: str | None = Header(default=None)):
    if x_admin_token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный токен администратора")


def serialize_slot(slot: models.Slot) -> schemas.SlotRead:
    return schemas.SlotRead(
        id=slot.id,
        expert_id=slot.expert_id,
        start_at=slot.start_at,
        duration_minutes=slot.duration_minutes,
        is_available=slot.booking is None,
    )


def serialize_expert(
    expert: models.Expert,
    min_date: datetime | None = None,
    max_date: datetime | None = None,
) -> schemas.ExpertWithSlots:
    slots = sorted(expert.slots, key=lambda s: s.start_at)
    if min_date:
        slots = [slot for slot in slots if slot.start_at >= min_date]
    if max_date:
        slots = [slot for slot in slots if slot.start_at <= max_date]
    return schemas.ExpertWithSlots(
        id=expert.id,
        full_name=expert.full_name,
        expertise_area=expert.expertise_area,
        bio=expert.bio,
        contact_info=expert.contact_info,
        meeting_room=expert.meeting_room,
        slots=[serialize_slot(slot) for slot in slots],
    )


@app.get("/", response_class=FileResponse)
async def landing_page():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/student", response_class=FileResponse)
async def student_page():
    return FileResponse(STATIC_DIR / "student.html")


@app.get("/expert/login", response_class=FileResponse)
async def expert_login_page():
    return FileResponse(STATIC_DIR / "expert-login.html")


@app.post("/expert/login")
async def expert_login(payload: dict = Body(...)):
    token = (payload or {}).get("token")
    if token != settings.expert_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный код эксперта")
    response = JSONResponse({"message": "ok"})
    response.set_cookie(
        key=EXPERT_COOKIE_NAME,
        value=settings.expert_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 12,
    )
    return response


@app.post("/expert/logout")
async def expert_logout():
    response = JSONResponse({"message": "logged out"})
    response.delete_cookie(EXPERT_COOKIE_NAME)
    return response


@app.get("/expert")
async def expert_page(request: Request):
    if request.cookies.get(EXPERT_COOKIE_NAME) != settings.expert_token:
        return RedirectResponse(url="/expert/login", status_code=status.HTTP_303_SEE_OTHER)
    return FileResponse(STATIC_DIR / "expert.html")


@app.get("/admin/login", response_class=FileResponse)
async def admin_login_page():
    return FileResponse(STATIC_DIR / "admin-login.html")


@app.post("/admin/login")
async def admin_login(payload: dict = Body(...)):
    token = (payload or {}).get("token")
    if token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный код администратора")
    response = JSONResponse({"message": "ok"})
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=settings.admin_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 12,
    )
    return response


@app.post("/admin/logout")
async def admin_logout():
    response = JSONResponse({"message": "logged out"})
    response.delete_cookie(ADMIN_COOKIE_NAME)
    return response


@app.get("/admin")
async def admin_page(request: Request):
    if request.cookies.get(ADMIN_COOKIE_NAME) != settings.admin_token:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_303_SEE_OTHER)
    return FileResponse(STATIC_DIR / "admin.html")


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow()}


@app.get("/experts", response_model=list[schemas.ExpertWithSlots])
def list_experts(
    horizon_days: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
):
    experts = crud.get_all_experts(db)
    min_date = datetime.utcnow() if horizon_days is not None else None
    max_date = datetime.utcnow() + timedelta(days=horizon_days) if horizon_days is not None else None
    return [serialize_expert(expert, min_date=min_date, max_date=max_date) for expert in experts]


@app.post("/experts", response_model=schemas.ExpertRead, dependencies=[Depends(require_admin)])
def create_expert(payload: schemas.ExpertCreate, db: Session = Depends(get_db)):
    expert = crud.create_expert(db, payload)
    return schemas.ExpertRead.model_validate(expert)


@app.patch("/experts/{expert_id}", response_model=schemas.ExpertRead, dependencies=[Depends(require_admin)])
def update_expert(expert_id: int, payload: schemas.ExpertUpdate, db: Session = Depends(get_db)):
    expert = crud.update_expert(db, expert_id, payload)
    return schemas.ExpertRead.model_validate(expert)


@app.delete("/experts/{expert_id}", dependencies=[Depends(require_admin)])
def delete_expert(expert_id: int, db: Session = Depends(get_db)):
    crud.delete_expert(db, expert_id)
    return {"message": "Эксперт удалён"}


@app.get("/slots", response_model=list[schemas.SlotRead])
def list_slots(db: Session = Depends(get_db)):
    slots = crud.get_slots(db)
    return [serialize_slot(slot) for slot in slots]


@app.post("/slots", response_model=schemas.SlotRead, dependencies=[Depends(require_admin)])
def create_slot(payload: schemas.SlotCreate, db: Session = Depends(get_db)):
    slot = crud.create_slot(db, payload)
    return serialize_slot(slot)


@app.post("/slots/batch", response_model=list[schemas.SlotRead], dependencies=[Depends(require_admin)])
def create_slot_batch(payload: schemas.SlotBatchCreate, db: Session = Depends(get_db)):
    slots = crud.create_slots_batch(db, payload)
    return [serialize_slot(slot) for slot in slots]


@app.patch("/slots/{slot_id}", response_model=schemas.SlotRead, dependencies=[Depends(require_admin)])
def update_slot(slot_id: int, payload: schemas.SlotUpdate, db: Session = Depends(get_db)):
    slot = crud.update_slot(db, slot_id, payload)
    return serialize_slot(slot)


@app.delete("/slots/{slot_id}", dependencies=[Depends(require_admin)])
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    crud.delete_slot(db, slot_id)
    return {"message": "Слот удалён"}


@app.post("/slots/{slot_id}/book", response_model=schemas.BookingRead)
def book_slot(slot_id: int, payload: schemas.BookingCreate, db: Session = Depends(get_db)):
    booking = crud.book_slot(db, slot_id, payload)
    return schemas.BookingRead.model_validate(booking)


@app.delete("/bookings/{booking_id}")
def delete_booking_student(booking_id: int, cancellation_code: str, db: Session = Depends(get_db)):
    crud.delete_booking_as_student(db, booking_id, cancellation_code)
    return {"message": "Запись отменена"}


@app.get("/bookings", response_model=list[schemas.BookingRead], dependencies=[Depends(require_admin)])
def admin_list_bookings(db: Session = Depends(get_db)):
    bookings = crud.list_bookings(db)
    return [schemas.BookingRead.model_validate(b) for b in bookings]


@app.delete("/admin/bookings/{booking_id}", dependencies=[Depends(require_admin)])
def delete_booking_admin(booking_id: int, db: Session = Depends(get_db)):
    crud.delete_booking_as_admin(db, booking_id)
    return {"message": "Запись удалена"}


@app.patch("/admin/bookings/{booking_id}", response_model=schemas.BookingRead, dependencies=[Depends(require_admin)])
def admin_update_booking(booking_id: int, payload: schemas.BookingAdminUpdate, db: Session = Depends(get_db)):
    booking = crud.update_booking_admin(db, booking_id, payload)
    return schemas.BookingRead.model_validate(booking)


@app.get("/experts/{expert_id}/bookings", response_model=list[schemas.BookingRead])
def expert_bookings(expert_id: int, db: Session = Depends(get_db)):
    bookings = crud.list_bookings_by_expert(db, expert_id)
    return [schemas.BookingRead.model_validate(b) for b in bookings]
