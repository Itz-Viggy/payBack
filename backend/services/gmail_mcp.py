# gmail_mcp.py
# Sends dispute emails via Gmail API using the user's OAuth access token.
# The frontend obtains the token (e.g. via "Connect Gmail") and sends it with the draft.

import base64
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def send_dispute_email(access_token: str, to: str, subject: str, body_plain: str) -> dict:
    """
    Send one email via Gmail API as the authenticated user.
    access_token: OAuth2 access token with scope https://www.googleapis.com/auth/gmail.send
    to: recipient email (hospital billing)
    subject: email subject
    body_plain: plain-text body of the dispute letter.
    Returns: Gmail API message dict (includes id, threadId, etc.) or raises on error.
    """
    creds = Credentials(token=access_token)
    service = build("gmail", "v1", credentials=creds)

    message = MIMEText(body_plain, "plain", "utf-8")
    message["to"] = to
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return sent
