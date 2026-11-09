# Founding JHN Principal enrollment — owner SSH bootstrap

This **one-time** command binds the already existing, email-confirmed
`jhr@baronsmariani.org` Supabase Auth user to the founding autonomous
JHN instance. It is an owner-administration operation, not a general
Principal issuer or a delegation to all `ubuntu` processes.

From the Principal's established Windows PowerShell SSH profile:

```powershell
ssh -tt fracta2 'cd /srv/cogentia/repos/inseme && node apps/platform/scripts/enroll-jhn-principal.js'
```

The command requires an interactive SSH TTY and exact human confirmation
`JE CONFIRME LE RATTACHEMENT JHN`. No Supabase password is necessary:
the existing host administrator can already inspect the confirmed Supabase
account directory and execute a narrowly bounded, explicitly authorized
initial instance-binding operation. This is **not** evidence that any holder
of the service-role key is the Principal; the host SSH `ubuntu` account has
more than one authorized public key, so the channel is not suitable for
issuing general mandates. Only the Principal should run this command from
his established SSH session; the `ubuntu` account must remain access
controlled independently.

Fail-closed implementation:

- hard-coded root instance UUID and founding twin identity
- exactly one already-confirmed Auth account with the known email
- an existing `public.users` profile with role `admin`
- no user-provided account ID, email, scope or instance
- no-overwrite conditional `UPDATE instances ... WHERE principal_id IS NULL`
- readback after write; idempotence on repeated owner execution
- no other account, config, secret, COP mandate, grant or ledger mutation
- never publish this command as an MCP tool or HTTP endpoint

This is an explicit, one-time administrative reconciliation of two already
confirmed objects and does not automatically authorize subsequent mandate
issuance/amendment. Those continue to require a genuine Principal approval
for the exact proposal, independent issuer verification and COP enforcement.
