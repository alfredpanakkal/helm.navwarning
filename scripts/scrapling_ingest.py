#!/usr/bin/env python3
"""
Helm.Warning - Scrapling-Powered Maritime Hydrographic Ingestion Engine
Powered by Scrapling (https://github.com/D4Vinci/Scrapling.git) by Karim Shoair (D4Vinci)

Key Features:
- Chrome TLS Fingerprint Impersonation via FetcherSession(impersonate='chrome')
- Anti-Bot & Cloudflare Turnstile Bypass via StealthySession(solve_cloudflare=True)
- Adaptive Element Relocation for changing government hydrographic layouts
- Segregated parameter output formatted for NAVAREA schemas (navarea_1 to navarea_21)
"""

import sys
import os
import re
import json
import hashlib
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional

# Supported Hydrographic Sources Registry
SOURCES = [
    {
        "source_id": "ukho-navarea-1",
        "publisher": "United Kingdom Hydrographic Office (UKHO)",
        "navarea": "I",
        "url": "https://msi.admiralty.co.uk/RadioNavigationalWarnings",
        "format": "html",
        "stealth": True,
    },
    {
        "source_id": "sma-baltic-subarea",
        "publisher": "Swedish Maritime Administration (SMA)",
        "navarea": "Baltic",
        "url": "https://www.sjofartsverket.se/en/services/navigational-warnings/",
        "format": "html",
        "stealth": False,
    },
    {
        "source_id": "nga-navarea-4-12",
        "publisher": "National Geospatial-Intelligence Agency (NGA)",
        "navarea": "IV",
        "url": "https://msi.nga.mil/NavWarnings",
        "format": "html",
        "stealth": True,
    },
    {
        "source_id": "amsa-navarea-10",
        "publisher": "Australian Maritime Safety Authority (AMSA)",
        "navarea": "X",
        "url": "https://www.amsa.gov.au/safety-navigation/navigation-systems/maritime-safety-information",
        "format": "html",
        "stealth": False,
    },
    {
        "source_id": "kystverket-navarea-19",
        "publisher": "Kystverket (Norwegian Coastal Administration)",
        "navarea": "XIX",
        "url": "https://kystverket.no/en/navigation-and-fairways/navigational-warnings/",
        "format": "html",
        "stealth": False,
    },
]

def get_navarea_schema(navarea: str) -> str:
    clean = (navarea or '').strip().upper()
    if clean == 'BALTIC':
        return 'navarea_baltic'
    roman_map = {
        'I': 'navarea_1', 'II': 'navarea_2', 'III': 'navarea_3', 'IV': 'navarea_4',
        'V': 'navarea_5', 'VI': 'navarea_6', 'VII': 'navarea_7', 'VIII': 'navarea_8',
        'IX': 'navarea_9', 'X': 'navarea_10', 'XI': 'navarea_11', 'XII': 'navarea_12',
        'XIII': 'navarea_13', 'XIV': 'navarea_14', 'XV': 'navarea_15', 'XVI': 'navarea_16',
        'XVII': 'navarea_17', 'XVIII': 'navarea_18', 'XIX': 'navarea_19', 'XX': 'navarea_20',
        'XXI': 'navarea_21'
    }
    return roman_map.get(clean, f"navarea_{clean.lower()}")

def parse_coordinates_from_text(text: str) -> Dict[str, Any]:
    """Extract coordinates and format into GeoJSON geometry."""
    # Pattern: 51-12.4N 001-23.8E or 51°12'N 001°23'E or decimal
    dms_pattern = r'(\d{1,2})[°\-\s]+(\d{1,2}(?:\.\d+)?)\'?\s*([NS])\s*[,\s]+(\d{1,3})[°\-\s]+(\d{1,2}(?:\.\d+)?)\'?\s*([EW])'
    matches = re.findall(dms_pattern, text, re.IGNORECASE)
    
    geometries = []
    first_lat = None
    first_lng = None

    for m in matches:
        lat_deg = float(m[0]) + float(m[1]) / 60.0
        if m[2].upper() == 'S':
            lat_deg = -lat_deg
            
        lng_deg = float(m[3]) + float(m[4]) / 60.0
        if m[5].upper() == 'W':
            lng_deg = -lng_deg

        if first_lat is None:
            first_lat = round(lat_deg, 6)
            first_lng = round(lng_deg, 6)

        geometries.append({
            "type": "Point",
            "coordinates": [round(lng_deg, 6), round(lat_deg, 6)]
        })

    if len(geometries) >= 3:
        # Construct polygon ring
        ring = [g["coordinates"] for g in geometries]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        return {
            "latitude": first_lat,
            "longitude": first_lng,
            "spatial": {
                "geometries": [{
                    "type": "Polygon",
                    "coordinates": [ring]
                }]
            }
        }
    elif len(geometries) == 2:
        return {
            "latitude": first_lat,
            "longitude": first_lng,
            "spatial": {
                "geometries": [{
                    "type": "LineString",
                    "coordinates": [g["coordinates"] for g in geometries]
                }]
            }
        }
    elif len(geometries) == 1:
        return {
            "latitude": first_lat,
            "longitude": first_lng,
            "spatial": {
                "geometries": geometries
            }
        }

    return {
        "latitude": None,
        "longitude": None,
        "spatial": None
    }

def fetch_source_content(source: Dict[str, Any], use_stealth: bool = True) -> tuple[str, str]:
    """
    Fetch target website using Scrapling fetchers.
    Uses StealthySession or FetcherSession with Chrome TLS fingerprinting.
    """
    url = source["url"]
    print(f"[Scrapling] Initiating fetch for {source['publisher']} -> {url}")

    try:
        from scrapling.fetchers import StealthySession, FetcherSession

        if use_stealth and source.get("stealth"):
            print("[Scrapling] Engaging StealthySession with Cloudflare solver...")
            with StealthySession(headless=True, solve_cloudflare=True) as session:
                page = session.fetch(url, google_search=False)
                html_content = page.text if hasattr(page, 'text') else str(page)
                return html_content, "scrapling-stealthy"
        else:
            print("[Scrapling] Engaging FetcherSession with Chrome TLS impersonation...")
            with FetcherSession(impersonate='chrome') as session:
                page = session.get(url, stealthy_headers=True)
                html_content = page.text if hasattr(page, 'text') else str(page)
                return html_content, "scrapling-fetcher"

    except ImportError:
        print("[Scrapling] Notice: scrapling Python package not loaded in this environment. Falling back to HTTP client.")
        import urllib.request
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            }
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            return content, "http-fallback"

def parse_bulletin_blocks(raw_html: str, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Split and adaptively parse navigational warnings."""
    # Strip HTML tags for clean telex text
    clean_text = re.sub(r'<[^>]+>', ' ', raw_html)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()

    blocks = re.split(r'(?=NAVAREA|WARNING|NOTICE)', clean_text, flags=re.IGNORECASE)
    parsed_warnings = []
    now_iso = datetime.utcnow().isoformat() + "Z"
    date_str = datetime.utcnow().strftime("%Y-%m-%d")

    for idx, block in enumerate(blocks):
        block = block.strip()
        if len(block) < 30:
            continue

        # Extract Warning Number and Year
        num_match = re.search(r'\b(\d{1,5})[/-](\d{2,4})\b', block)
        if num_match:
            warn_num = num_match.group(1)
            raw_yr = int(num_match.group(2))
            warn_year = 2000 + raw_yr if raw_yr < 100 else raw_yr
            ref_id = f"{warn_num}/{warn_year % 100}"
        else:
            warn_num = str(idx + 1)
            warn_year = datetime.utcnow().year
            ref_id = f"{warn_num}/{warn_year % 100}"

        # Coordinate parsing
        coord_info = parse_coordinates_from_text(block)

        # Cancellation notice detection
        cancel_match = re.search(r'CANCELS?\s+(?:NAVAREA\s+[A-Z0-9-]+\s+)?(\d+[\/-]\d+|\d+)', block, re.IGNORECASE)
        is_cancelled = bool(cancel_match)
        cancel_text = cancel_match.group(0) if cancel_match else None

        # Hazard category detection
        upper_text = block.upper()
        if any(w in upper_text for w in ['LIGHT', 'BUOY', 'BEACON', 'EXTINGUISHED']):
            category = 'aton'
        elif any(w in upper_text for w in ['GUNNERY', 'FIRING', 'MISSILE', 'EXERCISE']):
            category = 'military'
        elif any(w in upper_text for w in ['CABLE', 'PIPELINE', 'SURVEY', 'TRENCHING']):
            category = 'subsea'
        elif any(w in upper_text for w in ['DRIFTING', 'MINE', 'DERELICT', 'CONTAINER']):
            category = 'drifting'
        elif any(w in upper_text for w in ['RIG', 'PLATFORM', 'DRILLING']):
            category = 'offshore'
        else:
            category = 'general'

        # Chart reference
        chart_match = re.search(r'\b(?:CHART|CHARTS|BA|INT|NO)\s+([A-Z0-9\s,/-]+?)(?=\.|\n|$)', block, re.IGNORECASE)
        chart_ref = chart_match.group(0).strip() if chart_match else None

        sha256 = hashlib.sha256(block.encode('utf-8')).hexdigest()
        schema_name = get_navarea_schema(source["navarea"])

        warning_record = {
            "warning_id": f"warn-{source['source_id']}-{ref_id.replace('/', '-')}",
            "source_id": source["source_id"],
            "publisher_id": source["source_id"].split('-')[0],
            "navarea": source["navarea"],
            "target_schema": schema_name,
            "source_warning_id": ref_id,
            "series": f"NAVAREA {source['navarea']}",
            "warning_number": warn_num,
            "warning_year": warn_year,
            "title": f"NAVAREA {source['navarea']} {ref_id}",
            "authority": source["publisher"],
            "sub_area": f"NAVAREA {source['navarea']}",
            "issued_date": date_str,
            "issued_text": date_str,
            "issued_at": now_iso,
            "status": "cancelled" if is_cancelled else "active",
            "status_basis": "explicit_cancellation_notice" if is_cancelled else "complete_in_force_publication",
            "is_cancelled": is_cancelled,
            "cancellation_text": cancel_text,
            "hazard_category": category,
            "category": category,
            "risk_level": "low" if is_cancelled else ("critical" if category in ['military', 'drifting'] else "high"),
            "charts": chart_ref,
            "latitude": coord_info["latitude"],
            "longitude": coord_info["longitude"],
            "spatial": coord_info["spatial"],
            "raw_text": block[:4000],
            "source_url": source["url"],
            "extraction_method": "scrapling_adaptive",
            "checksum_sha256": sha256,
        }
        parsed_warnings.append(warning_record)

    return parsed_warnings

def run_scrapling_pipeline(navarea_filter: Optional[str] = None, output_file: Optional[str] = None, sync_supabase: bool = False):
    """Executes the Scrapling web scraping process across hydrographic sources."""
    print("=" * 70)
    print("HELM.WARNING - SCRAPLING MARITIME INGESTION PIPELINE")
    print("Framework: D4Vinci/Scrapling (Adaptive + StealthyFetcher)")
    print("=" * 70)

    target_sources = SOURCES
    if navarea_filter:
        target_sources = [s for s in SOURCES if s["navarea"].upper() == navarea_filter.upper()]

    all_warnings = []
    all_artifacts = []

    for src in target_sources:
        try:
            content, engine = fetch_source_content(src)
            content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

            artifact = {
                "artifact_id": f"art-{src['source_id']}-{int(datetime.utcnow().timestamp())}",
                "source_id": src["source_id"],
                "navarea": src["navarea"],
                "path": src["url"],
                "content_hash": content_hash,
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "engine": engine,
                "size_bytes": len(content),
            }
            all_artifacts.append(artifact)

            warnings = parse_bulletin_blocks(content, src)
            print(f"[{src['source_id']}] Extracted {len(warnings)} individual notices for NAVAREA {src['navarea']}.")
            all_warnings.extend(warnings)

        except Exception as e:
            print(f"[{src['source_id']}] Fetch failed: {e}")

    summary = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "engine": "D4Vinci/Scrapling",
        "total_sources": len(target_sources),
        "total_artifacts": len(all_artifacts),
        "total_warnings": len(all_warnings),
        "by_navarea": {},
        "warnings": all_warnings
    }

    for w in all_warnings:
        area = w["navarea"]
        summary["by_navarea"][area] = summary["by_navarea"].get(area, 0) + 1

    print("\n" + "=" * 70)
    print(f"EXTRACTION SUMMARY: {len(all_warnings)} warnings parsed across {len(target_sources)} sources.")
    for area, cnt in summary["by_navarea"].items():
        schema = get_navarea_schema(area)
        print(f"  • NAVAREA {area:6} -> Schema: {schema:18} -> {cnt} warnings")
    print("=" * 70)

    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)
        print(f"\n[Scrapling] Results exported to {output_file}")

    if sync_supabase and all_warnings:
        supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
        supabase_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
            os.environ.get("SUPABASE_SECRET_KEY") or
            os.environ.get("SUPABASE_KEY") or
            os.environ.get("SUPABASE_ANON_KEY")
        )

        if supabase_url and supabase_key:
            print("\n[Scrapling -> Supabase] Syncing extracted warnings to Supabase PostgreSQL...")
            import urllib.request
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            }

            # 1. Sync raw_messages
            raw_rows = [{
                "warning_id": w["source_warning_id"],
                "source_id": w["source_id"],
                "full_raw_text": w["raw_text"],
                "subject_header": w["title"],
                "checksum_sha256": w["checksum_sha256"]
            } for w in all_warnings if w.get("raw_text")]

            try:
                msg_req = urllib.request.Request(
                    f"{supabase_url.rstrip('/')}/rest/v1/raw_messages",
                    data=json.dumps(raw_rows).encode('utf-8'),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(msg_req, timeout=30) as resp:
                    print(f"[Scrapling -> Supabase] Successfully posted {len(raw_rows)} raw messages.")
            except Exception as e:
                print(f"[Scrapling -> Supabase Notice] raw_messages post: {e}")

            # 2. Sync nav_warnings master table
            payload = [{
                "source_id": w["source_id"],
                "warning_id": w["source_warning_id"],
                "publisher_id": w["publisher_id"],
                "series": w["series"],
                "warning_number": w["warning_number"],
                "warning_year": w["warning_year"],
                "title": w["title"],
                "raw_text": w["raw_text"],
                "issued_date": w["issued_date"],
                "issued_text": w["issued_text"],
                "issued_at": w["issued_at"],
                "navarea": w["navarea"],
                "area_text": w["sub_area"],
                "sub_area": w["sub_area"],
                "authority": w["authority"],
                "source_url": w["source_url"],
                "risk_level": w["risk_level"],
                "extraction_method": w["extraction_method"],
                "latitude": w["latitude"],
                "longitude": w["longitude"],
                "charts": w["charts"],
                "category": w["category"],
                "hazard_category": w["hazard_category"],
                "spatial": w["spatial"],
                "is_cancelled": w["is_cancelled"],
                "cancellation_text": w["cancellation_text"],
                "status": w["status"],
                "status_basis": w["status_basis"],
                "updated_at": datetime.utcnow().isoformat() + "Z",
            } for w in all_warnings]

            CHUNK = 50
            for i in range(0, len(payload), CHUNK):
                chunk = payload[i:i + CHUNK]
                try:
                    warn_req = urllib.request.Request(
                        f"{supabase_url.rstrip('/')}/rest/v1/nav_warnings?on_conflict=source_id,warning_id",
                        data=json.dumps(chunk).encode('utf-8'),
                        headers=headers,
                        method="POST"
                    )
                    with urllib.request.urlopen(warn_req, timeout=30) as resp:
                        print(f"[Scrapling -> Supabase] Upserted batch {i + 1}..{i + len(chunk)} into public.nav_warnings.")
                except Exception as e:
                    print(f"[Scrapling -> Supabase Error] Batch {i} failed: {e}")
        else:
            print("[Scrapling -> Supabase] Notice: SUPABASE_URL and SUPABASE_KEY not provided. Skipping database sync.")

    return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrapling Maritime Ingestion Pipeline")
    parser.add_argument("--navarea", type=str, help="Filter by specific NAVAREA (e.g. I, IV, X, XIX)")
    parser.add_argument("--output", type=str, help="Output JSON path")
    parser.add_argument("--sync-supabase", action="store_true", help="Sync parsed warnings to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Perform extraction without remote database writes")
    args = parser.parse_args()

    sync_flag = args.sync_supabase and not args.dry_run
    run_scrapling_pipeline(navarea_filter=args.navarea, output_file=args.output, sync_supabase=sync_flag)

