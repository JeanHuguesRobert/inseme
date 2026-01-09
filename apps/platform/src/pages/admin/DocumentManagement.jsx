import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { useNavigate } from "react-router-dom";

const STORAGE_BUCKET = "public-documents";
const SUPPORTED_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
const ACCEPTED_EXTENSIONS = ".txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.svg";

export default function DocumentManagement() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedFile, setSelectedFile] = useState(null);
  const [metadata, setMetadata] = useState({
    type: "autre",
    date: "",
    description: "",
    source_url: "",
  });
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
    loadDocuments();
  }, []);

  async function checkAuth() {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();
    if (!user) {
      navigate("/login");
    }
  }

  async function loadDocuments() {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("document_sources")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading documents:", error);
      setError("Failed to load documents");
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }

  async function calculateHash(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }

  async function handleFileUpload() {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress("Calculating hash...");

    try {
      // 1. Calculate hash
      const contentHash = await calculateHash(selectedFile);

      // 2. Check for duplicates
      setUploadProgress("Checking for duplicates...");
      const { data: existing } = await getSupabase()
        .from("document_sources")
        .select("*")
        .eq("content_hash", contentHash)
        .eq("status", "active")
        .single();

      if (existing) {
        setError(`Duplicate detected! This file already exists as: ${existing.filename}`);
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      // 3. Upload to storage
      setUploadProgress("Uploading to storage...");
      const timestamp = Date.now();
      const sanitized = sanitizeFilename(selectedFile.name);
      const storagePath = `${timestamp}_${sanitized}`;

      const { error: uploadError } = await getSupabase()
        .storage.from(STORAGE_BUCKET)
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 4. Get public URL
      const { data: urlData } = getSupabase()
        .storage.from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      // 5. Insert into database
      setUploadProgress("Saving to database...");
      const {
        data: { user },
      } = await getSupabase().auth.getUser();

      const { error: dbError } = await getSupabase().from("document_sources").insert({
        filename: sanitized,
        content_hash: contentHash,
        public_url: urlData.publicUrl,
        file_size_bytes: selectedFile.size,
        mime_type: selectedFile.type,
        metadata: metadata,
        ingestion_method: "ui_upload",
        status: "active",
        ingested_by: user?.id,
      });

      if (dbError) throw dbError;

      // Success!
      setUploadProgress("✅ Upload successful!");
      setTimeout(() => {
        setUploadProgress(null);
        setSelectedFile(null);
        setMetadata({ type: "autre", date: "", description: "", source_url: "" });
        loadDocuments();
      }, 2000);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId) {
    if (!confirm("Are you sure you want to archive this document?")) return;

    const { error } = await getSupabase()
      .from("document_sources")
      .update({ status: "archived" })
      .eq("id", docId);

    if (error) {
      setError("Failed to archive document");
    } else {
      loadDocuments();
    }
  }

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || doc.metadata?.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Document Management</h1>
        <p className="text-gray-300">Upload and manage documents for the Ophélia chatbot</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200   text-red-800">{error}</div>
      )}

      {/* Upload Section */}
      <div className=" shadow   p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Document</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select File</label>
          <input
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(e) => setSelectedFile(e.target.files[0])}
            className="w-full p-2 border "
            disabled={uploading}
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-300">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Document Type</label>
            <select
              value={metadata.type}
              onChange={(e) => setMetadata({ ...metadata, type: e.target.value })}
              className="w-full p-2 border "
              disabled={uploading}
            >
              <option value="pv">Procès-Verbal</option>
              <option value="deliberation">Délibération</option>
              <option value="rapport">Rapport</option>
              <option value="convocation">Convocation</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date</label>
            <input
              type="date"
              value={metadata.date}
              onChange={(e) => setMetadata({ ...metadata, date: e.target.value })}
              className="w-full p-2 border "
              disabled={uploading}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Description (optional)</label>
          <textarea
            value={metadata.description}
            onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
            className="w-full p-2 border "
            rows="2"
            disabled={uploading}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">URL Source (optional)</label>
          <input
            type="url"
            value={metadata.source_url}
            onChange={(e) => setMetadata({ ...metadata, source_url: e.target.value })}
            className="w-full p-2 border "
            placeholder="https://example.com/original-document.pdf"
            disabled={uploading}
          />
          <p className="text-xs text-gray-400 mt-1">
            Lien vers le document original (PDF, Google Docs, etc.)
          </p>
        </div>

        {uploadProgress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800">
            {uploadProgress}
          </div>
        )}

        <button
          onClick={handleFileUpload}
          disabled={!selectedFile || uploading}
          className="bg-blue-600 text-bauhaus-white px-6 py-2 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </button>
      </div>

      {/* Documents List */}
      <div className=" shadow   p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Documents ({filteredDocs.length})</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 border "
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-2 border "
            >
              <option value="all">All Types</option>
              <option value="pv">PV</option>
              <option value="deliberation">Délibération</option>
              <option value="rapport">Rapport</option>
              <option value="convocation">Convocation</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-8 text-gray-400">Loading...</p>
        ) : filteredDocs.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No documents found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Filename</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Size</th>
                  <th className="px-4 py-2 text-left">Uploaded</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{doc.filename}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm">
                        {doc.metadata?.type || "autre"}
                      </span>
                    </td>
                    <td className="px-4 py-2">{doc.metadata?.date || "-"}</td>
                    <td className="px-4 py-2">{(doc.file_size_bytes / 1024).toFixed(2)} KB</td>
                    <td className="px-4 py-2">{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <a
                          href={doc.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cache Rebuild Notice */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200  ">
        <p className="text-yellow-800 font-medium mb-2">📋 Next Steps:</p>
        <p className="text-yellow-700 text-sm mb-2">
          After uploading documents, you need to rebuild the Gemini Context Cache:
        </p>
        <code className="block bg-yellow-100 p-2 text-sm">node scripts/create_cache.js</code>
        <p className="text-yellow-700 text-sm mt-2">
          Then update your .env file with the new GEMINI_CACHE_ID and restart the server.
        </p>
      </div>
    </div>
  );
}
