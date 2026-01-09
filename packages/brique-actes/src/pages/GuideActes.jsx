import { MarkdownDoc } from "@inseme/ui";

/**
 * Page du Guide Citoyen pour le contrôle des actes municipaux
 * Utilise le composant MarkdownDoc pour afficher le fichier statique
 */
export default function GuideActes() {
  return (
    <MarkdownDoc
      docPath="guide-citoyen-actes.md"
      title="Guide Citoyen - Contrôle des Actes"
      backLink="/actes/accueil"
      backLabel="Retour à l'accueil Actes"
    />
  );
}
