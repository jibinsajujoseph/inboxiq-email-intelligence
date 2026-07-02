export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type EmailListQuery = {
  intent?: string;
  department?: string;
  review_status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type TopPrediction = {
  intent: string;
  confidence: number;
};

export type EmailPredictionSummary = {
  intent: string | null;
  confidence: number | null;
  confidence_tier: string | null;
  top3: TopPrediction[] | null;
  department: string | null;
  priority: string | null;
  sla_minutes: number | null;
  reviewed: boolean;
  was_corrected: boolean;
};

export type EmailListItem = {
  id: number;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  prediction: EmailPredictionSummary;
};

export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type EmailListResponse = {
  items: EmailListItem[];
  pagination: PaginationMeta;
};

export type EmailDetail = {
  id: number;
  gmail_message_id: string | null;
  thread_id: string | null;
  sender: string | null;
  subject: string | null;
  body: string | null;
  received_at: string | null;
  created_at: string | null;
  prediction: {
    intent: string;
    confidence: number;
    top3: TopPrediction[];
  } | null;
  department: string | null;
  priority: string | null;
  sla_minutes: number | null;
  processed_at: string | null;
  confidence_tier: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  original_intent: string | null;
  was_corrected: boolean;
};

export type CountByLabel = {
  label: string;
  count: number;
};

export type StatsResponse = {
  total_emails: number;
  avg_confidence: number;
  by_intent: CountByLabel[];
  by_department: CountByLabel[];
  unreviewed_count: number;
  needs_review_count: number;
  manual_review_count: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchEmails(
  query: EmailListQuery,
  signal?: AbortSignal,
): Promise<EmailListResponse> {
  const params = new URLSearchParams();

  if (query.intent) {
    params.set("intent", query.intent);
  }
  if (query.department) {
    params.set("department", query.department);
  }
  if (query.review_status) {
    params.set("review_status", query.review_status);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("page_size", String(query.pageSize));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<EmailListResponse>(`/emails${suffix}`, { signal });
}

export async function fetchEmailDetail(
  emailId: number,
  signal?: AbortSignal,
): Promise<EmailDetail> {
  return request<EmailDetail>(`/emails/${emailId}`, { signal });
}

export async function fetchStats(signal?: AbortSignal): Promise<StatsResponse> {
  return request<StatsResponse>("/stats", { signal });
}

export async function reviewEmail(
  emailId: number,
  correctedIntent?: string,
  signal?: AbortSignal,
): Promise<EmailDetail> {
  return request<EmailDetail>(`/emails/${emailId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ corrected_intent: correctedIntent || null }),
    signal,
  });
}

export type AuthStatus = {
  connected: boolean;
  email: string | null;
};

export async function fetchAuthStatus(
  signal?: AbortSignal,
): Promise<AuthStatus> {
  return request<AuthStatus>("/auth/google/status", { signal });
}

export async function disconnectGmail(
  signal?: AbortSignal,
): Promise<{ disconnected: boolean }> {
  return request<{ disconnected: boolean }>("/auth/google/disconnect", {
    method: "POST",
    signal,
  });
}
