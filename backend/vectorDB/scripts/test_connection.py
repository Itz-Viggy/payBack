#!/usr/bin/env python3
"""
Test connection to VectorAI DB at localhost:50051.
Prints version and uptime on success; exits non-zero on failure.

Usage:
    python backend/vectorDB/scripts/test_connection.py
"""

import os
import sys


def main() -> int:
    addr = os.getenv("CORTEX_SERVER", "localhost:50051")
    print(f"Connecting to VectorAI DB at {addr} ...")

    try:
        from cortex import CortexClient
    except ImportError as e:
        err = str(e)
        if "runtime_version" in err or "protobuf" in err.lower():
            print("ERROR: actiancortex needs protobuf>=5.29.2 (Gemini currently pulls 4.x).")
            print("  Try: pip install 'protobuf>=5.29.2'")
            print("  If Gemini then fails, use a separate venv for vector DB scripts.")
        else:
            print("ERROR: Actian VectorAI DB Python client not found.")
            print("  From backend/: pip install vectorDB/actiancortex-0.1.0b1-py3-none-any.whl --no-deps")
        return 1

    try:
        with CortexClient(addr) as client:
            version, uptime = client.health_check()
            print(f"Connected successfully.")
            print(f"  Version : {version}")
            print(f"  Uptime  : {uptime}")
    except Exception as exc:
        print(f"ERROR: Could not connect to VectorAI DB at {addr}")
        print(f"  {exc}")
        print("Make sure VectorAI DB is running (e.g. docker compose up -d).")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
