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
  A 32,504,501-byte public Survey PDF was uploaded and verified with
  its exact SHA-256. Its first full read-back exceeded a timeout over
  a Tailscale relay even though it arrived intact. Retrying with remote
  checksum-only verification took approximately 10 seconds without
  downloading the same file a second time.
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

Only probe, immutable put, verified get, and remote checksum-only verify
operations exist. The remote verify operation reads the object on the peer
and returns its SHA-256 receipt without retransmitting the file. It permits
fast idempotent PUT retries when a prior transfer succeeded but its client
connection timed out. Any offline peer, missing object, transport timeout,
or hash mismatch has a distinct failure path and is NEVER treated as a
successful replica. No SSH peer
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


## Reachability, physical custody and device roles are independent

Do NOT conflate provider reachability with the durability of bytes already
stored there. In this particular deployment:

- **Phone**: likely to have a cellular Internet path and to be close to the
  user. It can act as the mobile connectivity/access edge, an opportunistic
  cache and a limited local repository. It is regularly carried outdoors,
  so its probability of loss, theft or physical destruction can be higher.
  Treat it as a riskier SOLE holder of irreplaceable objects.
- **ThinkPad**: often stays at an office and has lower movement-related
  loss exposure. It offers strong custody for a local peer but depends on
  connectivity that may be provided by the phone or another available path.
  When the phone is unavailable, the ThinkPad's existing bytes are not lost.
- **Fracta2**: online cloud-hosted hot cache with little remaining free space.
  It shares a broad cloud-provider administrative/failure domain with Oracle
  Object Storage; two directories on Fracta2 do not form independent custody.
- **Oracle Object Storage**: off-device regional backup; not a guarantee of
  zero billing on the account's PAYG contract and not independent of the
  Fracta2 cloud vendor.

A device should therefore report separate facts rather than one global
"reliability" score: connectivity or reachability status, observed remaining
capacity, known network cost policy, physical custody/fault domain, and
whether the data can be read without relying on a different device.
These are descriptors for Cogentia to consider, not Cogentia policy that
Magistral decides on its own.

Practical policy owned by Cogentia, NOT implemented here: use the phone
preferentially as an access node while it is charged, online and reachable;
use the more stationary ThinkPad as an independent custody node; preserve a
verified off-device copy of valuable archives; avoid letting the phone be
the only copy; retry replication when a peer is reachable. The phone is
especially suitable for limited ephemeral objects or encrypted
replicas rather than unprotected private archives.

Encryption of sensitive objects **before** writing to a mobile peer is a
separate prerequisite. Android's ordinary device encryption does not make
a lost, unlocked handset or a running Termux session safe by itself.
Current v0 SSH providers provide SHA-256 integrity, not end-to-end object
confidentiality or a general encrypted storage format.

### Existing phone startup path

The SSH bridge is usable whenever both Android Tailscale VPN and the Termux
SSH server are running. Termux boot scripts have been corrected, but
Termux:Boot was not installed/detectable and the Android Tailscale Always-on
VPN setting was not active in the inspected settings. Those two Android
platform controls require deliberate setup by the device owner. Do not
promise a "permanently online" node without verifying reboot and battery
behavior in practice.

This distinction will matter more as mobile devices become more capable:
better connectivity strengthens access but does not automatically reduce
loss/theft risk.
