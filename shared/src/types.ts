export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code:
      | "VALIDATION_ERROR"
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "PAYLOAD_TOO_LARGE"
      | "UNSUPPORTED_MEDIA"
      | "RATE_LIMITED"
      | "INTERNAL";
    message: string;
    details?: { path: string; message: string }[];
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;
