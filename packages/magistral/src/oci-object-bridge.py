#!/usr/bin/env python3
"""OCI Object Storage adapter for Magistral byte custody.

Restricted operations: get, immutable put, and read-only namespace probe.
Does not create buckets, alter IAM, log secrets or list remote objects.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import sqlite3
import datetime

SHA256 = re.compile(r"^sha256:[a-f0-9]{64}$")


def output(**fields):
    print(json.dumps(fields, sort_keys=True), flush=True)


class RequestBudgetExceeded(Exception):
    """The local monthly request reserve would exceed its conservative cap."""


def reserve_request_budget(db_path, cap, maximum_requests, region, month=None):
    """Atomically reserve an upper bound on Object Storage API requests.

    Reservations are never refunded after failures, so aborts and retries
    only reduce the remaining allowance. Every instance sharing this ledger
    serializes through SQLite BEGIN IMMEDIATE.
    """
    if not os.path.isabs(db_path) or not 1 <= cap <= 1000:
        raise ValueError("invalid_request_budget")
    if maximum_requests < 1 or maximum_requests > 3:
        raise ValueError("invalid_request_reservation")
    month = month or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")
    directory = os.path.dirname(os.path.abspath(db_path))
    os.makedirs(directory, mode=0o700, exist_ok=True)
    old_umask = os.umask(0o077)
    try:
        with sqlite3.connect(db_path, timeout=8, isolation_level=None) as db:
            db.execute("PRAGMA busy_timeout = 8000")
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                "CREATE TABLE IF NOT EXISTS requests "
                "(month TEXT NOT NULL, region TEXT NOT NULL, "
                "reserved INTEGER NOT NULL, PRIMARY KEY (month,region))"
            )
            row = db.execute(
                "SELECT reserved FROM requests WHERE month=? AND region=?",
                (month, region)
            ).fetchone()
            used = row[0] if row else 0
            if used + maximum_requests > cap:
                db.execute("ROLLBACK")
                raise RequestBudgetExceeded("monthly_request_budget_exhausted")
            db.execute(
                "INSERT INTO requests(month,region,reserved) VALUES(?,?,?) "
                "ON CONFLICT(month,region) DO UPDATE SET reserved=excluded.reserved",
                (month, region, used + maximum_requests)
            )
            db.execute("COMMIT")
            return {"month": month, "reserved": used + maximum_requests, "cap": cap}
    finally:
        os.umask(old_umask)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["probe", "get", "put"])
    parser.add_argument("--auth", choices=["instance_principal", "config"], required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--bucket")
    parser.add_argument("--namespace")
    parser.add_argument("--ref")
    parser.add_argument("--file")
    parser.add_argument("--max-bytes", type=int, default=64 * 1024 * 1024)
    parser.add_argument("--request-budget-db")
    parser.add_argument("--monthly-request-cap", type=int)
    args = parser.parse_args()

    if args.operation != "probe":
        if not args.bucket or not re.fullmatch(r"[a-zA-Z0-9_.-]{1,255}", args.bucket):
            raise ValueError("invalid_bucket_name")
        if not args.ref or not SHA256.fullmatch(args.ref):
            raise ValueError("invalid_object_ref")
        if not args.file or not os.path.isabs(args.file):
            raise ValueError("invalid_local_file")
    if args.max_bytes < 1:
        raise ValueError("invalid_max_bytes")

    # Charge the conservative worst-case number of *Object Storage* calls
    # before touching credentials or contacting the cloud.
    if args.operation in ("get", "put"):
        if args.request_budget_db is None or args.monthly_request_cap is None:
            raise ValueError("missing_request_budget")
        reserve_request_budget(
            args.request_budget_db, args.monthly_request_cap,
            3 if args.operation == "put" else 2, args.region
        )

    import oci

    if args.auth == "instance_principal":
        signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
        cfg = {"region": args.region}
        kwargs = {"signer": signer}
    else:
        cfg = oci.config.from_file()
        cfg["region"] = args.region
        kwargs = {}

    client = oci.object_storage.ObjectStorageClient(
        cfg, timeout=(4, 12),
        retry_strategy=oci.retry.NoneRetryStrategy(),
        **kwargs
    )
    namespace = args.namespace or client.get_namespace(
        retry_strategy=oci.retry.NoneRetryStrategy()
    ).data

    if args.operation == "probe":
        output(ok=True, namespace_available=bool(namespace), auth=args.auth)
        return 0

    digest = args.ref.split(":", 1)[1]
    key = "sha256/" + digest[:2] + "/" + digest[2:]

    if args.operation == "put":
        with open(args.file, "rb") as handle:
            payload = handle.read(args.max_bytes + 1)
        if len(payload) > args.max_bytes:
            raise ValueError("object_exceeds_limit")
        if hashlib.sha256(payload).hexdigest() != digest:
            raise ValueError("local_integrity_mismatch")
        try:
            client.put_object(
                namespace, args.bucket, key, payload,
                if_none_match="*",
                retry_strategy=oci.retry.NoneRetryStrategy(),
            )
        except oci.exceptions.ServiceError as exc:
            if exc.status != 412:
                raise
            existing = client.get_object(
                namespace, args.bucket, key,
                retry_strategy=oci.retry.NoneRetryStrategy(),
            ).data.content
            if hashlib.sha256(existing).hexdigest() != digest:
                raise ValueError("remote_integrity_mismatch")
        output(ok=True, ref=args.ref, size_bytes=len(payload), verified=True)
        return 0

    try:
        response = client.get_object(
            namespace, args.bucket, key,
            retry_strategy=oci.retry.NoneRetryStrategy(),
        )
    except oci.exceptions.ServiceError as exc:
        if exc.status == 404:
            output(ok=True, found=False)
            return 0
        raise

    advertised = response.headers.get("content-length")
    if advertised is not None and int(advertised) > args.max_bytes:
        raise ValueError("object_exceeds_limit")
    payload = response.data.content
    if len(payload) > args.max_bytes:
        raise ValueError("object_exceeds_limit")
    if hashlib.sha256(payload).hexdigest() != digest:
        raise ValueError("remote_integrity_mismatch")
    fd = os.open(args.file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
    except BaseException:
        try:
            os.unlink(args.file)
        except FileNotFoundError:
            pass
        raise
    output(ok=True, found=True, ref=args.ref, size_bytes=len(payload))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        # Never log response bodies, API request identifiers or credentials.
        status = getattr(exc, "status", None)
        allowed = {
            "ValueError", "FileNotFoundError", "PermissionError",
            "ServiceError", "RequestException", "ConnectTimeout",
            "ReadTimeout", "ConfigFileNotFound", "RequestBudgetExceeded",
        }
        category = type(exc).__name__
        if category not in allowed:
            category = "backend_error"
        output(ok=False, error=category, http_status=status)
        sys.exit(2)
