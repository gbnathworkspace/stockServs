import time
from typing import Dict, List, Any, Tuple

import pandas as pd
import yfinance as yf


_CACHE: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = {
    "5m": 60,
    "15m": 120,
    "1d": 600,
}

_ALLOWED_INTERVALS = {"5m", "15m", "1d"}
_ALLOWED_PERIODS = {
    "5m": {"1d", "5d", "1mo"},
    "15m": {"1d", "5d", "1mo"},
    "1d": {"1mo", "3mo", "6mo", "1y", "2y", "max"},
}


def _cache_key(symbol: str, interval: str, period: str) -> Tuple[str, str, str]:
    return (symbol.upper(), interval, period)


def _get_cache_ttl(interval: str) -> int:
    return _CACHE_TTL_SECONDS.get(interval, 120)


def _get_cached(symbol: str, interval: str, period: str):
    key = _cache_key(symbol, interval, period)
    cached = _CACHE.get(key)
    if not cached:
        return None
    if time.time() - cached["ts"] > _get_cache_ttl(interval):
        _CACHE.pop(key, None)
        return None
    return cached["data"]


def _set_cached(symbol: str, interval: str, period: str, data: dict) -> None:
    key = _cache_key(symbol, interval, period)
    _CACHE[key] = {"ts": time.time(), "data": data}


def _compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _extract_time(value) -> int:
    ts = pd.to_datetime(value)
    if ts.tzinfo is not None:
        ts = ts.tz_convert("UTC").tz_localize(None)
    return int(ts.timestamp())


def _build_series(
    df: pd.DataFrame,
    value_col: str,
    time_col: str,
) -> List[Dict[str, Any]]:
    items = []
    for _, row in df.iterrows():
        value = row.get(value_col)
        if pd.isna(value):
            continue
        items.append({"time": _extract_time(row[time_col]), "value": float(value)})
    return items


def get_candles(symbol: str, interval: str = "5m", period: str = "5d") -> Dict[str, Any]:
    if not symbol:
        raise ValueError("symbol is required")

    interval = interval.lower()
    period = period.lower()

    if interval not in _ALLOWED_INTERVALS:
        raise ValueError("interval must be one of 5m, 15m, 1d")
    if period not in _ALLOWED_PERIODS.get(interval, set()):
        raise ValueError("period not supported for interval")

    cached = _get_cached(symbol, interval, period)
    if cached:
        return cached

    ticker = yf.Ticker(f"{symbol.upper()}.NS")
    history = ticker.history(period=period, interval=interval, auto_adjust=False)
    if history is None or history.empty:
        raise ValueError("no data available for symbol")

    history = history.dropna(subset=["Open", "High", "Low", "Close"]).copy()
    history = history.tail(500)
    history.reset_index(inplace=True)
    time_col = "Datetime" if "Datetime" in history.columns else "Date"

    history["sma20"] = history["Close"].rolling(20).mean()
    history["ema20"] = history["Close"].ewm(span=20, adjust=False).mean()
    history["rsi14"] = _compute_rsi(history["Close"], 14)

    candles = []
    volume = []

    for _, row in history.iterrows():
        ts = _extract_time(row[time_col])
        open_val = float(row["Open"])
        close_val = float(row["Close"])
        candles.append(
            {
                "time": ts,
                "open": open_val,
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": close_val,
            }
        )
        vol_value = row.get("Volume")
        if pd.isna(vol_value):
            continue
        volume.append(
            {
                "time": ts,
                "value": int(vol_value),
                "color": "#00d09c" if close_val >= open_val else "#ff4d4d",
            }
        )

    data = {
        "symbol": symbol.upper(),
        "interval": interval,
        "period": period,
        "candles": candles,
        "volume": volume,
        "indicators": {
            "sma20": _build_series(history, "sma20", time_col),
            "ema20": _build_series(history, "ema20", time_col),
            "rsi14": _build_series(history, "rsi14", time_col),
        },
    }

    _set_cached(symbol, interval, period, data)
    return data
