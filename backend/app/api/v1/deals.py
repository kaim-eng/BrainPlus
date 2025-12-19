"""
Deal Matching and Serving API
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# ============================================================================
# Request/Response Models
# ============================================================================

class Deal(BaseModel):
    id: str
    merchant_name: str
    merchant_domain: str
    title: str
    description: str
    discount_percent: Optional[int] = None
    discount_amount: Optional[float] = None
    category: str
    thumbnail_url: Optional[str] = None
    redirect_url: str  # Server-side attribution URL
    expires_at: Optional[int] = None
    min_intent_score: float
    points_reward: int
    deal_score: float

class DealsResponse(BaseModel):
    success: bool
    deals: List[Deal]
    total_count: int
    matched_categories: List[str]
    timestamp: int

class DealClickRequest(BaseModel):
    deal_id: str

class DealClickResponse(BaseModel):
    success: bool
    short_id: str  # For server-side redirect

# ============================================================================
# v0.2: Signal-Based Deal Matching
# ============================================================================

class Signal(BaseModel):
    category: str
    entities: List[str]
    intentScore: float
    pageCount: int
    timeWindow: str

class SignalPayload(BaseModel):
    anonymousId: str
    signals: List[Signal]
    timestamp: int

class DealMatch(BaseModel):
    type: str  # "product", "content", "service"
    title: str
    description: Optional[str] = None
    merchant: str
    price: Optional[str] = None
    originalPrice: Optional[str] = None
    discount: Optional[str] = None
    imageUrl: Optional[str] = None
    redirectUrl: str
    reason: str  # Why this was matched
    commission: Optional[str] = None
    expiresAt: Optional[int] = None

class DealMatchResponse(BaseModel):
    success: bool
    matches: List[DealMatch]
    pointsEarned: int
    timestamp: int

# ============================================================================
# Endpoints
# ============================================================================

@router.get("", response_model=DealsResponse)
async def get_deals(
    domain: str,
    category: str,
    intent_score: float,
    x_anonymous_id: Optional[str] = Header(None)
):
    """
    Get relevant deals for current page
    """
    
    # TODO: Implement actual deal matching logic
    # For now, return mock deals
    
    mock_deals = [
        Deal(
            id="deal_001",
            merchant_name="Amazon",
            merchant_domain="amazon.com",
            title="20% Off Electronics",
            description="Get 20% off on select electronics. Limited time offer!",
            discount_percent=20,
            category="electronics",
            redirect_url="/r/abc123",  # Will be full URL in production
            min_intent_score=0.7,
            points_reward=50,
            deal_score=0.9,
        ),
    ]
    
    # Filter by intent score
    matched_deals = [d for d in mock_deals if intent_score >= d.min_intent_score]
    
    return DealsResponse(
        success=True,
        deals=matched_deals,
        total_count=len(matched_deals),
        matched_categories=[category],
        timestamp=int(datetime.now().timestamp() * 1000),
    )

@router.post("/match")
async def match_deals(
    payload: SignalPayload,
    x_anonymous_id: Optional[str] = Header(None)
):
    """
    Match deals based on user signals (v0.2)
    Receives aggregated interests, returns personalized deals
    """
    
    # TODO: Connect to database to fetch products
    # For now, using in-memory mock data
    
    matches = []
    
    # Match deals based on user signals (category + keywords)
    # TODO: Replace with database query + pgvector semantic search
    for signal in payload.signals:
        category = signal.category
        keywords = signal.entities
        
        # Electronics - headphones, audio devices
        if category == "electronics" and any(kw in ["headphones", "audio", "wireless", "noise", "sound"] for kw in keywords):
            matches.append(DealMatch(
                type="product",
                title="Sony WH-1000XM5 Wireless Headphones",
                description="Industry-leading noise cancellation",
                merchant="Amazon",
                price="$348",
                originalPrice="$399",
                discount="13% off",
                imageUrl="https://m.media-amazon.com/images/I/51K0kOPmF9L._AC_SL1500_.jpg",
                redirectUrl=f"/r/{generate_short_id('sony-xm5', payload.anonymousId)}",
                reason=f"Based on your interest in '{', '.join(keywords[:2])}'",
                commission="5%",
                expiresAt=None,
            ))
            matches.append(DealMatch(
                type="product",
                title="Apple AirPods Pro (2nd Generation)",
                description="Active Noise Cancellation and Adaptive Transparency",
                merchant="Apple",
                price="$249",
                originalPrice="$299",
                discount="$50 off",
                redirectUrl=f"/r/{generate_short_id('airpods-pro', payload.anonymousId)}",
                reason=f"Based on your interest in '{', '.join(keywords[:2])}'",
                commission="3%",
                expiresAt=None,
            ))
        
        # Fitness - running, shoes, workout gear
        elif category == "fitness" and any(kw in ["running", "shoes", "workout", "exercise", "nike"] for kw in keywords):
            matches.append(DealMatch(
                type="product",
                title="Nike Pegasus 40 Running Shoes",
                description="Responsive cushioning for any run",
                merchant="Nike",
                price="$130",
                originalPrice="$140",
                discount="$10 off",
                redirectUrl=f"/r/{generate_short_id('nike-pegasus', payload.anonymousId)}",
                reason=f"Based on your interest in '{', '.join(keywords[:2])}'",
                commission="8%",
                expiresAt=None,
            ))
        
        # General/Shopping - bottles, cups, drinkware, baby products
        elif category == "general" and any(kw in ["bottle", "cup", "water", "drink", "insulated", "baby", "toddler", "sippy"] for kw in keywords):
            matches.append(DealMatch(
                type="product",
                title="Owala FreeSip Insulated Water Bottle",
                description="32 oz stainless steel with FreeSip spout",
                merchant="Amazon",
                price="$27.99",
                originalPrice="$37.99",
                discount="26% off",
                redirectUrl=f"/r/{generate_short_id('owala-bottle', payload.anonymousId)}",
                reason=f"Based on your interest in '{', '.join(keywords[:2])}'",
                commission="4%",
                expiresAt=None,
            ))
            matches.append(DealMatch(
                type="product",
                title="Contigo AUTOSEAL Travel Mug",
                description="Vacuum-insulated stainless steel, 20 oz",
                merchant="Target",
                price="$19.99",
                originalPrice="$24.99",
                discount="20% off",
                redirectUrl=f"/r/{generate_short_id('contigo-mug', payload.anonymousId)}",
                reason=f"Based on your interest in '{', '.join(keywords[:2])}'",
                commission="3%",
                expiresAt=None,
            ))
    
    # Award points for sending signal
    points_earned = 10
    
    # TODO: Store signal in database
    # TODO: Award points to user account
    
    # Limit to top 2 matches (for debugging)
    matches = matches[:2]
    
    return {
        "success": True,
        "data": {
            "matches": matches,
            "pointsEarned": points_earned,
        },
        "timestamp": int(datetime.now().timestamp() * 1000),
    }

def generate_short_id(product_slug: str, user_id: str) -> str:
    """Generate short ID for server-side attribution"""
    import hashlib
    combined = f"{product_slug}:{user_id}:{datetime.now().isoformat()}"
    return hashlib.md5(combined.encode()).hexdigest()[:12]

@router.post("/{deal_id}/click", response_model=DealClickResponse)
async def record_deal_click(
    deal_id: str,
    x_anonymous_id: Optional[str] = Header(None)
):
    """
    Record deal click and return server-side attribution short ID
    """
    
    if not x_anonymous_id:
        raise HTTPException(status_code=400, detail="Anonymous ID required")
    
    # TODO: Store click record in database
    # TODO: Create short ID mapping to full merchant URL with affiliate params
    
    # For now, generate a mock short ID
    import hashlib
    short_id = hashlib.md5(f"{deal_id}{x_anonymous_id}".encode()).hexdigest()[:8]
    
    # TODO: Store mapping: short_id -> (user, merchant_url, affiliate_params)
    
    return DealClickResponse(
        success=True,
        short_id=short_id,
    )

