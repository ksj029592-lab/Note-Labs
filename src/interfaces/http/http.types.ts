export type HttpMethod = "GET" | "POST";

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
};

export type HttpResponse<T = unknown> = {
  status: number;
  body: T;
};
