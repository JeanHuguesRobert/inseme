export async function wrapFetch(url, options = {}) {
  const { token, headers = {}, onAuthError } = options;
  const fetchOptions = { ...options };

  // If body is FormData, do not set Content-Type (browser will set multipart boundary)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  fetchOptions.headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };
  if (token) fetchOptions.headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, fetchOptions);
  if (res.status === 401 || res.status === 403) {
    if (typeof onAuthError === "function") onAuthError(res);
    const err = new Error(`Unauthorized (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data?.message || "Request failed");
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // fallback - return text
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || "Request failed");
    err.status = res.status;
    throw err;
  }
  return text;
}
