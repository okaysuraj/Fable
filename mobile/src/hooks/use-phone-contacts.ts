import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  Contact,
  ContactField,
  ContactsSortOrder,
  requestPermissionsAsync,
} from "expo-contacts";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { api } from "@/services/api";
import type { User } from "@/types/chat";

export type PhoneContact = User & { contactName: string };

/** Read in native pages and match bounded batches; names stay on the device. */
export function usePhoneContacts(ownNumber?: string | null) {
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0);
  const busy = useRef(false);
  const done = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const loadMore = useCallback(async () => {
    if (busy.current || done.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        throw new Error(
          "Allow contacts access in your phone’s settings to find people you know on Fable.",
        );
      }
      setDenied(false);
      const country = ownNumber
        ? parsePhoneNumberFromString(ownNumber)?.country
        : undefined;
      const page = await Contact.getAllDetails(
        [ContactField.FULL_NAME, ContactField.PHONES] as const,
        {
          limit: 200,
          offset: offset.current,
          sortOrder: ContactsSortOrder.GivenName,
        },
      );
      const names = new Map<string, string>();
      for (const contact of page)
        for (const phone of contact.phones ?? []) {
          if (!phone.number) continue;
          const parsed = parsePhoneNumberFromString(phone.number, country);
          if (parsed?.isValid())
            names.set(parsed.number, contact.fullName?.trim() || parsed.number);
        }
      const numbers = [...names.keys()];
      const matches: PhoneContact[] = [];
      for (let start = 0; start < numbers.length; start += 500) {
        const users = await api.matchContacts(
          numbers.slice(start, start + 500),
          abort.signal,
        );
        for (const user of users)
          if (user.phoneNumber)
            matches.push({
              ...user,
              contactName: names.get(user.phoneNumber) || user.name,
            });
      }
      if (!alive.current || abort.signal.aborted) return;
      offset.current += page.length;
      done.current = page.length < 200;
      setHasMore(!done.current);
      setContacts((previous) =>
        [
          ...new Map(
            [...previous, ...matches].map((person) => [person.id, person]),
          ).values(),
        ].sort((a, b) => a.contactName.localeCompare(b.contactName)),
      );
    } catch (failure) {
      if (alive.current && !abort.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Couldn't load your contacts.",
        );
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [ownNumber]);
  useEffect(() => {
    alive.current = true;
    const timer = setTimeout(() => void loadMore(), 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadMore();
    });
    return () => {
      alive.current = false;
      controller.current?.abort();
      clearTimeout(timer);
      subscription.remove();
    };
  }, [loadMore]);
  return { contacts, loading, error, denied, hasMore, loadMore };
}
