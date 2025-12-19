"""
Fraud Detection System
Behavioral-based (not fingerprint-dependent for Brave compatibility)
"""

from typing import Dict
from datetime import datetime, timedelta

# In-memory store (sufficient for Alpha testing)
event_tracking: Dict[str, list] = {}

async def check_fraud_score(anonymous_id: str, num_events: int) -> int:
    """
    Calculate fraud score (0-100) based on behavioral signals
    
    Fraud Score Weights (Brave-compatible):
    - Velocity checks: 40% (events/hour, domains/day)
    - Behavioral entropy: 30% (mouse, scroll patterns)
    - Timing patterns: 20% (inter-event intervals)
    - Fingerprint: <10% (unreliable on Brave)
    
    Returns:
        int: Fraud score (0-100). >80 = high risk
    """
    
    score = 0
    
    # Track events for this user
    now = datetime.now()
    if anonymous_id not in event_tracking:
        event_tracking[anonymous_id] = []
    
    event_tracking[anonymous_id].append(now)
    
    # Clean old events (older than 24 hours)
    event_tracking[anonymous_id] = [
        ts for ts in event_tracking[anonymous_id]
        if now - ts < timedelta(hours=24)
    ]
    
    # ========================================================================
    # VELOCITY CHECKS (40% weight)
    # ========================================================================
    
    # Events per hour
    recent_events = [
        ts for ts in event_tracking[anonymous_id]
        if now - ts < timedelta(hours=1)
    ]
    events_per_hour = len(recent_events)
    
    if events_per_hour > 100:  # Max 100 events/hour
        score += 40
    elif events_per_hour > 50:
        score += 20
    
    # Batch size check (large batches = suspicious)
    if num_events > 80:
        score += 10
    
    # ========================================================================
    # BEHAVIORAL ENTROPY (30% weight)
    # ========================================================================
    
    # TODO: In production, analyze actual behavioral signals from events
    # - Mouse movement entropy
    # - Scroll patterns
    # - Navigation sequences
    
    # For now, assume normal behavior
    behavioral_score = 0  # Would be calculated from event data
    score += behavioral_score
    
    # ========================================================================
    # TIMING PATTERNS (20% weight)
    # ========================================================================
    
    # Check for unnaturally consistent timing (bot behavior)
    if len(event_tracking[anonymous_id]) > 10:
        intervals = [
            (event_tracking[anonymous_id][i] - event_tracking[anonymous_id][i-1]).total_seconds()
            for i in range(1, len(event_tracking[anonymous_id]))
        ]
        
        # Calculate variance
        if intervals:
            mean_interval = sum(intervals) / len(intervals)
            variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
            
            # Very low variance = bot-like behavior
            if variance < 1.0:  # Less than 1 second variance
                score += 20
    
    # ========================================================================
    # FINGERPRINT (< 10% weight)
    # ========================================================================
    
    # De-emphasized because Brave randomizes fingerprints
    # In production, this would check for known bad fingerprints
    # but NOT rely on fingerprint consistency
    fingerprint_score = 0  # Minimal weight
    score += fingerprint_score
    
    return min(score, 100)

