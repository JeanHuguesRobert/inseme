# Cadre Conceptuel : Système de Pourboires (Tipping)

## Inspiration Anthropologique : Marcel Mauss

Ce système de dons anonymes s’inspire des travaux de **Marcel Mauss** sur l'essai sur le don
(_"Essai sur le don. Forme et raison de l'échange dans les sociétés archaïques"_, 1923-1924), et
plus particulièrement sur le cycle du **don et du contre-don**.

### Principes Fondamentaux

L’objectif est de permettre des échanges volontaires et libres entre client et barman, sans traçage
ni obligation imposée par le système.

1. **Liberté et Volonté** : Le don ne doit pas être une transaction commerciale rigide, mais un acte
   social spontané.
2. **Absence de Traçage** : Contrairement aux systèmes de paiement classiques, ce module privilégie
   l'anonymat ou la confidentialité choisie, évitant ainsi la création d'une dette sociale
   permanente ou d'un profilage commercial.
3. **Stateless et Neutre** : Le flux technique reste strictement stateless. Le système Inseme ne
   stocke pas les transactions, ne prélève pas de commission propre, et se contente de relayer
   l'intention de don vers Stripe.

## Mise en Œuvre Technique

- **Relais Stripe** : Utilisation de Stripe Checkout pour la sécurité et la conformité, tout en
  gardant l'application Inseme "aveugle" aux détails bancaires.
- **JWT (Stateless)** : Utilisation de tokens signés pour identifier le bénéficiaire sans base de
  données centrale.
- **Confidentialité Granulaire** : L'utilisateur décide du niveau de visibilité de son acte (Public,
  Bénéficiaire uniquement, ou Anonyme).

---

_Ce document sert de référence pour la philosophie du module de pourboire au sein de l'écosystème
Inseme._
