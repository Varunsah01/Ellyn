"use client";

import { useEffect, useState } from "react";
import { CSRF_FORM_FIELD, getCsrfTokenFromDocument } from "@/lib/csrf";

/**
 * Render the CsrfHiddenInput component.
 * @returns {unknown} JSX output for CsrfHiddenInput.
 * @example
 * <CsrfHiddenInput />
 */
export function CsrfHiddenInput() {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    setCsrfToken(getCsrfTokenFromDocument());
  }, []);

  return <input type="hidden" name={CSRF_FORM_FIELD} value={csrfToken} readOnly />;
}

