import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { authApi } from "@/lib/api/auth"
import type { ApiErrorResponse } from "@/types/auth.types"
import { profileQueryKey } from "./useProfile"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface UpdateProfileFields {
  fullName: string
  /** null clears the phone; undefined means "don't send this field" */
  phone?: string | null
}

export interface UpdateProfileFieldErrors {
  fullName?: string
  phone?: string
}

export interface UpdateProfileError {
  /** Field-level validation errors returned by the backend */
  fieldErrors: UpdateProfileFieldErrors
  /** Generic server or network error message */
  message: string | null
}

/* ------------------------------------------------------------------ */
/*  Hook                                                                 */
/* ------------------------------------------------------------------ */

/**
 * useUpdateProfile — PATCH /users/me.
 * Contract: only fullName and phone are allowed; extra fields → 400.
 * phone: null clears the number; omitting phone leaves it unchanged.
 * On success: invalidates the profile query so the UI re-fetches.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fields: UpdateProfileFields) => {
      // Build a partial patch object — only include phone when explicitly provided
      const body: { fullName: string; phone?: string | null } = {
        fullName: fields.fullName.trim(),
      }
      if ("phone" in fields) {
        body.phone = fields.phone?.trim() || null
      }
      return authApi.updateMe(body).then((r) => r.data)
    },

    onSuccess: (updatedUser) => {
      // Update the cache directly so there's no extra round-trip
      queryClient.setQueryData(profileQueryKey, updatedUser)
    },


  })
}

/* ------------------------------------------------------------------ */
/*  Error parser (used by ProfilePage)                                  */
/* ------------------------------------------------------------------ */

/**
 * parseUpdateError — extract field-level and generic errors from an
 * AxiosError thrown by PATCH /users/me.
 */
export function parseUpdateError(error: unknown): UpdateProfileError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined
    if (data?.error?.details?.length) {
      const fieldErrors: UpdateProfileFieldErrors = {}
      data.error.details.forEach((d) => {
        if (d.field === "fullName" || d.field === "phone") {
          fieldErrors[d.field] = d.message
        }
      })
      return { fieldErrors, message: null }
    }
    return {
      fieldErrors: {},
      message: data?.error?.message ?? "Lưu thất bại. Vui lòng thử lại.",
    }
  }
  return { fieldErrors: {}, message: "Không kết nối được đến máy chủ." }
}
