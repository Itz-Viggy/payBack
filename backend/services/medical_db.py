import asyncio
import json
import urllib.parse

import httpx

BASE_URL = "https://www.dolthub.com/api/v1alpha1/dolthub/transparency-in-pricing/main"

# Semaphore: cap concurrent outbound requests to avoid hammering the remote API
_SEMAPHORE = asyncio.Semaphore(15)


async def _run_dolt_query(client: httpx.AsyncClient, sql_query: str, timeout_val: float = 30.0) -> dict:
    """
    Execute a SQL query against the remote DoltHub API.
    Raises httpx.TimeoutException on timeout so the caller can retry.
    """
    safe_query = urllib.parse.quote(sql_query)
    url = f"{BASE_URL}?q={safe_query}"
    response = await client.get(url, timeout=timeout_val)
    if response.status_code == 200:
        return response.json()
    return {"rows": []}


async def get_benchmarks(client: httpx.AsyncClient, code: str, insurance_payer: str) -> list:
    """
    Fetch pricing benchmarks for a single CPT code.

    Cascading retry: tries LIMIT 10 → 5 → 2.
    If every attempt times out or fails, returns [].
    Falls back to a market-average synthesised rate when the exact
    insurance payer isn't found in the returned rows.
    """
    short_payer = insurance_payer.split()[0].lower()  # e.g. "bluecross"
    print(f"   ↳ Fetching benchmarks for code: {code} ...")

    rows = []

    # Cascading retry with decreasing LIMIT values
    async with _SEMAPHORE:
        for limit in [10, 5, 2]:
            query = f"""
                SELECT hospital_id, payer_name, standard_charge
                FROM `rate`
                WHERE `code` = '{code}'
                LIMIT {limit};
            """
            try:
                result = await _run_dolt_query(client, query, timeout_val=30.0)
                rows = result.get("rows", [])
                break  # Success — exit retry loop
            except httpx.TimeoutException:
                print(f"   ↳ [WARNING] Timeout on LIMIT {limit} for code {code}. Retrying...")
                continue  # Try next (smaller) limit
            except Exception as exc:
                print(f"   ↳ [ERROR] Unexpected failure for code {code}: {exc}")
                break  # Non-timeout error — don't bother retrying

    if not rows:
        print(f"   ↳ No data found for code {code}.")
        return []

    # 1. Look for an exact insurance match first
    specific_matches = [
        row for row in rows
        if short_payer in str(row.get("payer_name", "")).lower()
    ]

    if specific_matches:
        print(f"   ↳ Found specific rates for {short_payer.capitalize()} (code {code}).")
        return sorted(specific_matches, key=lambda x: float(x["standard_charge"]))[:3]

    # 2. No exact match — synthesise a market average from whatever rows we have
    print(f"   ↳ No exact match for '{insurance_payer}'. Calculating market average from {len(rows)} rates...")
    valid_charges = []
    for row in rows:
        charge = row.get("standard_charge")
        if charge is not None:
            try:
                valid_charges.append(float(charge))
            except ValueError:
                continue  # Skip malformed values

    if valid_charges:
        average_charge = sum(valid_charges) / len(valid_charges)
        print(f"   ↳ Synthesised market average: ${average_charge:.2f}")
        return [{
            "hospital_id": "Various (Market Average)",
            "payer_name": "Market Average (Estimated)",
            "standard_charge": round(average_charge, 2),
        }]

    return []


async def process_entire_bill(bill_json: dict) -> dict:
    """
    Concurrently audit every line item in the bill against the remote
    pricing database.

    Returns dict with:
      - metadata:        patient / account / total info
      - audited_items:   per-line-item billed vs benchmark
      - extracted_codes: flat list of CPT codes       (for DB storage)
      - standard_charges: flat list of benchmark dicts (for DB storage)
      - billed_charges:  flat list of patient_owed floats (for DB storage)
    """
    facility = bill_json.get("facility", "Unknown")
    insurance = bill_json.get("insurance", "Unknown")
    line_items = bill_json.get("line_items", [])

    print(f"\n=== 🏥 STARTING ASYNC AUDIT: {facility} | {insurance} ===\n")

    async with httpx.AsyncClient() as client:
        # Map every line item to a concurrent benchmark-lookup task
        tasks = [
            get_benchmarks(client, item.get("cpt_code"), insurance)
            for item in line_items
        ]
        # Fire all requests at the same time; semaphore inside get_benchmarks
        # prevents us from opening more than 15 connections simultaneously
        all_benchmarks = await asyncio.gather(*tasks)

    # Assemble the final payload from results
    audited_items = []
    extracted_codes = []
    standard_charges = []
    billed_charges = []

    for item, benchmarks in zip(line_items, all_benchmarks):
        code = item.get("cpt_code")
        patient_owed = float(item.get("patient_owed", 0) or 0)

        audited_items.append({
            "billed_item": item,
            "market_benchmarks": benchmarks,
        })
        extracted_codes.append(str(code) if code else "")
        standard_charges.append(benchmarks)
        billed_charges.append(patient_owed)

    final_payload = {
        "metadata": {
            "patient": bill_json.get("patient_name"),
            "account": bill_json.get("account_number"),
            "total_billed": bill_json.get("total_patient_billed") or bill_json.get("total_billed"),
        },
        "audited_items": audited_items,
        "extracted_codes": extracted_codes,
        "standard_charges": standard_charges,
        "billed_charges": billed_charges,
    }

    print("\n=== ✅ ASYNC AUDIT COMPLETE ===")
    return final_payload