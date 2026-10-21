import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { User } from "@/types/chat";

interface SearchResult {
  email: string;
  attempt: number;
  people: User[];
  error: string;
}

/** Exact email discovery is independent of address-book permission and phone numbers. */
export function useEmailContactSearch(query: string) {
  const email = query.trim().toLowerCase();
  const active = email.includes("@");
  const valid = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api
        .findContactByEmail(email, controller.signal)
        .then((people) => {
          if (!controller.signal.aborted)
            setResult({ email, attempt, people, error: "" });
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted)
            setResult({
              email,
              attempt,
              people: [],
              error:
                failure instanceof Error
                  ? failure.message
                  : "Couldn't search by email. Please try again.",
            });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email, valid, attempt]);

  // Never show or select a previous address's result while a new request is pending.
  const current =
    result?.email === email && result.attempt === attempt ? result : null;
  return {
    active,
    valid,
    people: current?.people ?? [],
    loading: valid && !current,
    error: current?.error ?? "",
    retry: () => setAttempt((previous) => previous + 1),
  };
}
