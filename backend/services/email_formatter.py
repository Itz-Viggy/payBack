# email_formatter.py
# Formats the dispute letter body using the case data and prompt output.
# Builds subject, body, and attachments for the dispute email.


def format_currency(amount):
    """Format number as USD for letter body."""
    if amount is None:
        return "N/A"
    return f"${amount:,.2f}"


def format_date_short(iso_date_str):
    """Format YYYY-MM-DD for display."""
    if not iso_date_str:
        return ""
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(iso_date_str.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y")
    except Exception:
        return iso_date_str


def _today_str():
    from datetime import date
    return date.today().strftime("%B %d, %Y")


def format_draft_to_letter(draft):
    """
    Build plain-text dispute letter from frontend draft.
    draft: dict with recipient, subject, selectedItems, patientDetails, report, lawsCited.
    Returns: (subject, body_plain).
    """
    subject = draft.get("subject") or "Formal Billing Dispute"
    patient = draft.get("patientDetails") or {}
    report = draft.get("report") or {}
    items = draft.get("selectedItems") or []
    recipient = draft.get("recipient") or ""

    name = patient.get("fullName") or "[PATIENT NAME]"
    address = patient.get("mailingAddress") or "[MAILING ADDRESS]"
    state = patient.get("state") or "[STATE]"
    account = report.get("accountNumber") or "[ACCOUNT]"
    date_of_service = format_date_short(report.get("dateOfService") or "")

    lines = [
        name,
        address,
        state,
        "",
        _today_str(),
        "",
        f"To: {recipient}",
        "",
        f"Re: Formal Billing Dispute - Account #{account}",
        f"Date of Service: {date_of_service}",
        "",
        "I am submitting a formal dispute for the following billed services. The identified charges appear "
        "materially above benchmark and require itemized justification or adjustment.",
        "",
    ]

    for item in items:
        billed = format_currency(item.get("billed"))
        cpt = item.get("cptCode") or ""
        desc = item.get("description") or ""
        lines.append(f"  • {cpt} {desc} — {billed}")

    lines.extend([
        "",
        "Please investigate these charges and issue a corrected statement within a reasonable timeframe. "
        "Written response is requested.",
        "",
        "Sincerely,",
        name,
    ])

    body = "\n".join(lines)
    return subject, body
