import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
const expect=value=>({
  toBe:expected=>assert.strictEqual(value,expected),
  toEqual:expected=>assert.deepStrictEqual(value,expected),
  toHaveLength:expected=>assert.strictEqual(value.length,expected),
  toBeUndefined:()=>assert.strictEqual(value,undefined),
});
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {declareLogicalAgent,projectLogicalAgent,transitionLogicalAgent,
  listTwinLogicalAgents} from '../src/logical-agent-composition.js';
import {assignPacketWork,projectPacketWorkAssignment} from
  '../src/packet-work-assignment.js';
import {linkPacketChild} from '../src/packet-parent-continuations.js';
import {evaluateMandate,recordMandateDeclaration,
  recordMandateControl} from '../src/governed-act.js';

const twin='twin:jhn',org='organization:minesteggio',
  john='agent:jhn:john',prince='principal:jhn';
const define=(agent,name,profile)=>({
  agent_ref:agent,twin_root_ref:twin,profile_ref:profile,
  member_of:[org],reports_to:john,spawned_by:john,
  memory_ref:'memory:minesteggio:'+name,
  issued_by_ref:prince,declaration_id:'creation-2026-11-19',
  source_ref:'source:minesteggio-proposal',
  metadata:{name,proposal_status:'not_adopted'},
});
const vulcain=define('agent:minesteggio:vulcain','Vulcain',
  'profile:minesteggio:informatique');
const mercure=define('agent:minesteggio:mercure','Mercure',
  'profile:minesteggio:finances');

describe('Composite Digital Twin: Minesteggio synthetic Reality Test',()=>{
  it('two durable LogicalAgents share a Twin without merging identity, hierarchy or mandate',()=>{
    const db=createSqliteCopEventStore(':memory:');
    try{
      expect(declareLogicalAgent(db,vulcain).status).toBe('declared');
      expect(declareLogicalAgent(db,mercure).status).toBe('declared');
      expect(declareLogicalAgent(db,vulcain).status).toBe('already_declared');
      expect(declareLogicalAgent(db,{...vulcain,profile_ref:'profile:changed'})
        .status).toBe('declaration_id_conflict');
      const view=listTwinLogicalAgents(db,{twin_root_ref:twin,member_of:org});
      expect(view.ok).toBe(true);
      expect(view.agents.map(x=>x.agent_ref)).toEqual([
        mercure.agent_ref,vulcain.agent_ref]);
      for(const actor of view.agents){
        expect(actor.status).toBe('declared');
        expect(actor.revision).toBe(1);
        expect(actor.twin_root_ref).toBe(twin);
        expect(actor.reports_to).toBe(john);
        expect(actor.spawned_by).toBe(john);
        expect(actor.active_mandate_ref).toBeUndefined();
        expect(actor.history).toHaveLength(1);
      }
      expect(evaluateMandate(db,{mandate_ref:'mandate:absent',
        expected_principal_ref:prince,expected_actor_ref:vulcain.agent_ref,
        capability:'cognition.review'}).granted).toBe(false);
      expect(db.auditCommitments().ok).toBe(true);
    }finally{db.close();}
  });
  it('lifecycle survives SQLite restart; CAS rejects competing and retired updates',()=>{
    const dir=mkdtempSync(join(tmpdir(),'minesteggio-agent-'));
    const filename=join(dir,'events.sqlite');
    let s=createSqliteCopEventStore(filename);
    try{
      expect(declareLogicalAgent(s,vulcain).ok).toBe(true);
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'available',expected_revision:1,
        operation_id:'initial-availability',issued_by_ref:prince}).revision).toBe(2);
      const hibernated=transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'hibernated',expected_revision:2,operation_id:'sleep-1',
        issued_by_ref:john,checkpoint_ref:'artifact:checkpoint:vulcain-synthetic'});
      expect(hibernated.status).toBe('hibernated');
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'available',expected_revision:2,operation_id:'stale',
        issued_by_ref:john}).status).toBe('stale_agent_revision');
      expect(dbState(s).status).toBe('hibernated');
      expect(s.auditCommitments().ok).toBe(true);
      s.close();
      s=createSqliteCopEventStore(filename);
      const recovered=dbState(s);
      expect(recovered.status).toBe('hibernated');
      expect(recovered.history[2].checkpoint_ref)
        .toBe('artifact:checkpoint:vulcain-synthetic');
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'available',expected_revision:3,operation_id:'wake-1',
        issued_by_ref:john}).status).toBe('available');
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'suspended',expected_revision:4,operation_id:'pause',
        issued_by_ref:prince}).status).toBe('suspended');
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'retired',expected_revision:5,operation_id:'retire',
        issued_by_ref:prince}).status).toBe('retired');
      expect(transitionLogicalAgent(s,{agent_ref:vulcain.agent_ref,
        to_status:'available',expected_revision:6,operation_id:'revive',
        issued_by_ref:john}).status).toBe('invalid_agent_transition');
      expect(s.auditCommitments().ok).toBe(true);
    }finally{s.close();rmSync(dir,{force:true,recursive:true});}
    function dbState(store){return projectLogicalAgent(store,{agent_ref:vulcain.agent_ref});}
  });
  it('commissioning packets across John → Vulcain → Mercure preserves independent responsibility',()=>{
    const s=createSqliteCopEventStore(':memory:');
    try{
      declareLogicalAgent(s,vulcain);
      declareLogicalAgent(s,mercure);
      const root='packet:minesteggio:root',
        coding='packet:minesteggio:code',finance='packet:minesteggio:finance';
      expect(assignPacketWork(s,{packet_ref:root,assignment_id:'root',
        responsible_agent_ref:john,commissioned_by_principal_ref:prince}).ok).toBe(true);
      expect(linkPacketChild(s,{parent_ref:root,child_ref:coding}).ok).toBe(true);
      expect(assignPacketWork(s,{packet_ref:coding,assignment_id:'vulcain',
        responsible_agent_ref:vulcain.agent_ref,
        commissioned_by_agent_ref:john}).ok).toBe(true);
      expect(linkPacketChild(s,{parent_ref:coding,child_ref:finance}).ok).toBe(true);
      expect(assignPacketWork(s,{packet_ref:finance,assignment_id:'mercure',
        responsible_agent_ref:mercure.agent_ref,
        commissioned_by_agent_ref:vulcain.agent_ref}).ok).toBe(true);
      const transfer=projectPacketWorkAssignment(s,{packet_ref:finance});
      expect(transfer.responsible_agent_ref).toBe(mercure.agent_ref);
      expect(transfer.commissioned_by_agent_ref).toBe(vulcain.agent_ref);
      expect(projectPacketWorkAssignment(s,{packet_ref:coding})
        .responsible_agent_ref).toBe(vulcain.agent_ref);
      expect(s.auditCommitments().ok).toBe(true);
    }finally{s.close();}
  });
  it('a declaration and assignment do not create power; canonical COP still checks chain and revocation',()=>{
    const s=createSqliteCopEventStore(':memory:');
    try{
      declareLogicalAgent(s,vulcain);
      const opts={mandate_ref:'mandate:minesteggio:vulcain',
        expected_principal_ref:prince,expected_actor_ref:vulcain.agent_ref,
        capability:'cognition.review'};
      expect(evaluateMandate(s,opts).error).toBe('mandate_not_found');
      recordMandateDeclaration(s,{mandate_id:'mandate:jhn:john',
        principal_ref:prince,logical_agent_ref:john,
        scope:{allowed_actions:['cognition.review']}});
      recordMandateDeclaration(s,{mandate_id:opts.mandate_ref,
        principal_ref:prince,logical_agent_ref:vulcain.agent_ref,
        parent_mandate_ref:'mandate:jhn:john',
        scope:{allowed_actions:['cognition.review']}});
      expect(evaluateMandate(s,opts).granted).toBe(true);
      expect(evaluateMandate(s,{...opts,capability:'third-party.send'})
        .granted).toBe(false);
      expect(evaluateMandate(s,{...opts,expected_actor_ref:mercure.agent_ref})
        .granted).toBe(false);
      recordMandateControl(s,{principal_ref:prince,
        mandate_ref:opts.mandate_ref,action:'revoke',
        reason:'synthetic Reality Test'});
      expect(evaluateMandate(s,opts).granted).toBe(false);
      expect(s.auditCommitments().ok).toBe(true);
    }finally{s.close();}
  });
});

