/**
 * Adversarial Strict Accounting Test Suite (Issue #45)
 *
 * Implements the full adversarial test matrix against the "No Unaccounted Effects" invariant:
 * - Missing-accounting attacks
 * - Double-accounting attacks
 * - Balance and integrity attacks
 * - Budget and concurrency attacks
 * - Lineage and cascade attacks
 * - Reconciliation and compensating adjustment attacks
 * - Follow-the-Money bidirectional audit verification
 *
 * @module test/strict-accounting-adversarial
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAccountingEvent,
  validateAccountingEventSequence,
  validateReconciliationEvent,
  ValidationError,
  fromDecimal,
  createCognitivePacket,
  appendPacketSpending,
  spawnDownstreamPacket,
  auditPacketSpendNoDoubleCount,
  createReconciliationAdjustment,
  followTheMoneyAudit,
} from "../src/index.js";

test("Strict Accounting Adversarial Test Suite (Issue #45)", async (t) => {
  const ACCOUNT_ALICE = "https://alice.example/budget";
  const ACCOUNT_BOB = "https://bob.example/budget";
  const MANDATE_URN = "mandate:jhn:strict-accounting@v1";

  // --------------------------------------------------------------------------
  // 1. Balance & Integrity Attacks
  // --------------------------------------------------------------------------
  await t.test("1. Balance & Integrity: Unbalanced transaction is rejected", () => {
    const unbalancedTxn = {
      eventType: "accounting/transaction",
      schemaVersion: "1.0",
      transaction_id: "txn-unbalanced-01",
      resource_type: "fiat",
      accounting_domain: "fiat.usd",
      postings: [
        {
          account: ACCOUNT_ALICE,
          quantity: { coefficient: "1000", scale: 2, unit: "USD" },
          posting_type: "debit",
        },
        {
          account: ACCOUNT_BOB,
          quantity: { coefficient: "900", scale: 2, unit: "USD" }, // 900 != 1000
          posting_type: "credit",
        },
      ],
      governance: {
        actor_subject_id: "https://alice.example",
        principal_subject_id: "https://alice.example",
      },
      idempotency_key: "key-unbalanced-01",
    };

    const res = validateAccountingEvent(unbalancedTxn);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("Transaction does not balance")));
  });

  await t.test("2. Balance & Integrity: Binary float leakage is rejected", () => {
    const floatTxn = {
      eventType: "accounting/transaction",
      schemaVersion: "1.0",
      transaction_id: "txn-float-01",
      resource_type: "fiat",
      accounting_domain: "fiat.usd",
      postings: [
        {
          account: ACCOUNT_ALICE,
          quantity: { coefficient: 0.1, scale: 2, unit: "USD" }, // float number instead of string
          posting_type: "debit",
        },
        {
          account: ACCOUNT_BOB,
          quantity: { coefficient: "10", scale: 2, unit: "USD" },
          posting_type: "credit",
        },
      ],
      governance: {
        actor_subject_id: "https://alice.example",
        principal_subject_id: "https://alice.example",
      },
      idempotency_key: "key-float-01",
    };

    const res = validateAccountingEvent(floatTxn);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("coefficient must be a string")));
  });

  await t.test(
    "3. Balance & Integrity: Cross-unit balancing rejected without explicit conversion",
    () => {
      const crossUnitTxn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-cross-unit-01",
        resource_type: "multi",
        accounting_domain: "exchange",
        postings: [
          {
            account: ACCOUNT_ALICE,
            quantity: { coefficient: "100", scale: 0, unit: "EUR" },
            posting_type: "debit",
          },
          {
            account: ACCOUNT_BOB,
            quantity: { coefficient: "100", scale: 0, unit: "USD" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-cross-unit-01",
      };

      const res = validateAccountingEvent(crossUnitTxn);
      assert.equal(res.valid, false);
      assert.ok(
        res.errors.some((e) => e.includes("Cross-unit posting requires explicit conversion_rate"))
      );
    }
  );

  // --------------------------------------------------------------------------
  // 2. Double-Accounting Attacks
  // --------------------------------------------------------------------------
  await t.test("4. Double-Accounting: Sequence rejects duplicate idempotency key", () => {
    const txn = {
      eventType: "accounting/transaction",
      schemaVersion: "1.0",
      transaction_id: "txn-dup-01",
      resource_type: "kudos",
      accounting_domain: "kudos.public",
      postings: [
        {
          account: ACCOUNT_ALICE,
          quantity: { coefficient: "50", scale: 0, unit: "kudos" },
          posting_type: "debit",
        },
        {
          account: ACCOUNT_BOB,
          quantity: { coefficient: "50", scale: 0, unit: "kudos" },
          posting_type: "credit",
        },
      ],
      governance: {
        actor_subject_id: "https://alice.example",
        principal_subject_id: "https://alice.example",
      },
      idempotency_key: "key-duplicate-reuse",
    };

    const seqRes = validateAccountingEventSequence([txn, txn]);
    assert.equal(seqRes.valid, false);
    assert.ok(seqRes.errors.length > 0);
    assert.ok(seqRes.errors[0].errors.some((e) => e.includes("Duplicate idempotency key")));
  });

  await t.test(
    "5. Double-Accounting: Cascade copying downstream spend lines into upstream packet is detected",
    () => {
      const upstream = createCognitivePacket({
        mandate_id: MANDATE_URN,
        treatment_id: "treatment:cascade-01",
        account_id: ACCOUNT_ALICE,
      });

      // Upstream has its own initial spend
      appendPacketSpending(upstream, {
        capability: "ai/chat",
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 50,
        completion_tokens: 25,
      });

      const downstream = spawnDownstreamPacket(upstream, {
        mandate_id: MANDATE_URN,
        account_id: ACCOUNT_BOB,
        spawn_reason: "subagent-task",
      });

      // Downstream records its own spend
      const { spendingEntry: downSpend } = appendPacketSpending(downstream, {
        capability: "ai/chat",
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      // Adversarial attack: incorrectly copy downstream's spend line into upstream's spending[]
      upstream.spending.push({ ...downSpend });

      const auditRes = auditPacketSpendNoDoubleCount([upstream, downstream]);
      assert.equal(auditRes.ok, false);
      assert.ok(auditRes.duplicate_keys.length > 0);
    }
  );

  // --------------------------------------------------------------------------
  // 3. Budget & Concurrency Attacks
  // --------------------------------------------------------------------------
  await t.test(
    "6. Budget & Concurrency: Reservation exceeding available budget capacity is rejected",
    () => {
      const budgetMap = new Map();
      budgetMap.set("bgt-01", {
        budget_id: "bgt-01",
        status: "active",
        accounting_domain: "fiat.usd",
        granted: { coefficient: "100", scale: 0, unit: "USD" },
        available: { coefficient: "20", scale: 0, unit: "USD" }, // only 20 available!
      });

      const resvEvent = {
        eventType: "accounting/reservation",
        schemaVersion: "1.0",
        reservation_id: "resv-exceed-01",
        action: "reserve",
        resource_type: "fiat",
        accounting_domain: "fiat.usd",
        quantity: { coefficient: "50", scale: 0, unit: "USD" }, // requests 50 > 20
        budget_reference: { budget_id: "bgt-01" },
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-resv-exceed-01",
      };

      const res = validateAccountingEvent(resvEvent, { budgets: budgetMap });
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes("Insufficient budget availability")));
    }
  );

  await t.test(
    "7. Budget & Concurrency: Competing reservations exceeding budget amount are rejected",
    () => {
      const budgetMap = new Map();
      budgetMap.set("bgt-compete", {
        budget_id: "bgt-compete",
        status: "active",
        accounting_domain: "kudos.public",
        granted: { coefficient: "100", scale: 0, unit: "kudos" },
        available: { coefficient: "100", scale: 0, unit: "kudos" },
      });

      const existingResv = [
        {
          reservation_id: "resv-prior-01",
          budget_reference: { budget_id: "bgt-compete" },
          status: "active",
          quantity: { coefficient: "80", scale: 0, unit: "kudos" },
        },
      ];

      const newResv = {
        eventType: "accounting/reservation",
        schemaVersion: "1.0",
        reservation_id: "resv-competing-02",
        action: "reserve",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "30", scale: 0, unit: "kudos" }, // 80 + 30 = 110 > 100
        budget_reference: { budget_id: "bgt-compete" },
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-competing-02",
      };

      const res = validateAccountingEvent(newResv, {
        budgets: budgetMap,
        existingReservations: existingResv,
      });
      assert.equal(res.valid, false);
      assert.ok(
        res.errors.some((e) => e.includes("Total reservations would exceed budget amount"))
      );
    }
  );

  // --------------------------------------------------------------------------
  // 4. Governance & Attribution Attacks
  // --------------------------------------------------------------------------
  await t.test("8. Governance: Actor != principal without valid mandate_id is rejected", () => {
    const unmandatedTxn = {
      eventType: "accounting/transaction",
      schemaVersion: "1.0",
      transaction_id: "txn-unmandated-01",
      resource_type: "kudos",
      accounting_domain: "kudos.public",
      postings: [
        {
          account: ACCOUNT_ALICE,
          quantity: { coefficient: "10", scale: 0, unit: "kudos" },
          posting_type: "debit",
        },
        {
          account: ACCOUNT_BOB,
          quantity: { coefficient: "10", scale: 0, unit: "kudos" },
          posting_type: "credit",
        },
      ],
      governance: {
        actor_subject_id: "https://mallory.example", // Mallory acting on behalf of Alice
        principal_subject_id: "https://alice.example",
        // No mandate_id!
      },
      idempotency_key: "key-unmandated-01",
    };

    const res = validateAccountingEvent(unmandatedTxn);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("mandate_id is required when actor != principal")));
  });

  // --------------------------------------------------------------------------
  // 5. Provisional -> Actual Reconciliation (Compensating Adjustment)
  // --------------------------------------------------------------------------
  await t.test(
    "9. Reconciliation: Valid signed adjustment satisfies adjustment = actual - provisional",
    () => {
      const provCost = fromDecimal("1.23450000", "USD");
      const actCost = fromDecimal("1.24170000", "USD");

      const reconEvent = createReconciliationAdjustment({
        provisional_spending_id: "spend-prov-100",
        packet_id: "urn:cop:packet:recon-test",
        provider: "openai",
        model: "gpt-5.4-nano",
        billing_period: "2026-08",
        provisional_cost: provCost,
        actual_cost: actCost,
        reason: "Provider monthly billing adjustment (+0.00720000 USD)",
        governance: {
          actor_subject_id: "https://jhn.baronsmariani.org/",
          principal_subject_id: "https://jhn.baronsmariani.org/",
        },
      });

      // Verify calculated adjustment: 1.24170000 - 1.23450000 = +0.00720000
      assert.equal(reconEvent.adjustment.coefficient, "720000");
      assert.equal(reconEvent.adjustment.scale, 8);
      assert.equal(reconEvent.adjustment.unit, "USD");

      const valResult = validateAccountingEvent(reconEvent);
      assert.equal(valResult.valid, true);
      assert.equal(valResult.errors.length, 0);
    }
  );

  await t.test("10. Reconciliation: Arithmetic fraud / mismatched adjustment is rejected", () => {
    const provCost = fromDecimal("1.00000000", "USD");
    const actCost = fromDecimal("1.50000000", "USD");
    // Fraudulent adjustment: says +0.20000000 instead of +0.50000000
    const fraudulentAdj = fromDecimal("0.20000000", "USD");

    const badRecon = {
      eventType: "accounting/reconciliation",
      schemaVersion: "1.0",
      reconciliation_id: "recon-fraud-01",
      provisional_spending_id: "spend-prov-bad",
      provider: "openai",
      provisional_cost: provCost,
      actual_cost: actCost,
      adjustment: fraudulentAdj,
      reason: "Mismatched arithmetic fraud test",
      governance: {
        actor_subject_id: "https://jhn.baronsmariani.org/",
        principal_subject_id: "https://jhn.baronsmariani.org/",
      },
      idempotency_key: "key-bad-recon-01",
    };

    const res = validateReconciliationEvent(badRecon);
    assert.equal(res.valid, false);
    assert.ok(
      res.errors.some((e) => e.includes("adjustment must equal actual_cost - provisional_cost"))
    );
  });

  // --------------------------------------------------------------------------
  // 6. Follow-the-Money Audit Engine (Bidirectional Traversal)
  // --------------------------------------------------------------------------
  await t.test(
    "11. Follow-the-Money: Clean end-to-end reality & ledger passes with ok=true",
    () => {
      const packet = createCognitivePacket({
        mandate_id: MANDATE_URN,
        treatment_id: "treatment:ftm-01",
        account_id: ACCOUNT_ALICE,
      });

      const { spendingEntry } = appendPacketSpending(packet, {
        capability: "ai/chat",
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 200,
        completion_tokens: 100,
      });

      const recon = createReconciliationAdjustment({
        provisional_spending_id: spendingEntry.spend_id,
        packet_id: packet.packet_id,
        provider: "openai",
        model: "gpt-4o-mini",
        provisional_cost: spendingEntry.provisional_cost,
        actual_cost: spendingEntry.provisional_cost, // zero difference
        reason: "Confirmed exact match",
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
      });

      const txn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-backed-01",
        resource_type: "fiat",
        accounting_domain: "fiat.usd",
        postings: [
          {
            account: ACCOUNT_ALICE,
            quantity: spendingEntry.provisional_cost,
            posting_type: "debit",
          },
          {
            account: ACCOUNT_BOB,
            quantity: spendingEntry.provisional_cost,
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        evidence_references: [{ uri: `urn:cop:packet:${packet.packet_id}` }],
        idempotency_key: "key-txn-backed-01",
      };

      const report = followTheMoneyAudit({
        events: [txn, recon],
        packets: [packet],
      });

      assert.equal(report.ok, true);
      assert.equal(report.violations.length, 0);
      assert.equal(report.accounted_real_effects, 1);
      assert.equal(report.orphan_ledger_entries.length, 0);
      assert.equal(report.duplicate_ownership.length, 0);
    }
  );

  await t.test(
    "12. Follow-the-Money: Detects orphan ledger entries and duplicate spend ownership",
    () => {
      // 1. Transaction without evidence / spend backing
      const orphanTxn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-orphan-999",
        resource_type: "fiat",
        accounting_domain: "fiat.usd",
        postings: [
          {
            account: ACCOUNT_ALICE,
            quantity: { coefficient: "100", scale: 2, unit: "USD" },
            posting_type: "debit",
          },
          {
            account: ACCOUNT_BOB,
            quantity: { coefficient: "100", scale: 2, unit: "USD" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        // No evidence_references, no packet_id, no spend_id!
        idempotency_key: "key-orphan-999",
      };

      // 2. Duplicate spend ownership: two distinct packets claim the same spend_id
      const packet1 = createCognitivePacket({
        packet_id: "urn:cop:packet:p1",
        mandate_id: MANDATE_URN,
        treatment_id: "treatment:p1",
        account_id: ACCOUNT_ALICE,
      });
      const packet2 = createCognitivePacket({
        packet_id: "urn:cop:packet:p2",
        mandate_id: MANDATE_URN,
        treatment_id: "treatment:p2",
        account_id: ACCOUNT_BOB,
      });

      const stolenSpend = {
        spend_id: "spend:unique-physical-call-123",
        hop_index: 0,
        capability: "ai/chat",
        provider: "openai",
        provisional_cost: { coefficient: "100000000", scale: 8, unit: "USD" },
      };

      packet1.spending.push(stolenSpend);
      packet2.spending.push(stolenSpend); // Double claim!

      const report = followTheMoneyAudit({
        events: [orphanTxn],
        packets: [packet1, packet2],
      });

      assert.equal(report.ok, false);
      assert.ok(report.violations.length >= 2);
      assert.ok(report.violations.some((v) => v.code === "orphan_ledger_entry"));
      assert.ok(report.violations.some((v) => v.code === "duplicate_spend_ownership"));
      assert.equal(report.duplicate_ownership.length, 1);
      assert.equal(report.orphan_ledger_entries.length, 1);
    }
  );
});
