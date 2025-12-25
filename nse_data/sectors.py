"""
Sector Scope - Sector Analysis & Rotation Detection
Provides sector heatmap, relative strength analysis, and leading sector identification.
"""

from fastapi import APIRouter, HTTPException
import httpx
import asyncio
from typing import List, Dict, Optional

from services.cache import (
    cache, sector_heatmap_key, sector_stocks_key, TTL_SECTOR_DATA
)

router = APIRouter()

# NSE API endpoints
NSE_ALL_INDICES_URL = "https://www.nseindia.com/api/allIndices"
NSE_INDEX_STOCKS_URL = "https://www.nseindia.com/api/equity-stockIndices?index="

# Sector indices to track (these are the main sectoral indices on NSE)
SECTOR_INDICES = {
    "NIFTY BANK": {"name": "Banking", "short": "BANK", "color": "#3B82F6"},
    "NIFTY IT": {"name": "IT", "short": "IT", "color": "#8B5CF6"},
    "NIFTY PHARMA": {"name": "Pharma", "short": "PHARMA", "color": "#10B981"},
    "NIFTY AUTO": {"name": "Auto", "short": "AUTO", "color": "#F59E0B"},
    "NIFTY FMCG": {"name": "FMCG", "short": "FMCG", "color": "#EF4444"},
    "NIFTY METAL": {"name": "Metals", "short": "METAL", "color": "#6B7280"},
    "NIFTY REALTY": {"name": "Realty", "short": "REALTY", "color": "#EC4899"},
    "NIFTY ENERGY": {"name": "Energy", "short": "ENERGY", "color": "#F97316"},
    "NIFTY INFRA": {"name": "Infra", "short": "INFRA", "color": "#14B8A6"},
    "NIFTY PSU BANK": {"name": "PSU Bank", "short": "PSUBANK", "color": "#6366F1"},
    "NIFTY PRIVATE BANK": {"name": "Pvt Bank", "short": "PVTBANK", "color": "#0EA5E9"},
    "NIFTY FINANCIAL SERVICES": {"name": "Financial", "short": "FIN", "color": "#22C55E"},
    "NIFTY MEDIA": {"name": "Media", "short": "MEDIA", "color": "#A855F7"},
    "NIFTY CONSUMER DURABLES": {"name": "Consumer", "short": "CONSUMER", "color": "#F43F5E"},
    "NIFTY OIL & GAS": {"name": "Oil & Gas", "short": "OILGAS", "color": "#84CC16"},
    "NIFTY HEALTHCARE INDEX": {"name": "Healthcare", "short": "HEALTH", "color": "#06B6D4"},
}

# Market benchmark for relative strength calculation
BENCHMARK_INDEX = "NIFTY 50"


async def fetch_all_indices_data() -> List[Dict]:
    """Fetch all indices data from NSE."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            # Get cookies first
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            response = await client.get(NSE_ALL_INDICES_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"[SECTOR_SCOPE] Error fetching indices: {e}")
            return []


async def fetch_index_stocks(index_name: str) -> List[Dict]:
    """Fetch stocks in a specific index."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }

    url = f"{NSE_INDEX_STOCKS_URL}{index_name.replace(' ', '%20')}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            # Get cookies first
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"[SECTOR_SCOPE] Error fetching index stocks for {index_name}: {e}")
            return []


def calculate_sector_metrics(sectors_data: List[Dict], benchmark_change: float) -> List[Dict]:
    """
    Calculate sector metrics including relative strength vs benchmark.

    Args:
        sectors_data: List of sector data from NSE
        benchmark_change: NIFTY 50 percentage change for relative strength

    Returns:
        List of sectors with calculated metrics
    """
    sectors = []

    for sector in sectors_data:
        index_name = sector.get("index", "")
        if index_name not in SECTOR_INDICES:
            continue

        sector_info = SECTOR_INDICES[index_name]
        pct_change = float(sector.get("percentChange", 0) or 0)

        # Calculate relative strength vs NIFTY 50
        rs_vs_nifty = pct_change - benchmark_change

        # Determine position/status
        if rs_vs_nifty > 1.0:
            position = "LEADER"
            status_color = "bullish"
        elif rs_vs_nifty > 0:
            position = "OUTPERFORMER"
            status_color = "bullish"
        elif rs_vs_nifty > -1.0:
            position = "NEUTRAL"
            status_color = "neutral"
        else:
            position = "LAGGARD"
            status_color = "bearish"

        sectors.append({
            "indexName": index_name,
            "name": sector_info["name"],
            "shortName": sector_info["short"],
            "color": sector_info["color"],
            "lastValue": sector.get("last", 0),
            "change": sector.get("variation", 0),
            "percentChange": pct_change,
            "open": sector.get("open", 0),
            "high": sector.get("high", 0),
            "low": sector.get("low", 0),
            "previousClose": sector.get("previousClose", 0),
            "relativeStrength": round(rs_vs_nifty, 2),
            "position": position,
            "statusColor": status_color,
        })

    # Sort by percentage change (best performers first)
    sectors.sort(key=lambda x: x["percentChange"], reverse=True)

    return sectors


def analyze_sector_rotation(sectors: List[Dict]) -> Dict:
    """
    Analyze sector rotation based on leading/lagging sectors.

    Returns rotation phase and insights.
    """
    if not sectors:
        return {"phase": "UNKNOWN", "insight": "No data available"}

    # Get top 3 and bottom 3 sectors
    leaders = [s["name"] for s in sectors[:3]]
    laggards = [s["name"] for s in sectors[-3:]]

    # Simple rotation phase detection based on leading sectors
    # This is a simplified model - can be enhanced with historical data

    # Early Bull: Technology, Consumer
    # Mid Bull: Industrials, Materials, Financials
    # Late Bull: Energy, Commodities
    # Early Bear: Healthcare, FMCG (Defensive)
    # Late Bear: Utilities, Telecom

    tech_sectors = {"IT", "Media"}
    financial_sectors = {"Banking", "Financial", "Pvt Bank", "PSU Bank"}
    defensive_sectors = {"FMCG", "Pharma", "Healthcare"}
    cyclical_sectors = {"Auto", "Metals", "Realty", "Infra", "Consumer"}
    energy_sectors = {"Energy", "Oil & Gas"}

    leader_set = set(leaders)

    if leader_set & tech_sectors:
        phase = "EARLY_BULL"
        insight = "Technology leading suggests early bull market - growth stocks favored"
    elif leader_set & financial_sectors:
        phase = "MID_BULL"
        insight = "Financials leading suggests mid-cycle expansion - broad market participation"
    elif leader_set & energy_sectors:
        phase = "LATE_BULL"
        insight = "Energy/commodities leading suggests late cycle - consider defensive rotation"
    elif leader_set & defensive_sectors:
        phase = "DEFENSIVE"
        insight = "Defensive sectors leading - market seeking safety, potential correction ahead"
    elif leader_set & cyclical_sectors:
        phase = "RECOVERY"
        insight = "Cyclical sectors leading - economic recovery expectations"
    else:
        phase = "TRANSITION"
        insight = "Mixed leadership - market in transition phase"

    return {
        "phase": phase,
        "insight": insight,
        "leaders": leaders,
        "laggards": laggards,
    }


@router.get("/heatmap")
async def get_sector_heatmap():
    """
    Get sector heatmap data with performance metrics.
    Returns all sector indices with change %, relative strength, and position.
    """
    # Check cache first
    cache_key = sector_heatmap_key()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch fresh data
    all_indices = await fetch_all_indices_data()

    if not all_indices:
        raise HTTPException(status_code=503, detail="Unable to fetch sector data from NSE")

    # Find benchmark (NIFTY 50) change
    benchmark_change = 0.0
    benchmark_data = None
    for idx in all_indices:
        if idx.get("index") == BENCHMARK_INDEX:
            benchmark_change = float(idx.get("percentChange", 0) or 0)
            benchmark_data = {
                "name": BENCHMARK_INDEX,
                "lastValue": idx.get("last", 0),
                "change": idx.get("variation", 0),
                "percentChange": benchmark_change,
            }
            break

    # Calculate sector metrics
    sectors = calculate_sector_metrics(all_indices, benchmark_change)

    # Analyze rotation
    rotation = analyze_sector_rotation(sectors)

    # Count leaders, laggards, neutral
    leaders_count = sum(1 for s in sectors if s["position"] in ["LEADER", "OUTPERFORMER"])
    laggards_count = sum(1 for s in sectors if s["position"] == "LAGGARD")

    # Market breadth
    advancing = sum(1 for s in sectors if s["percentChange"] > 0)
    declining = len(sectors) - advancing

    result = {
        "benchmark": benchmark_data,
        "sectors": sectors,
        "rotation": rotation,
        "summary": {
            "totalSectors": len(sectors),
            "leadersCount": leaders_count,
            "laggardsCount": laggards_count,
            "advancing": advancing,
            "declining": declining,
            "breadth": round(advancing / len(sectors) * 100, 1) if sectors else 0,
        },
        "lastUpdated": None,  # Will be set by frontend based on auto-refresh
    }

    # Cache for 5 minutes
    cache.set(cache_key, result, TTL_SECTOR_DATA)

    return result


@router.get("/leaders")
async def get_sector_leaders():
    """
    Get top performing sectors (leaders).
    Returns top 5 sectors by performance with relative strength.
    """
    # Reuse heatmap data
    heatmap = await get_sector_heatmap()
    sectors = heatmap.get("sectors", [])

    # Top 5 leaders
    leaders = [s for s in sectors if s["percentChange"] > 0][:5]

    return {
        "leaders": leaders,
        "benchmark": heatmap.get("benchmark"),
        "rotation": heatmap.get("rotation"),
    }


@router.get("/laggards")
async def get_sector_laggards():
    """
    Get worst performing sectors (laggards).
    Returns bottom 5 sectors by performance.
    """
    # Reuse heatmap data
    heatmap = await get_sector_heatmap()
    sectors = heatmap.get("sectors", [])

    # Bottom 5 laggards (reverse order, worst first)
    laggards = sorted(sectors, key=lambda x: x["percentChange"])[:5]

    return {
        "laggards": laggards,
        "benchmark": heatmap.get("benchmark"),
    }


@router.get("/{sector_name}/stocks")
async def get_sector_stocks(sector_name: str):
    """
    Get stocks in a specific sector index.

    Args:
        sector_name: Sector short name (e.g., BANK, IT, PHARMA)
    """
    # Find the full index name
    index_name = None
    sector_info = None

    for idx_name, info in SECTOR_INDICES.items():
        if info["short"].upper() == sector_name.upper():
            index_name = idx_name
            sector_info = info
            break

    if not index_name:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_name}' not found")

    # Check cache
    cache_key = sector_stocks_key(sector_name.upper())
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch stocks
    stocks_data = await fetch_index_stocks(index_name)

    if not stocks_data:
        raise HTTPException(status_code=503, detail=f"Unable to fetch stocks for {index_name}")

    # Process stocks
    stocks = []
    for stock in stocks_data:
        symbol = stock.get("symbol")
        if not symbol or symbol == index_name:  # Skip index itself
            continue

        stocks.append({
            "symbol": symbol,
            "name": stock.get("identifier", symbol),
            "lastPrice": stock.get("lastPrice", 0),
            "change": stock.get("change", 0),
            "percentChange": stock.get("pChange", 0),
            "open": stock.get("open", 0),
            "high": stock.get("dayHigh", 0),
            "low": stock.get("dayLow", 0),
            "previousClose": stock.get("previousClose", 0),
            "volume": stock.get("totalTradedVolume", 0),
        })

    # Sort by percentage change
    stocks.sort(key=lambda x: x["percentChange"], reverse=True)

    result = {
        "sectorName": sector_info["name"],
        "indexName": index_name,
        "stocks": stocks,
        "stockCount": len(stocks),
        "advancing": sum(1 for s in stocks if s["percentChange"] > 0),
        "declining": sum(1 for s in stocks if s["percentChange"] < 0),
    }

    # Cache for 5 minutes
    cache.set(cache_key, result, TTL_SECTOR_DATA)

    return result


@router.get("/rotation")
async def get_sector_rotation():
    """
    Get detailed sector rotation analysis.
    Provides market phase detection and rotation insights.
    """
    heatmap = await get_sector_heatmap()

    return {
        "rotation": heatmap.get("rotation"),
        "summary": heatmap.get("summary"),
        "benchmark": heatmap.get("benchmark"),
        "topSectors": heatmap.get("sectors", [])[:5],
        "bottomSectors": heatmap.get("sectors", [])[-5:] if heatmap.get("sectors") else [],
    }
