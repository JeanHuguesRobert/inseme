import React, { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useCurrentUser } from "@inseme/cop-host";

export default function AdminAPI() {
  const { currentUser } = useCurrentUser();
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load OpenAPI spec
    fetch("/docs/openapi.yaml")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load API specification");
        return res.text();
      })
      .then((yamlText) => {
        // Parse YAML to JSON (Swagger UI can handle YAML directly, but we parse for validation)
        setSpec(yamlText);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading API spec:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const onComplete = (system) => {
    // Automatically inject the Bearer token from the current session
    if (currentUser?.access_token) {
      system.authActions.authorize({
        bearerAuth: {
          value: currentUser.access_token,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="error-state">
          <h2>⚠️ Error Loading API Specification</h2>
          <p>{error}</p>
          <p className="hint">
            Make sure <code>/docs/openapi.yaml</code> is accessible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page admin-api">
      <div className="admin-header">
        <h1>🔧 API Testing Console</h1>
        <p className="subtitle">Interactive API documentation and testing interface</p>
        {currentUser?.access_token ? (
          <div className="auth-status">
            ✅ Authenticated as <strong>{currentUser.email}</strong>
          </div>
        ) : (
          <div className="auth-status warning">⚠️ Not authenticated - API calls will fail</div>
        )}
      </div>

      <div className="swagger-container">
        <SwaggerUI
          spec={spec}
          onComplete={onComplete}
          docExpansion="list"
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          tryItOutEnabled={true}
        />
      </div>

      <style jsx>{`
        .admin-api {
          max-width: 100%;
          padding: 0;
        }

        .admin-header {
          background: var(--surface-color, #fff);
          padding: 2rem;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          margin-bottom: 0;
        }

        .admin-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 1.75rem;
        }

        .subtitle {
          color: var(--text-secondary, #666);
          margin: 0 0 1rem 0;
        }

        .auth-status {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .auth-status.warning {
          background: #fff3e0;
          color: #f57c00;
        }

        .swagger-container {
          background: #fafafa;
        }

        .loading-state,
        .error-state {
          padding: 4rem 2rem;
          text-align: center;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid var(--primary-color, #3b82f6);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .error-state h2 {
          color: #d32f2f;
          margin-bottom: 1rem;
        }

        .hint {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 4px;
          margin-top: 1rem;
          font-family: monospace;
          font-size: 0.875rem;
        }

        /* Override some Swagger UI defaults for better integration */
        :global(.swagger-ui .topbar) {
          display: none;
        }

        :global(.swagger-ui .information-container) {
          background: white;
          padding: 2rem;
        }

        :global(.swagger-ui .scheme-container) {
          background: white;
          padding: 2rem;
          border-bottom: 1px solid #e0e0e0;
        }
      `}</style>
    </div>
  );
}
