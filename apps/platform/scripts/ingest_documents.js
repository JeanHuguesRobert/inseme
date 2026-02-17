#!/usr/bin/env node

/**
 * Bulk Document Ingestion Script for Ophélia
 * Uploads documents to Supabase Storage and tracks them in database
 * Supports deduplication via content hashing
 */

import { storage } from "@inseme/cop-host";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { loadConfig, getConfig, createSupabaseClient } from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger la configuration
await loadConfig();

// Supabase client
const supabase = createSupabaseClient();

const STORAGE_BUCKET = getConfig("supabase_storage_bucket", "public-documents");
const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dir: null,
    file: null,
    type: null,
    date: null,
    sourceUrl: null,
    recursive: false,
    skipDuplicates: true,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--dir":
        options.dir = args[++i];
        break;
      case "--file":
        options.file = args[++i];
        break;
      case "--type":
        options.type = args[++i];
        break;
      case "--date":
        options.date = args[++i];
        break;
      case "--source-url":
        options.sourceUrl = args[++i];
        break;
      case "--recursive":
        options.recursive = true;
        break;
      case "--skip-duplicates":
        options.skipDuplicates = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
╭─────────────────────────────────────────────────────╮
│  Ophélia - Bulk Document Ingestion Script          │
╰─────────────────────────────────────────────────────╯

Usage:
  node scripts/ingest_documents.js [options]

Options:
  --dir <path>          Directory to scan for documents
  --file <path>         Single file to upload
  --type <type>         Document type (pv, rapport, deliberation, autre)
  --date <YYYY-MM-DD>   Document date
  --source-url <url>    URL of original source document (e.g., PDF link)
  --recursive           Scan directory recursively
  --skip-duplicates     Skip files that already exist (default: true)
  --dry-run             Show what would be uploaded without uploading
  --help, -h            Show this help message

Examples:
  # Upload markdown files from a directory
  node scripts/ingest_documents.js --dir ./markdown-docs --type pv

  # Upload single file with metadata and source URL
  node scripts/ingest_documents.js --file ./extracted.md --type rapport --date 2024-01-15 --source-url https://example.com/original.pdf

  # Dry run to see what would be uploaded
  node scripts/ingest_documents.js --dir ./archives --recursive --dry-run

Supported file types: ${SUPPORTED_EXTENSIONS.join(", ")}
`);
}

// Calculate SHA-256 hash of file content
async function calculateHash(filePath) {
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

// Extract metadata from filename (simple pattern matching)
function extractMetadataFromFilename(filename) {
  const metadata = {};

  // Try to extract date (YYYY-MM-DD or YYYY_MM_DD or YYYYMMDD)
  const dateMatch = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (dateMatch) {
    metadata.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // Try to extract type from filename
  const lowerName = filename.toLowerCase();
  if (lowerName.includes("pv") || lowerName.includes("proces")) {
    metadata.type = "pv";
  } else if (lowerName.includes("rapport") || lowerName.includes("report")) {
    metadata.type = "rapport";
  } else if (lowerName.includes("deliberation") || lowerName.includes("delib")) {
    metadata.type = "deliberation";
  } else if (lowerName.includes("convocation")) {
    metadata.type = "convocation";
  }

  return metadata;
}

// Check if document exists by hash
async function checkDuplicate(contentHash) {
  const { data, error } = await supabase
    .from("document_sources")
    .select("*")
    .eq("content_hash", contentHash)
    .eq("status", "active")
    .single();

  return data;
}

// Upload single document
async function uploadDocument(filePath, options) {
  const filename = path.basename(filePath);
  const stats = await fs.stat(filePath);

  console.log(`\n📄 Processing: ${filename}`);

  // 1. Calculate hash
  const contentHash = await calculateHash(filePath);
  console.log(`   Hash: ${contentHash.substring(0, 16)}...`);

  // 2. Check for duplicates
  if (options.skipDuplicates) {
    const existing = await checkDuplicate(contentHash);
    if (existing) {
      console.log(`   ⚠️  Already exists: ${existing.filename} (skipping)`);
      return { skipped: true, reason: "duplicate" };
    }
  }

  if (options.dryRun) {
    console.log(`   🔍 [DRY RUN] Would upload this file`);
    return { dryRun: true };
  }

  // 3. Prepare metadata
  const extractedMeta = extractMetadataFromFilename(filename);
  const metadata = {
    ...extractedMeta,
    ...(options.type && { type: options.type }),
    ...(options.date && { date: options.date }),
    ...(options.sourceUrl && { source_url: options.sourceUrl }),
  };

  console.log(`   📋 Metadata:`, JSON.stringify(metadata, null, 2));

  // 4. Upload to storage
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  const storagePath = `${timestamp}_${sanitized}`;

  const fileBuffer = await fs.readFile(filePath);
  try {
    const { path: uploadedPath, url: publicUrl } = await storage.upload(
      STORAGE_BUCKET,
      storagePath,
      fileBuffer,
      {
        contentType: getMimeType(filename),
      }
    );

    // 6. Insert into database
    const { data: dbData, error: dbError } = await supabase
      .from("document_sources")
      .insert({
        filename: sanitized,
        content_hash: contentHash,
        public_url: publicUrl,
        file_size_bytes: stats.size,
        mime_type: getMimeType(filename),
        metadata: metadata,
        ingestion_method: "cli_bulk",
        status: "active",
      })
      .select()
      .single();

    if (dbError) {
      console.error(`   ❌ Database error:`, dbError.message);
      // Try to clean up storage
      await storage.remove(STORAGE_BUCKET, [storagePath]);
      return { error: dbError.message };
    }

    console.log(`   ✅ Uploaded successfully! ID: ${dbData.id}`);
    console.log(`   🔗 URL: ${publicUrl}`);

    return { success: true, documentId: dbData.id };
  } catch (uploadError) {
    console.error(`   ❌ Upload failed:`, uploadError.message);
    return { error: uploadError.message };
  }
}

// Get MIME type from filename
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "text/plain";
}

// Scan directory for supported files
async function scanDirectory(dirPath, recursive = false) {
  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      const subFiles = await scanDirectory(fullPath, recursive);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Main function
async function main() {
  const options = parseArgs();

  console.log(`
╭─────────────────────────────────────────────────────╮
│  Starting Bulk Document Ingestion                  │
╰─────────────────────────────────────────────────────╯
`);

  if (options.dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be uploaded\n");
  }

  let filesToProcess = [];

  // Determine files to process
  if (options.file) {
    // Single file mode
    filesToProcess = [options.file];
  } else if (options.dir) {
    // Directory scan mode
    console.log(`📂 Scanning directory: ${options.dir}`);
    if (options.recursive) {
      console.log("   (Recursive mode enabled)");
    }
    filesToProcess = await scanDirectory(options.dir, options.recursive);
    console.log(`   Found ${filesToProcess.length} supported files\n`);
  } else {
    console.error("❌ Error: You must specify either --file or --dir");
    printHelp();
    process.exit(1);
  }

  if (filesToProcess.length === 0) {
    console.log("No files to process.");
    return;
  }

  // Process files
  const results = {
    total: filesToProcess.length,
    success: 0,
    skipped: 0,
    failed: 0,
    dryRun: 0,
  };

  for (const filePath of filesToProcess) {
    try {
      const result = await uploadDocument(filePath, options);

      if (result.success) results.success++;
      else if (result.skipped) results.skipped++;
      else if (result.dryRun) results.dryRun++;
      else if (result.error) results.failed++;
    } catch (error) {
      console.error(`\n❌ Unexpected error processing ${path.basename(filePath)}:`, error.message);
      results.failed++;
    }
  }

  // Print summary
  console.log(`
╭─────────────────────────────────────────────────────╮
│  Ingestion Summary                                  │
╰─────────────────────────────────────────────────────╯

Total files processed:  ${results.total}
✅ Successfully uploaded: ${results.success}
⏭️  Skipped (duplicates):  ${results.skipped}
❌ Failed:                ${results.failed}
${options.dryRun ? `🔍 Dry run (not uploaded): ${results.dryRun}` : ""}

${results.success > 0 ? "✨ Documents ready for cache rebuild! Run:\n   node scripts/create_cache.js\n" : ""}
`);

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run main function
main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
