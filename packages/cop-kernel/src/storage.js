/**
 * packages/cop-kernel/src/storage.js
 * @file Module de stockage complet pour le protocole COP.
 * Il fournit la StorageInterface et implémente un Patron Factory pour choisir différents types de stockage :
 * Supabase (Cloud SQL + Buckets), File, In-Memory, IndexedDB (Navigateur), SQLite (Disque Local), et Redis (Cache Distribué).
 * @module storage
 */

// packages/cop-kernel/src/storage.js

// Importation statique des dépendances légères (seulement "memory" ici)
import { createInMemoryStorage } from "./storage-implementations/inMemoryStorage.js";

let defaultStorage = null;
const storages = new Map(); // Map to store different storage instances by configuration key

// --- DÉFINITIONS DES ERREURS STANDARDISÉES
export const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR",
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

// ======================================================================
// 1. DÉFINITION DE L'INTERFACE COMPLÈTE (JSDoc)
// ======================================================================

/**
 * @typedef {object} StorageInterface
 * @description Interface standardisée pour les opérations de stockage.
 * Toutes les méthodes asynchrones retournent une Promise qui:
 *   - Se résout avec `{ ok: true, data: T }` en cas de succès.
 *   - Se résout avec `{ ok: false, error: E }` pour les échecs attendus (ex: NOT_FOUND, CONFLICT).
 *   - Se rejette avec une `Error` pour les erreurs inattendues/système.
 * @property {object} debugLogs - Interface pour les logs de debug.
 * @property {object} debugLogs - Interface pour les logs de debug.
 * @property {function(object): Promise<object>} debugLogs.insert - Insère un log.
 * @property {object} events - Interface pour les événements.
 * @property {function(object): Promise<object>} events.insert - Insère un événement.
 * @property {object} artifacts - Interface pour les métadonnées des artefacts.
 * @property {function(object): Promise<object>} artifacts.insert - Insère une métadonnée d'artefact.
 * @property {object} agentIdentities - Interface pour les identités des agents (CRUD).
 * @property {function(object): Promise<object>} agentIdentities.upsert - Insère ou met à jour une identité.
 * @property {function(string): Promise<object>} agentIdentities.getById - Récupère une identité par ID.
 * @property {function(string): Promise<object>} agentIdentities.getByName - Récupère une identité par nom.
 * @property {function(object): Promise<object>} agentIdentities.list - Liste les identités.
 * @property {function(string, string): Promise<object>} agentIdentities.updateStatus - Met à jour le statut.
 * @property {object} tasks - Interface pour les tasks (CRUD + versionnement optimiste).
 * @property {function(object): Promise<object>} tasks.upsert - Insère ou met à jour un task.
 * @property {function(string): Promise<object>} tasks.get - Récupère un task par ID.
 * @property {function(object): Promise<object[]>} tasks.list - Liste les tasks.
 * @property {function(string, object): Promise<object>} tasks.update - Met à jour un task (avec versionnement optimiste).
 * @property {object} steps - Interface pour les étapes (CRUD).
 * @property {function(object): Promise<object>} steps.upsert - Insère ou met à jour une étape.
 * @property {function(string): Promise<object>} steps.listByTask - Liste des étapes d'un task.
 * @property {function(string): Promise<object} steps.get - Récupère une étape par ID.
 * @property {function(string, string, object): Promise<object>} steps.update - Met à jour une étape.
 * @property {object} fileStorage - Interface pour la gestion des objets/fichiers (Buckets).
 * @property {function(string, string, Buffer|File, object): Promise<object>} fileStorage.uploadArtifact - Télécharge un fichier vers un chemin de bucket.
 * @property {function(string, string): Promise<object>} fileStorage.downloadArtifact - Télécharge un fichier depuis un chemin de bucket.
 * @property {function(string, string): Promise<object>} fileStorage.getPublicUrl - Récupère l'URL publique d'un fichier.
 * @property {function(): object} getCacheContents - Retourne le contenu des caches (pour debug/test).
 * @property {function(): void} clearCache - Vide tous les caches.
 * @property {object} ERROR_CODES - Codes d'erreur standardisés.
 */

// ======================================================================
// 1. UTILITAIRE DE CHARGEMENT DYNAMIQUE AVEC HEURISTIQUES
// ======================================================================

/**
 * Détermine le chemin du fichier d'implémentation et charge dynamiquement
 * la fonction de création correspondante.
 * @param {string} storageType - Le type de stockage requis.
 * @param {object} options - Options de configuration.
 * @returns {Promise<function>} - La fonction de création (ex: createSupabaseStorage).
 * @throws {Error} Si le type est inconnu ou l'import échoue.
 */
async function loadStorageCreator(storageType, options) {
  let path = null;
  let creatorFunctionName = null; // Nom de l'export à chercher (si pas 'default')

  const isBrowser = typeof window !== "undefined" || typeof self !== "undefined";
  const isDeno = typeof Deno !== "undefined";
  const isNode = typeof process !== "undefined" && !isDeno;

  // 1. Détermination du chemin en fonction du type et de l'environnement
  try {
    let module;
    switch (storageType) {
      case "memory":
        // Cas spécial: importé statiquement et très léger, nous le retournons directement.
        return createInMemoryStorage;

      case "indexeddb":
      case "browser":
        if (isBrowser) {
          module = await import(/* @vite-ignore */ "./storage-implementations/browserStorage.js");
          creatorFunctionName = "createBrowserStorage";
        }
        break;

      case "sqlite":
        if (isDeno) {
          module = await import(/* @vite-ignore */ "./storage-implementations/denoSqliteStorage.js");
          creatorFunctionName = "createDenoSqliteStorage";
        } else if (isNode) {
          module = await import(/* @vite-ignore */ "./storage-implementations/sqliteStorage.js");
          creatorFunctionName = "createNodeSqliteStorage";
        } else if (isBrowser) {
          module = await import(/* @vite-ignore */ "./storage-implementations/browserSqliteStorage.js");
          creatorFunctionName = "createBrowserSqliteStorage";
        }
        break;

      case "redis":
        /* 
        if (isNode || isDeno) {
          module = await import("./storage-implementations/redisStorage.js");
          creatorFunctionName = "createRedisStorage";
        }
        */
        console.warn("Redis storage is not yet implemented.");
        break;

      case "file":
        if (isDeno) {
          module = await import(/* @vite-ignore */ "./storage-implementations/denoFileBasedStorage.js");
          creatorFunctionName = "createDenoFileBasedStorage";
        } else if (isNode) {
          module = await import(/* @vite-ignore */ "./storage-implementations/fileBasedStorage.js");
          creatorFunctionName = "createFileBasedStorage";
        }
        break;

      case "supabase":
        // Supabase peut être utilisé sur Node, Deno ou Browser
        module = await import(/* @vite-ignore */ "./storage-implementations/supabaseStorage.js");
        creatorFunctionName = "createSupabaseStorage";
        break;

      default:
        throw new Error(`loadStorageCreator: unknown storage kind '${storageType}'`);
    }

    // 2. Si le module n'a pas été chargé pour l'environnement, lever une erreur (ou fallback)
    if (!module) {
      console.error(
        `Storage kind '${storageType}' requested in unsupported environment. Falling back to in-memory.`
      );
      return createInMemoryStorage;
    }

    // 3. Extraction de la fonction de création
    const createFunction = creatorFunctionName ? module[creatorFunctionName] : module.default;

    if (typeof createFunction !== "function") {
      throw new Error(
        `Le module pour '${storageType}' n'a pas d'export valide nommé '${creatorFunctionName || "default"}'.`
      );
    }

    return createFunction;
  } catch (error) {
    console.error(`Erreur lors du chargement dynamique de '${storageType}'`, error);
    // En cas d'échec d'import (dépendances manquantes, etc.), on fallback à in-memory
    if (storageType !== "memory") {
      console.warn(`Falling back to 'memory' storage.`);
      return createInMemoryStorage;
    }
    // Si c'était déjà 'memory' et ça échoue, on lève l'erreur
    throw error;
  }
}

// ======================================================================
// 2. FACTORY GÉNÉRIQUE
// ======================================================================

/**
 * Retourne une instance de StorageInterface.
 * Gère la logique de Singleton et de chargement dynamique.
 * @param {object} [options]
 * @param {StorageInterface} [options.storage] - Instance de storage fournie.
 * @param {string} [options.type] - Le type de storage à initialiser ('supabase' par défaut).
 * @param {string} [options.supabaseUrl] - Pour le matching de config Singleton.
 * @param {string} [options.supabaseServiceKey] - Pour le matching de config Singleton.
 * @param {string} [options.redisUrl] - Pour le matching de config Singleton.
 * @returns {Promise<StorageInterface>}
 */
export async function initStorage(options) {
  const providedStorage = options?.storage;
  // Utiliser 'supabase' comme type par défaut si non spécifié
  const storageType = options?.type?.toLowerCase() || "supabase";

  // Ensure ERROR_CODES is always available in options for storage implementations
  const currentOptions = { ...options, ERROR_CODES };

  // Générer une clé unique pour cette configuration de stockage
  const configKey = JSON.stringify({ type: storageType, ...currentOptions });

  // 1. Si une instance correspondante existe déjà, la retourner
  if (storages.has(configKey)) {
    return storages.get(configKey);
  }

  // 3. Initialisation du nouveau stockage via le chargeur dynamique
  try {
    const createFunction = await loadStorageCreator(storageType, currentOptions);

    // Créer la nouvelle instance
    const newStorage = createFunction(currentOptions);

    // S'assurer que le type est bien enregistré pour la logique de Singleton future
    newStorage.options = newStorage.options || {};
    newStorage.options.type = storageType;

    // Stocker la nouvelle instance dans la carte des storages
    storages.set(configKey, newStorage);

    return newStorage;
  } catch (error) {
    // Si l'erreur est due à des informations d'identification Supabase manquantes, basculer vers le stockage en mémoire.
    if (
      storageType === "supabase" &&
      (error.message.includes("supabaseUrl") || error.message.includes("supabaseServiceKey"))
    ) {
      console.warn(
        `Supabase storage failed to initialize due to missing credentials. Falling back to 'memory' storage.`
      );
      // Assurez-vous que createInMemoryStorage est importé et disponible
      const { createInMemoryStorage } =
        await import(/* @vite-ignore */ "./storage-implementations/inMemoryStorage.js");
      const inMemoryFallbackStorage = createInMemoryStorage(currentOptions);
      inMemoryFallbackStorage.options = inMemoryFallbackStorage.options || {};
      inMemoryFallbackStorage.options.type = "memory";
      storages.set(configKey, inMemoryFallbackStorage);
      return inMemoryFallbackStorage;
    }
    // Le loadStorageCreator gère déjà le fallback à 'memory' en cas d'échec
    // Sauf si l'échec est fatal (mémoire), dans ce cas, on propage l'erreur.
    throw error;
  }
}

/**
 * Définit le storage par défaut à utiliser par le noyau COP.
 * @param {StorageInterface} storage
 */

export function setStorage(storage) {
  defaultStorage = storage;
}

export async function getStorage() {
  if (!defaultStorage) {
    // Default to memory storage
    defaultStorage = await initStorage({ type: "memory" });
  }
  return defaultStorage;
}
