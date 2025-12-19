"""
Server-Side Attribution Redirect
CRITICAL: This survives Brave Shields parameter stripping
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

router = APIRouter()

# ============================================================================
# Attribution Redirect
# ============================================================================

# In-memory store (sufficient for Alpha testing)
redirect_store = {}

@router.get("/{short_id}")
async def attribution_redirect(short_id: str):
    """
    Server-side attribution redirect
    
    Flow:
    1. User clicks deal in extension
    2. Extension calls POST /deals/{id}/click
    3. Server creates short_id mapping
    4. User redirected to /r/{short_id}
    5. Server attaches affiliate params and redirects to merchant
    
    This survives Brave Shields parameter stripping because:
    - Tracking params are added AFTER the browser request
    - The final URL with params comes from our server, not the extension
    """
    
    # TODO: Query database for short_id mapping
    # For now, use mock redirect
    
    mapping = redirect_store.get(short_id)
    
    if not mapping:
        # Mock redirect for demo
        # In production, this would be a real merchant URL with affiliate params
        merchant_url = f"https://example.com?aff_id=datapay&ref={short_id}"
    else:
        merchant_url = mapping["url"]
    
    # TODO: Log attribution event
    # TODO: Update attribution tracking
    
    return RedirectResponse(url=merchant_url, status_code=302)

# ============================================================================
# Helper Functions (for testing)
# ============================================================================

def create_redirect_mapping(short_id: str, merchant_url: str, affiliate_params: dict):
    """
    Create a redirect mapping
    """
    
    # Build full URL with affiliate params
    from urllib.parse import urlencode
    params_str = urlencode(affiliate_params)
    full_url = f"{merchant_url}?{params_str}"
    
    redirect_store[short_id] = {
        "url": full_url,
        "created_at": "timestamp",
    }
    
    return short_id

