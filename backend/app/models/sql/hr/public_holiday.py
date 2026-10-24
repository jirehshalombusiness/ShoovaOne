from sqlalchemy import Column, String, Boolean, Date, Text
from app.models.sql.base import BaseModel


class PublicHoliday(BaseModel):
    __tablename__ = "public_holidays"

    name = Column(String(200), nullable=False)
    holiday_date = Column(Date, nullable=False)
    country = Column(String(10), default="GH")
    is_paid = Column(Boolean, default=True)
    notes = Column(Text)