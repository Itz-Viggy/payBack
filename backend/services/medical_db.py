import json
import requests
import urllib.parse
import time

# --- YOUR OCR BILL DATA ---
incoming_bill = {
  "patient_name": "Marcus D. Holloway",
  "account_number": "TGH-2025-084471",
  "facility": "Tampa General Hospital",
  "bill_date": "2025-04-14",
  "total_billed": 51444.0,
  "insurance": "BlueCross BlueShield of FL",
  "line_items": [
    { "line_item_id": 1, "cpt_code": "99223", "description": "Initial Hospital Care", "unit_price": 1420.0 },
    { "line_item_id": 2, "cpt_code": "71046", "description": "Chest X-Ray, 2 Views", "unit_price": 890.0 },
    { "line_item_id": 31, "cpt_code": "0100", "description": "Room & Board — Med/Surg", "unit_price": 3800.0 }
    # Truncated for testing - add the rest of your 35 items here!
  ]
}

BASE_URL = "https://www.dolthub.com/api/v1alpha1/dolthub/transparency-in-pricing/main"

def run_dolt_query(sql_query, timeout_val=30): # ADDED: adjustable timeout parameter
    """Executes the SQL query against the remote database."""
    safe_query = urllib.parse.quote(sql_query)
    url = f"{BASE_URL}?q={safe_query}"
    
    # REMOVED the broad try/except here so the timeout can be caught by the loop below!
    response = requests.get(url, timeout=timeout_val)
    if response.status_code == 200:
        return response.json()
        
    return {"rows": []}

def get_benchmarks(code, insurance_payer):
    """Fetches a fast batch of pricing data and filters by insurance in Python."""
    
    search_column = "code"
    short_payer = insurance_payer.split()[0].lower() # e.g., "bluecross"
    
    print(f"   ↳ Fetching rapid batch for {search_column}: {code}...")
    
    rows = []
    
    # --- ADDED: The Retry Loop ---
    for limit in [10, 5,3]:
        fast_query = f"""
            SELECT hospital_id, payer_name, standard_charge
            FROM `rate`
            WHERE `code` = '{code}'
            LIMIT {limit};
        """
        
        try:
            # We use a 5-second timeout so it fails fast and triggers the retry
            results = run_dolt_query(fast_query, timeout_val=30)
            rows = results.get("rows", [])
            break # Success! Break out of the retry loop.
            
        except requests.exceptions.Timeout:
            print(f"   ↳ [WARNING] Timeout on LIMIT {limit}. Retrying with lower limit...")
            continue # Try the next limit in the list
        except Exception as e:
            print(f"   ↳ [ERROR] API Failed: {e}")
            break # Stop trying if it's a completely different error
    # -----------------------------
    
    if not rows:
        print(f"   ↳ Critical: No data found for code {code}.")
        return []

    # 1. Look for the exact insurance match first
    specific_matches = [
        row for row in rows 
        if short_payer in str(row.get("payer_name", "")).lower()
    ]

    if specific_matches:
        print(f"   ↳ Success! Found specific rates for {short_payer.capitalize()}.")
        # Sort and return the specific matches
        for i, match in enumerate(specific_matches):
             print(f"        -> Match {i+1}: {match.get('payer_name')} | ${match.get('standard_charge')}")

        return sorted(specific_matches, key=lambda x: float(x["standard_charge"]))[:3]
        
    else:
        # 2. THE NEW LOGIC: Calculate the Market Average
        print(f"   ↳ No exact match for '{insurance_payer}'. Calculating market average from {len(rows)} rates...")
        
        valid_charges = []
        for row in rows:
            charge = row.get("standard_charge")
            if charge is not None:
                # Always safely cast to float in case the DB returned a string or integer
                try:
                    valid_charges.append(float(charge))
                except ValueError:
                    continue # Skip any weird data
        
        # If we successfully extracted numbers, calculate the mean
        if valid_charges:
            average_charge = sum(valid_charges) / len(valid_charges)
            
            print(f"[DEBUG] 🏆 FINAL SYNTHESIZED RATE: ${average_charge:.2f}")

            # Return a 'synthesized' dictionary that perfectly mimics your DB structure
            return [{
                "hospital_id": "Various (Market Average)",
                "payer_name": "Market Average (Estimated)",
                "standard_charge": round(average_charge, 2)
            }]
            
        return []

def process_entire_bill(bill_json):
    """Loops through the JSON array and builds the final AI payload."""
    
    facility = bill_json.get("facility", "Unknown")
    insurance = bill_json.get("insurance", "Unknown")
    
    print(f"\n=== 🏥 STARTING AUDIT: {facility} | {insurance} ===\n")
    
    audited_items = []
    
    # Iterate through the JSON array
    for item in bill_json.get("line_items", []):
        code = item.get("cpt_code")
        print(f"Processing: {code} - {item.get('description')}")
        
        benchmarks = get_benchmarks(code, insurance)
        
        audited_items.append({
            "billed_item": item,
            "market_benchmarks": benchmarks
        })
        
        
    final_payload = {
        "metadata": {
            "patient": bill_json.get("patient_name"),
            "account": bill_json.get("account_number"),
            "total_billed": bill_json.get("total_billed")
        },
        "audited_items": audited_items
    }
    
    print("\n=== ✅ AUDIT COMPLETE. GENERATING AI PAYLOAD ===")
    return final_payload

# # Run the batch process
# final_ai_context = process_entire_bill(incoming_bill)

# # Print the final result that you will pass to GPT-4o
# print(json.dumps(final_ai_context, indent=2))