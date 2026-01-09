import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import {
  loadInstanceConfig,
  getConfig,
} from "../config/instanceConfig.backend.js";
import { substituteWithInstanceConfig } from "../lib/template.js";

const MIME_TYPES = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * Service pour explorer le répertoire public d'une application Inseme.
 * Utilisé par les fonctions backend (Netlify/Node) pour servir des fichiers statiques
 * ou des listes de répertoires avec protection contre le path traversal.
 */
export class PublicStorageService {
  constructor(rootPath = null) {
    // Par défaut, on cible le dossier 'public' du répertoire de travail actuel
    this.root = rootPath || path.join(process.cwd(), "public");
  }

  /**
   * Résout un chemin relatif en chemin absolu sécurisé.
   * @param {string} relativePath
   * @returns {string}
   */
  resolvePath(relativePath = "") {
    const rel = String(relativePath || "").replace(/^\/+/, "");
    const target = path.normalize(path.join(this.root, rel));
    const resolvedRoot = path.resolve(this.root);
    const resolvedTarget = path.resolve(target);

    if (!resolvedTarget.startsWith(resolvedRoot)) {
      throw new Error("Security Error: Path traversal attempt");
    }

    return resolvedTarget;
  }

  /**
   * Liste le contenu d'un répertoire.
   * @param {string} relativePath
   * @returns {Promise<Object>}
   */
  async listDirectory(relativePath = "") {
    const resolvedTarget = this.resolvePath(relativePath);
    const stat = await fs.stat(resolvedTarget);

    if (!stat.isDirectory()) {
      throw new Error("Not a directory");
    }

    const names = await fs.readdir(resolvedTarget, { withFileTypes: true });
    const items = names
      .map((d) => {
        const itemPath = path.join(resolvedTarget, d.name);
        let isDir = d.isDirectory();

        // Si c'est un lien symbolique, on vérifie si la cible est un dossier
        if (d.isSymbolicLink()) {
          try {
            isDir = fsSync.statSync(itemPath).isDirectory();
          } catch (e) {
            // Lien cassé ou inaccessible
          }
        }

        const href =
          path.posix.join("/", relativePath || "", d.name) + (isDir ? "/" : "");

        let size = 0;
        try {
          if (!isDir) {
            size = fsSync.statSync(itemPath).size || 0;
          }
        } catch (e) {
          console.warn(`Error stating file ${itemPath}:`, e);
        }

        return {
          name: d.name,
          href,
          isDir,
          size,
        };
      })
      .sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
      );

    return { items };
  }

  /**
   * Lit le contenu d'un fichier.
   * @param {string} relativePath
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async readFile(relativePath = "", options = { download: false }) {
    const resolvedTarget = this.resolvePath(relativePath);
    const stat = await fs.stat(resolvedTarget);

    if (!stat.isFile()) {
      throw new Error("Not a file");
    }

    const ext = path.extname(resolvedTarget).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const buf = await fs.readFile(resolvedTarget);

    const isBinary =
      !/^text\/|\/json|\/csv|\/markdown|^image\//.test(mime) &&
      mime !== "text/plain; charset=utf-8";

    let body = isBinary ? buf.toString("base64") : buf.toString("utf8");

    // Substitution de variables pour le Markdown et le HTML
    if (!isBinary && (ext === ".md" || ext === ".html")) {
      try {
        body = await substituteWithInstanceConfig(body, {
          loadConfig: loadInstanceConfig,
          getConfig,
        });
      } catch (err) {
        console.warn("[PublicStorage] Substitution failed:", err.message);
      }
    }

    return {
      file: true,
      name: path.basename(resolvedTarget),
      mime,
      base64: isBinary,
      body,
      size: stat.size,
    };
  }

  /**
   * Helper pour gérer une requête HTTP (Netlify style)
   * @param {Object} query - queryStringParameters
   * @returns {Promise<Object>}
   */
  async handleRequest(query = {}) {
    const relRaw = query.path || "";
    const download = query.download === "1" || query.download === "true";

    try {
      const resolvedTarget = this.resolvePath(relRaw);
      const stat = await fs.stat(resolvedTarget);

      if (stat.isDirectory()) {
        return await this.listDirectory(relRaw);
      } else {
        return await this.readFile(relRaw, { download });
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new Error(`Path not found: ${relRaw}`);
      }
      throw e;
    }
  }
}
