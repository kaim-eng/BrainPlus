"""
Points and Redemption Models
"""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.core.database import Base

class TransactionType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"

class PointsLedger(Base):
    __tablename__ = "points_ledger"
    
    transaction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    
    points = Column(Float, nullable=False)
    type = Column(SQLEnum(TransactionType), nullable=False)
    source = Column(String(100), nullable=False)  # e.g., "affiliate", "data_contribution"
    description = Column(String(500))
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<PointsLedger {self.transaction_id}: {self.type} {self.points}>"

class RedemptionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    FULFILLED = "fulfilled"
    FAILED = "failed"
    REFUNDED = "refunded"

class RedemptionHistory(Base):
    __tablename__ = "redemption_history"
    
    redemption_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    
    points_spent = Column(Float, nullable=False)
    partner_transaction_id = Column(String(255), nullable=True)
    status = Column(SQLEnum(RedemptionStatus), default=RedemptionStatus.PENDING)
    
    # Redemption details
    redemption_type = Column(String(50))  # e.g., "gift_card", "paypal"
    redemption_value_usd = Column(Float)  # Actual USD value
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<RedemptionHistory {self.redemption_id}: {self.status}>"

