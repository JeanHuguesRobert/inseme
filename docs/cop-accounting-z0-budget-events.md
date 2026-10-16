# Z0 — événements durables de réservation et règlement budgétaires

**Statut : déployé et testé sur JHN (2026-10-16), expérimental.** Packet #163, parapluie #161.

Migration Supabase enregistrée : `cop_epoch_budget_recorded_wrappers`.

## Nouveau contrat

`cop_reserve_epoch_budget_recorded(epoch_id,budget_ref,mandate_ref,unit,key,amount,actor)` :

- appelle la réservation atomique `cop_reserve_epoch_budget` ;
- insère, dans **la même transaction SQL**, un événement append-only `accounting.budget.reserved` ;
- utilise `reserve:<reservation_key>` comme clé idempotente ;
- rejette les rejeux incompatibles avec l'identité de l'acteur, le budget et le mandat.

`cop_settle_epoch_budget_recorded(epoch_id,reservation_key,spent,actor)` :

- appelle `cop_settle_epoch_budget` ;
- insère dans la même transaction `accounting.budget.settled` ;
- conserve quantités réservée, consommée et libérée (en décimales textuelles), unité et références ;
- utilise `settle:<reservation_key>` comme clé idempotente.

Les deux fonctions sont `SECURITY INVOKER`, non autorisées au public/anon/authenticated ; accès `service_role` uniquement.

## Reality Test

Dans une sous-transaction explicitement annulée :
- budget fictif `TEST_UNIT` de 3 ;
- réservation 2, création du reçu ;
- règlement 1, libération 1, création du reçu ;
- deux événements effectivement présents avant rollback ;
- deux rejeux détectés comme duplications ;
- après rollback : 0 budget, 0 réservation et 2 événements historiques Z0.

## Limites P0/P1

1. **Les anciennes fonctions SQL de réservation et règlement restent appelables par service_role** : l'écriture d'un événement n'est pas encore incontournable si l'appelant utilise la fonction historique. Il faut router les handlers uniquement vers les fonctions `_recorded` et traiter l'exposition des anciens points d'entrée.
2. Ces événements de **comptabilité budgétaire** ne sont pas des postings de partie double ; éviter d'inventer une écriture monétaire pour une simple réservation.
3. Le **grant** initial du budget exige un mandat explicite et son propre événement. Il n'existe aucun grant actif.
4. Concurrence inter-session, injection de crash et reproductibilité complète des migrations dans Git restent à terminer.
5. L'imputation effective des actes et le raccordement GitHub Compute restent au Packet #164.

Aucune écriture historique et aucun budget effectif n'ont été modifiés.
