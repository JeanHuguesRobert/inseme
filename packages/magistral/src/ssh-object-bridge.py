#!/usr/bin/env python3
"""Minimal immutable content-addressed object store for personal SSH peers.

Invocation: python ssh-object-bridge.py probe | put <sha256:...> | get <sha256:...> | verify <sha256:...>
PUT: raw bytes on stdin, short JSON confirmation on stdout.
GET: raw bytes on stdout, exit 4 if absent.
This is NOT a general remote shell, object deletion API, or background agent.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

MAX_BYTES = 64 * 1024 * 1024
MIN_FREE_BYTES = 1024 * 1024 * 1024
BASE = Path(__file__).resolve().parent / "objects"


def ref_path(ref):
    if (
        len(ref) != 71 or not ref.startswith("sha256:")
        or any(c not in "0123456789abcdef" for c in ref[7:])
    ):
        raise ValueError("invalid_object_ref")
    hex_digest = ref[7:]
    return BASE / "sha256" / hex_digest[:2] / hex_digest[2:]


def read_checked(target, digest):
    if not target.is_file():
        return None
    if target.stat().st_size > MAX_BYTES:
        raise ValueError("object_exceeds_limit")
    with target.open("rb") as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("integrity_mismatch")
    return data


def main():
    if len(sys.argv) < 2:
        raise ValueError("missing_operation")
    operation = sys.argv[1]
    if operation == "probe" and len(sys.argv) == 2:
        BASE.mkdir(mode=0o700, parents=True, exist_ok=True)
        free = shutil.disk_usage(BASE).free
        print(json.dumps({
            "protocol": "magistral.ssh-cas/v0",
            "ok": True,
            "free_bytes": free,
            "minimum_free_bytes": MIN_FREE_BYTES,
            "max_object_bytes": MAX_BYTES,
        }), flush=True)
        return
    if operation not in ("put", "get", "verify") or len(sys.argv) != 3:
        raise ValueError("unsupported_operation")
    ref = sys.argv[2]
    target = ref_path(ref)
    digest = ref[7:]

    if operation == "get":
        data = read_checked(target, digest)
        if data is None:
            sys.exit(4)
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        return
    if operation == "verify":
        data = read_checked(target, digest)
        if data is None:
            sys.exit(4)
        print(json.dumps({
            "ok": True, "verified": True, "ref": ref,
            "size_bytes": len(data)
        }), flush=True)
        return

    # On a freshly initialized store a small disk reserve must remain.
    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("object_exceeds_limit")
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("integrity_mismatch")
    exists = read_checked(target, digest)
    if exists is not None:
        print(json.dumps({"ok": True, "ref": ref, "size_bytes": len(exists), "existing": True}))
        return
    if shutil.disk_usage(target.parent).free - len(data) < MIN_FREE_BYTES:
        raise ValueError("insufficient_disk_reserve")
    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(prefix=".magistral-", dir=target.parent)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if hasattr(os, "link"):
            try:
                os.link(temp_path, target)
            except FileExistsError:
                # Another writer won. Never overwrite or trust without verification.
                existing = read_checked(target, digest)
                if existing is None or len(existing) != len(data):
                    raise ValueError("concurrent_object_integrity_mismatch")
        else:
            # Android Termux Python may not expose os.link.
            # A mkdir-based per-object lock makes cooperating writers serialize.
            # This is NOT protection against an unrelated process modifying
            # these private files; file permissions still matter.
            lock_dir = target.parent / ("." + digest + ".lock")
            try:
                lock_dir.mkdir(mode=0o700)
            except FileExistsError:
                raise ValueError("concurrent_object_writer_active")
            try:
                already = read_checked(target, digest)
                if already is None:
                    # On a private directory and within the exclusive lock,
                    # rename publishes the previously fsynced complete file.
                    os.rename(temp_path, target)
                elif len(already) != len(data):
                    raise ValueError("concurrent_object_integrity_mismatch")
            finally:
                lock_dir.rmdir()
        print(json.dumps({"ok": True, "ref": ref, "size_bytes": len(data), "existing": False}), flush=True)
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not leak paths, stack traces or host configuration.
        known = {"ValueError", "PermissionError", "OSError"}
        category = type(error).__name__
        print(json.dumps({"ok": False, "error": category if category in known else "provider_error"}),
              file=sys.stderr, flush=True)
        sys.exit(2)
