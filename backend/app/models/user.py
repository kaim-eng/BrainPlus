"""
User Model
"""

from sqlalchemy import Column, String, Float, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_hash = Column(String(64), unique=True, nullable=True, index=True)
    anonymous_id_hash = Column(String(64), unique=True, nullable=False, index=True)
    
    # Data quality and points
    data_quality_score = Column(Float, default=0.0)
    points_balance = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<User {self.user_id}>"

