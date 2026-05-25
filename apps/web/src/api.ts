const headers = (): HeadersInit => {
  const userId = localStorage.getItem("fot_user") || "admin";
  return { "X-User-Id": userId };
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)) : JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const uploadFile = async (path: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(path, { method: "POST", body: fd, headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
};
