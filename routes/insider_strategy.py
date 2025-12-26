"""
Insider Strategy API Routes - Multi-factor scoring for high-reward trades.

Endpoints:
- GET /insider-strategy/top-picks - Top-rated opportunities
- GET /insider-strategy/stock/{symbol}/score - Detailed scoring breakdown
- GET /insider-strategy/picks/active - All active picks
- POST /insider-strategy/admin/generate-picks - Generate new picks
- GET /insider-strategy/performance - Performance tracking
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from routes.deps import get_db
from services.insider_strategy_service import InsiderStrategyService
from services.cache import cache, TTL_NSE_DATA

router = APIRouter()


@router.get("/top-picks")
async def get_top_picks(
    grade: str = Query("B", description="Minimum grade: A, B, C, D"),
    limit: int = Query(20, description="Number of picks to return"),
    db: Session = Depends(get_db)
):
    """
    Get top-rated Insider Strategy picks.

    Grades:
    - A: 80+ composite score (Highest conviction)
    - B: 60-79 (Good setup)
    - C: 40-59 (Moderate setup)
    - D: <40 (Weak setup)

    Returns picks with:
    - Multi-factor composite scoring
    - Entry/Target/Stop-loss levels
    - Pattern detection
    - Risk-reward analysis
    """
    cache_key = f"insider_strategy_top_picks_{grade}_{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        # Validate grade
        if grade not in ["A", "B", "C", "D"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid grade. Use A, B, C, or D"
            )

        service = InsiderStrategyService(db)

        # First try to get from database
        active_picks = service.get_active_picks(min_grade=grade)

        # If no picks in DB, generate new ones
        if not active_picks:
            print(f"No active picks found, generating new picks with grade {grade}...")
            active_picks = await service.generate_picks(min_grade=grade)

        # Limit results
        picks = active_picks[:limit]

        result = {
            "picks": picks,
            "count": len(picks),
            "min_grade": grade,
            "description": "Multi-factor composite scoring for high-reward trades"
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching top picks: {str(e)}"
        )


@router.get("/stock/{symbol}/score")
async def get_stock_score(
    symbol: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed Insider Strategy scoring for a specific stock.

    Returns:
    - Momentum score (40% weight)
    - Volume score (30% weight)
    - OI score (30% weight)
    - Composite score and grade
    - Pattern detection
    - Entry/Target/Stop-loss levels
    """
    cache_key = f"insider_strategy_score_{symbol}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        service = InsiderStrategyService(db)

        # Generate picks to find this symbol
        all_picks = await service.generate_picks(min_grade="D")

        # Find the symbol
        stock_pick = next(
            (p for p in all_picks if p["symbol"] == symbol.upper()),
            None
        )

        if not stock_pick:
            raise HTTPException(
                status_code=404,
                detail=f"Stock {symbol} not found in current analysis"
            )

        # Add detailed breakdown
        result = {
            **stock_pick,
            "score_breakdown": {
                "momentum": {
                    "score": stock_pick["momentum_score"],
                    "weight": 40,
                    "contribution": round(stock_pick["momentum_score"] * 0.40, 2)
                },
                "volume": {
                    "score": stock_pick["volume_score"],
                    "weight": 30,
                    "contribution": round(stock_pick["volume_score"] * 0.30, 2)
                },
                "open_interest": {
                    "score": stock_pick["oi_score"],
                    "weight": 30,
                    "contribution": round(stock_pick["oi_score"] * 0.30, 2)
                }
            },
            "risk_reward": {
                "entry": stock_pick["entry_price"],
                "target": stock_pick["target_price"],
                "stop_loss": stock_pick["stop_loss"],
                "risk_pct": 5.0,
                "reward_pct": 10.0,
                "ratio": "1:2"
            }
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing stock: {str(e)}"
        )


@router.get("/picks/active")
async def get_active_picks(
    grade: Optional[str] = Query(None, description="Filter by minimum grade"),
    pick_type: Optional[str] = Query(None, description="BULLISH or BEARISH"),
    db: Session = Depends(get_db)
):
    """
    Get all active Insider Strategy picks from database.

    Filters:
    - grade: Minimum grade (A, B, C, D)
    - pick_type: BULLISH or BEARISH
    """
    cache_key = f"insider_strategy_active_{grade}_{pick_type}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        service = InsiderStrategyService(db)
        picks = service.get_active_picks(min_grade=grade)

        # Filter by pick type if specified
        if pick_type:
            pick_type = pick_type.upper()
            if pick_type not in ["BULLISH", "BEARISH"]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid pick_type. Use BULLISH or BEARISH"
                )
            picks = [p for p in picks if p["pick_type"] == pick_type]

        result = {
            "picks": picks,
            "count": len(picks),
            "filters": {
                "min_grade": grade,
                "pick_type": pick_type
            }
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching active picks: {str(e)}"
        )


@router.get("/grade-distribution")
async def get_grade_distribution(db: Session = Depends(get_db)):
    """
    Get distribution of picks across different grades.

    Returns count of picks in each grade (A, B, C, D).
    """
    cache_key = "insider_strategy_grade_distribution"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        service = InsiderStrategyService(db)
        all_picks = service.get_active_picks(min_grade="D")

        distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
        for pick in all_picks:
            grade = pick.get("grade")
            if grade in distribution:
                distribution[grade] += 1

        result = {
            "distribution": distribution,
            "total_picks": len(all_picks),
            "grade_definitions": {
                "A": "80+ score (Highest conviction)",
                "B": "60-79 score (Good setup)",
                "C": "40-59 score (Moderate setup)",
                "D": "<40 score (Weak setup)"
            }
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating distribution: {str(e)}"
        )


@router.post("/admin/generate-picks")
async def admin_generate_picks(
    min_grade: str = Query("B", description="Minimum grade to generate"),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to generate new Insider Strategy picks.

    Analyzes current market data and creates new picks based on
    multi-factor composite scoring.
    """
    try:
        if min_grade not in ["A", "B", "C", "D"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid grade. Use A, B, C, or D"
            )

        service = InsiderStrategyService(db)
        picks = await service.generate_picks(min_grade=min_grade)

        # Store picks in database
        stored_count = 0
        for pick_data in picks:
            pick_id = await service.store_pick(pick_data)
            if pick_id:
                stored_count += 1

        return {
            "status": "success",
            "message": f"Generated and stored {stored_count} picks",
            "total_analyzed": len(picks),
            "min_grade": min_grade
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating picks: {str(e)}"
        )


@router.get("/performance")
async def get_performance_metrics(
    days: int = Query(30, description="Performance period in days"),
    db: Session = Depends(get_db)
):
    """
    Get Insider Strategy performance metrics.

    Returns:
    - Hit rate (targets achieved)
    - Average return
    - Win/Loss ratio
    - Best/Worst picks
    """
    try:
        # This would query InsiderStrategyPerformance table
        # For now, return placeholder structure

        result = {
            "period_days": days,
            "total_picks": 0,
            "active_picks": 0,
            "closed_picks": 0,
            "hit_rate": {
                "targets_hit": 0,
                "stop_loss_hit": 0,
                "expired": 0,
                "hit_rate_pct": 0.0
            },
            "returns": {
                "avg_return_pct": 0.0,
                "best_return_pct": 0.0,
                "worst_return_pct": 0.0,
                "total_pnl": 0.0
            },
            "by_grade": {
                "A": {"count": 0, "hit_rate": 0.0, "avg_return": 0.0},
                "B": {"count": 0, "hit_rate": 0.0, "avg_return": 0.0},
                "C": {"count": 0, "hit_rate": 0.0, "avg_return": 0.0},
                "D": {"count": 0, "hit_rate": 0.0, "avg_return": 0.0}
            },
            "note": "Performance tracking available after picks are executed"
        }

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching performance: {str(e)}"
        )
