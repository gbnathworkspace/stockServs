"""
Backfill historical FII/DII data into the database.

Scrapes daily FII/DII data from MoneyControl's AJAX endpoint
month-by-month and inserts into the database.

Usage:
    python scripts/backfill_fii_dii.py                         # Scrape last 12 months
    python scripts/backfill_fii_dii.py --months 24             # Scrape last 24 months
    python scripts/backfill_fii_dii.py --from-year 2024 --from-month 1  # From Jan 2024
    python scripts/backfill_fii_dii.py --csv path/to/file.csv  # Import from CSV
    python scripts/backfill_fii_dii.py --status                # Show DB status
"""

import argparse
import sys
import os
import re
import time
import asyncio
from datetime import datetime, date

import httpx

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from database.models import FiiDiiActivity
from nse_data.fii_dii import parse_numeric, parse_trade_date

# Reconfigure stdout for unicode support on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

MC_AJAX_URL = "https://www.moneycontrol.com/techmvc/responsive/fiidii/monthly"
MC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php",
}


def show_db_status():
    """Show current database status."""
    db = SessionLocal()
    try:
        count = db.query(FiiDiiActivity).count()
        oldest = (
            db.query(FiiDiiActivity)
            .order_by(FiiDiiActivity.trade_date.asc())
            .first()
        )
        newest = (
            db.query(FiiDiiActivity)
            .order_by(FiiDiiActivity.trade_date.desc())
            .first()
        )

        print(f"\n--- Database Status ---")
        print(f"Total records: {count}")
        if oldest:
            print(f"Oldest record: {oldest.trade_date}")
        if newest:
            print(f"Newest record: {newest.trade_date}")
        print(f"-----------------------\n")
        return count
    finally:
        db.close()


def parse_mc_html(html):
    """Parse MoneyControl AJAX HTML response to extract daily FII/DII data.

    Returns list of dicts with keys:
        trade_date, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net
    """
    records = []

    # Find all table rows with date data
    # Each row: <tr><td>DD-Mon-YYYY</td><td>FII Buy</td><td>FII Sell</td><td>FII Net</td><td>DII Buy</td><td>DII Sell</td><td>DII Net</td></tr>
    row_pattern = re.compile(
        r"<tr>\s*"
        r"<td[^>]*>(\d{1,2}-\w{3}-\d{4})\s*</a?\s*>\s*</td>\s*"
        r"<td[^>]*>([\d,.\-]+)</td>\s*"
        r"<td[^>]*>([\d,.\-]+)</td>\s*"
        r"<td[^>]*[^>]*>([\d,.\-]+)</td>\s*"
        r"<td[^>]*>([\d,.\-]+)</td>\s*"
        r"<td[^>]*>([\d,.\-]+)</td>\s*"
        r"<td[^>]*[^>]*>([\d,.\-]+)</td>",
        re.DOTALL,
    )

    for match in row_pattern.finditer(html):
        date_str, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net = match.groups()
        records.append({
            "date_str": date_str,
            "fii_buy": parse_numeric(fii_buy),
            "fii_sell": parse_numeric(fii_sell),
            "fii_net": parse_numeric(fii_net),
            "dii_buy": parse_numeric(dii_buy),
            "dii_sell": parse_numeric(dii_sell),
            "dii_net": parse_numeric(dii_net),
        })

    return records


def parse_mc_html_simple(html):
    """Simpler parsing approach - find dates then extract surrounding td values."""
    records = []

    # Split into rows
    rows = re.findall(r"<tr>(.*?)</tr>", html, re.DOTALL)
    for row in rows:
        tds = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(tds) < 7:
            continue

        # First td should contain a date
        date_match = re.search(r"(\d{1,2}-\w{3}-\d{4})", tds[0])
        if not date_match:
            continue

        date_str = date_match.group(1)
        # Clean HTML from values
        vals = []
        for td in tds[1:7]:
            clean = re.sub(r"<[^>]+>", "", td).strip()
            vals.append(clean)

        records.append({
            "date_str": date_str,
            "fii_buy": parse_numeric(vals[0]),
            "fii_sell": parse_numeric(vals[1]),
            "fii_net": parse_numeric(vals[2]),
            "dii_buy": parse_numeric(vals[3]),
            "dii_sell": parse_numeric(vals[4]),
            "dii_net": parse_numeric(vals[5]),
        })

    return records


def fetch_month_data(client, year, month):
    """Fetch daily FII/DII data for a specific month from MoneyControl."""
    params = {
        "month": month,
        "year": year,
        "section": "cash",
        "sub_section": "FII",
    }
    try:
        resp = client.get(MC_AJAX_URL, params=params, headers=MC_HEADERS)
        resp.raise_for_status()
        records = parse_mc_html_simple(resp.text)
        return records
    except Exception as e:
        print(f"  Error fetching {month:02d}/{year}: {e}")
        return []


def scrape_and_backfill(from_year, from_month, to_year, to_month):
    """Scrape MoneyControl month by month and insert into database."""
    db = SessionLocal()
    total_inserted = 0
    total_skipped = 0

    try:
        with httpx.Client(follow_redirects=True, timeout=20.0) as client:
            # Generate month range
            current_year, current_month = from_year, from_month

            while (current_year, current_month) <= (to_year, to_month):
                print(f"Fetching {current_month:02d}/{current_year}...", end=" ")
                records = fetch_month_data(client, current_year, current_month)

                inserted = 0
                skipped = 0

                for rec in records:
                    trade_date = parse_trade_date(rec["date_str"])
                    if not trade_date:
                        skipped += 1
                        continue

                    existing = (
                        db.query(FiiDiiActivity)
                        .filter(FiiDiiActivity.trade_date == trade_date)
                        .first()
                    )
                    if existing:
                        skipped += 1
                        continue

                    activity = FiiDiiActivity(
                        trade_date=trade_date,
                        fii_buy_value=rec["fii_buy"],
                        fii_sell_value=rec["fii_sell"],
                        fii_net_value=rec["fii_net"],
                        dii_buy_value=rec["dii_buy"],
                        dii_sell_value=rec["dii_sell"],
                        dii_net_value=rec["dii_net"],
                        source_date_str=rec["date_str"],
                    )
                    db.add(activity)
                    inserted += 1

                if inserted > 0:
                    db.commit()

                print(f"{len(records)} days, +{inserted} new, {skipped} skipped")
                total_inserted += inserted
                total_skipped += skipped

                # Next month
                if current_month == 12:
                    current_month = 1
                    current_year += 1
                else:
                    current_month += 1

                # Rate limit
                time.sleep(0.5)

        print(f"\nDone! Inserted: {total_inserted}, Skipped: {total_skipped}")

    except Exception as e:
        db.rollback()
        print(f"\nError during backfill: {e}")
        raise
    finally:
        db.close()


def import_csv_to_db(csv_path):
    """Import FII/DII data from a CSV file."""
    import csv

    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        print(f"Found {len(rows)} rows in CSV")

        for row in rows:
            trade_date = None
            for col in ["Date", "date", "Trade Date", "trade_date", "DATE"]:
                if col in row:
                    trade_date = parse_trade_date(row[col])
                    break

            if not trade_date:
                skipped += 1
                continue

            existing = (
                db.query(FiiDiiActivity)
                .filter(FiiDiiActivity.trade_date == trade_date)
                .first()
            )
            if existing:
                skipped += 1
                continue

            fii_buy = fii_sell = fii_net = None
            dii_buy = dii_sell = dii_net = None

            for key, val in row.items():
                key_lower = key.lower().strip()
                if "fii" in key_lower or "fpi" in key_lower:
                    if "buy" in key_lower:
                        fii_buy = parse_numeric(val)
                    elif "sell" in key_lower:
                        fii_sell = parse_numeric(val)
                    elif "net" in key_lower:
                        fii_net = parse_numeric(val)
                elif "dii" in key_lower:
                    if "buy" in key_lower:
                        dii_buy = parse_numeric(val)
                    elif "sell" in key_lower:
                        dii_sell = parse_numeric(val)
                    elif "net" in key_lower:
                        dii_net = parse_numeric(val)

            if fii_net is None and fii_buy is not None and fii_sell is not None:
                fii_net = fii_buy - fii_sell
            if dii_net is None and dii_buy is not None and dii_sell is not None:
                dii_net = dii_buy - dii_sell

            activity = FiiDiiActivity(
                trade_date=trade_date,
                fii_buy_value=fii_buy,
                fii_sell_value=fii_sell,
                fii_net_value=fii_net,
                dii_buy_value=dii_buy,
                dii_sell_value=dii_sell,
                dii_net_value=dii_net,
                source_date_str=str(trade_date),
            )
            db.add(activity)
            inserted += 1

            if inserted % 50 == 0:
                db.commit()
                print(f"  Inserted {inserted} records...")

        db.commit()
        print(f"\nDone! Inserted: {inserted}, Skipped: {skipped}")

    except Exception as e:
        db.rollback()
        print(f"Error importing CSV: {e}")
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill FII/DII historical data")
    parser.add_argument("--csv", type=str, help="Path to CSV file to import")
    parser.add_argument("--status", action="store_true", help="Show current database status")
    parser.add_argument("--months", type=int, default=12, help="Number of months to scrape (default: 12)")
    parser.add_argument("--from-year", type=int, help="Start year (e.g., 2024)")
    parser.add_argument("--from-month", type=int, help="Start month (1-12)")
    args = parser.parse_args()

    if args.status:
        show_db_status()
        return

    if args.csv:
        if not os.path.exists(args.csv):
            print(f"Error: File not found: {args.csv}")
            sys.exit(1)
        import_csv_to_db(args.csv)
        show_db_status()
        return

    # Default: scrape from MoneyControl
    now = date.today()
    to_year = now.year
    to_month = now.month

    if args.from_year and args.from_month:
        from_year = args.from_year
        from_month = args.from_month
    else:
        # Go back N months
        total_months = now.year * 12 + now.month - args.months
        from_year = total_months // 12
        from_month = total_months % 12
        if from_month == 0:
            from_month = 12
            from_year -= 1

    print(f"Scraping MoneyControl FII/DII data from {from_month:02d}/{from_year} to {to_month:02d}/{to_year}")
    print()

    show_db_status()
    scrape_and_backfill(from_year, from_month, to_year, to_month)
    show_db_status()


if __name__ == "__main__":
    main()
