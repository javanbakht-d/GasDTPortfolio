/** کلاینت API — همراه مدیریت خطای فارسی */
export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // نشست منقضی — بازگشت به صفحه ورود
    const { useAppStore } = await import("@/store/app-store");
    useAppStore.getState().setUser(null);
    throw new ApiClientError(401, "UNAUTHENTICATED", "نشست منقضی شده است. لطفاً دوباره وارد شوید.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiClientError(res.status, err?.code ?? "ERROR", err?.message ?? "خطای ناشناخته در ارتباط با سامانه");
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
};
