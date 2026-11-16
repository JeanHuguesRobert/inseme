---
title: Magistral SSH peer object providers v0
date: 2026-11-16
status: experimental-live-verified
document_role: operational
language: en
---

# Local and intermittent SSH object providers

An owned laptop or Android phone may provide immutable SHA-256 byte custody
under the SAME native Magistral Memory contract as local filesystem or OCI.
Cogentia alone owns cognitive significance, retention and CPS reconciliation.

## Real devices, tested

- Fracta2: existing local provider, but only 4.4 GiB free; same operator
  and cloud infrastructure failure domain as Oracle.
- ThinkPad: SSH alias thinkpad, Windows Miniconda Python 3.13.11, around
  20.5 GiB free. Immutable small-object PUT and GET passed end to end.
- Android phone: SSH alias poco-jhr, port 8022, Termux Python 3.14.6,
  119 GiB free reported. Immutable small-object PUT and GET passed end
  to end after an Android compatibility correction. Termux Python lacks
  os.link; the remote bridge uses a serialized lock-directory and
  atomic rename fallback, preserving a fully written object.
- No additional paid service, account, or always-on daemon was installed.

Remote bridge paths:

    ThinkPad: C:\Users\admin\AppData\Local\Magistral\remote-cas\ssh-object-bridge.py

    Phone: /data/data/com.termux/files/home/.local/share/magistral/remote-cas/ssh-object-bridge.py

Each has its own objects/sha256/ directory next to the bridge.

## Provider contract and constraints

The Node export is createSshObjectProvider({id,alias,python,script,
maxObjectBytes,networkCostVerified,timeoutMs}).

Only probe, immutable put and verified get operations exist. Any offline
peer, missing object, transport timeout or hash mismatch has a distinct
failure path and is NEVER treated as a successful replica. No SSH peer
can delete, overwrite or enumerate all objects using this bridge.

There is a per-object bound of 64 MiB and a minimum reserve of 1 GiB
of reported free disk space. No global peer storage quota exists yet.

networkCostVerified defaults to FALSE, so no transfers occur until
the owner/operator has confirmed that the selected network link does
not create marginal monetary charges. A mobile subscription does not
prove that all cellular data or roaming are free. We tested only one
50-byte payload on the phone, not a bulk cellular transfer.

The SSH provider uses existing known host aliases, not user-supplied
shell fragments, and all returned bytes are verified against SHA-256.

## CLI profile example (ThinkPad)

An explicit operator-owned JSON profile is required:

    {
      "schema": "magistral.ssh-object-profile/v1",
      "id": "thinkpad",
      "alias": "thinkpad",
      "python": "C:\\Users\\admin\\miniconda3\\python.exe",
      "script": "C:\\Users\\admin\\AppData\\Local\\Magistral\\remote-cas\\ssh-object-bridge.py",
      "networkCostVerified": true,
      "maxObjectBytes": 67108864,
      "timeoutMs": 90000
    }

From Fracta2:

    magistral-objects put ./document.pdf --ssh-config /absolute/thinkpad.json

    magistral-objects get sha256:<digest> ./restored.pdf --ssh-config /absolute/thinkpad.json

For required local + ThinkPad + OCI copies, supply each provider flag.
Default PUT demands ALL configured providers. When a peer is offline, PUT
reports failure with verified successful copies; it does not erase them.
The optional --min-replicas N relaxes the minimum and may stop after N
copies, so it does not imply a best-effort write to all later providers.
Cogentia decides later reconciliation and resumes its CPS continuations.

## Phone activation dependencies

The phone is often charged and connected, but SSH requires both an
active Tailscale Android VPN and an active Termux SSH session.

- Tailscale Android (com.tailscale.ipn) is installed. Enable Android
  Settings > VPN > Tailscale > Always-on VPN. Do not enable Block
  connections without VPN by default; that can cut off phone Internet.
- Termux:Boot (com.termux.boot) was not found. Install it from the SAME
  signature/source as Termux (e.g. both from F-Droid) and open Termux:Boot
  once. Documentation: https://github.com/termux/termux-boot
- The phone already had executable Termux boot scripts including sshd.
  A second SSH startup script contained malformed comments and an
  ineffective attempt to manage the Android Tailscale app from Termux.
  It was replaced by an idempotent compatibility script; the original
  was backed up under the phone's private Magistral directory.
- Avoid unbounded CPU wake locks and cellular transfers. If Android
  still kills these background services, adjust their battery settings,
  noting the battery-life tradeoff.

Intermittent is a provider availability state, not deletion or permanent
data loss. No automatic data-sync task or polling loop is enabled by v0.

Future work: Cogentia-owned retry journal and peer-reconciliation workflow,
fault-domain-aware replication receipts, Wi-Fi-only mobile transfer policy,
and configurable per-provider total quotas.
