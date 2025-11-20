from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SlotBase(BaseModel):
    start_at: datetime
    duration_minutes: int = Field(ge=10, le=180, default=30)


class SlotCreate(SlotBase):
    expert_id: int


class SlotBatchCreate(BaseModel):
    expert_id: int
    start_at: datetime
    end_at: datetime
    slot_duration_minutes: int = Field(ge=5, le=240, default=30)


class SlotUpdate(BaseModel):
    start_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=240)


class SlotRead(SlotBase):
    id: int
    expert_id: int
    is_available: bool

    class Config:
        from_attributes = True


class ExpertBase(BaseModel):
    full_name: str
    expertise_area: str
    bio: Optional[str] = None
    contact_info: Optional[str] = None
    meeting_room: Optional[str] = None


class ExpertCreate(ExpertBase):
    pass


class ExpertUpdate(BaseModel):
    full_name: str | None = Field(default=None)
    expertise_area: str | None = Field(default=None)
    bio: Optional[str] = None
    contact_info: Optional[str] = None
    meeting_room: Optional[str] = None


class ExpertRead(ExpertBase):
    id: int

    class Config:
        from_attributes = True


class ExpertWithSlots(ExpertRead):
    slots: list[SlotRead]


class BookingBase(BaseModel):
    student_name: str = Field(min_length=2)
    student_email: EmailStr
    question: str = Field(min_length=5)
    vkr_type: Optional[str] = None
    magistracy: Optional[str] = None
    artifacts_link: Optional[str] = None


class BookingCreate(BookingBase):
    pass


class BookingRead(BookingBase):
    id: int
    slot_id: int
    cancellation_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class BookingAdminUpdate(BaseModel):
    question: Optional[str] = Field(default=None, min_length=5)
    slot_id: Optional[int] = None
