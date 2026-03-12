const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return url.replace(/\/$/, "");
};

const FETCH_TIMEOUT_MS = 15000;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => {
        headers[k] = v;
      });
    } else {
      Object.assign(headers, options.headers as Record<string, string>);
    }
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error) {
      if (e.name === "AbortError") {
        throw new Error("Request timed out. Check that the API is running and NEXT_PUBLIC_API_URL is correct.");
      }
      if (e.message?.includes("fetch")) {
        throw new Error("Network error. Check that the API is reachable at " + base);
      }
    }
    throw e;
  }
  clearTimeout(timeoutId);
  if (!res.ok) {
    const text = await res.text();
    let errMsg = `API error ${res.status}: ${res.statusText}`;
    try {
      const json = JSON.parse(text);
      errMsg = json.message || json.error || errMsg;
    } catch {
      if (text) errMsg = text;
    }
    throw new Error(errMsg);
  }
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

export async function apiFetchBlob<T = Blob>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.blob() as Promise<T>;
}

export async function apiUpload(
  path: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<{ url: string }> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => {
        headers[k] = v;
      });
    } else {
      Object.assign(headers, options.headers as Record<string, string>);
    }
  }
  delete headers["Content-Type"];
  const res = await fetch(url, {
    ...options,
    method: "POST",
    body: formData,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Upload failed ${res.status}: ${res.statusText}`;
    try {
      const json = JSON.parse(text);
      errMsg = json.message || json.error || errMsg;
    } catch {
      if (text) errMsg = text;
    }
    throw new Error(errMsg);
  }
  const data = await res.json();
  const fileUrl = data?.file?.url ?? data?.url;
  if (!fileUrl || typeof fileUrl !== "string") {
    throw new Error("Upload response missing file URL");
  }
  return { url: fileUrl };
}
