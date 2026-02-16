import { NextResponse } from "next/server";

type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200
) {
  const body: SuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function apiError(code: string, message: string, status = 400) {
  const body: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  return NextResponse.json(body, { status });
}
