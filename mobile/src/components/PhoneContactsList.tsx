import { useEffect, useRef } from "react";
import {
  FlatList,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  usePhoneContacts,
  type PhoneContact,
} from "@/hooks/use-phone-contacts";
import { useEmailContactSearch } from "@/hooks/use-email-contact-search";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import { AppIcon } from "./ui/AppIcon";
import { UserAvatar } from "./ui/UserAvatar";
import { MotionPressable } from "./ui/MotionPressable";
import { BrutalButton } from "./brutal/BrutalButton";

export function PhoneContactsList({
  ownNumber,
  query,
  selected = [],
  onSelect,
  disabled = false,
  onReady,
  selectionMode = "multiple",
}: {
  ownNumber?: string | null;
  query: string;
  selected?: string[];
  onSelect: (person: PhoneContact) => void;
  disabled?: boolean;
  onReady?: () => void;
  selectionMode?: "multiple" | "single" | "none";
}) {
  const colors = useBrutalTheme();
  const contacts = usePhoneContacts(ownNumber);
  const emailSearch = useEmailContactSearch(query);
  const emailMode = emailSearch.active;
  const loading = emailMode ? emailSearch.loading : contacts.loading;
  const error = emailMode ? emailSearch.error : contacts.error;
  const hasMore = !emailMode && contacts.hasMore;
  const { loadMore } = contacts;
  useEffect(() => {
    if (!query.trim() || loading || !hasMore || error) return;
    const timer = setTimeout(() => void loadMore(), 120);
    return () => clearTimeout(timer);
  }, [query, loading, hasMore, error, loadMore]);
  const ready = useRef(false);
  useEffect(() => {
    if (!contacts.loading && !ready.current) {
      ready.current = true;
      onReady?.();
    }
  }, [contacts.loading, onReady]);
  const term = query.trim().toLocaleLowerCase();
  const numberTerm = query.replace(/[^\d+]/g, "");
  const rows: PhoneContact[] = emailMode
    ? emailSearch.people.map((person) => ({
        ...person,
        contactName: person.name,
      }))
    : contacts.contacts.filter(
        (person) =>
          !term ||
          person.contactName.toLocaleLowerCase().includes(term) ||
          person.name.toLocaleLowerCase().includes(term) ||
          (numberTerm && person.phoneNumber?.includes(numberTerm)),
      );
  return (
    <FlatList
      data={rows}
      keyExtractor={(person) => person.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.list}
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      windowSize={5}
      onEndReached={() => {
        if (hasMore && !loading && !error) void loadMore();
      }}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => (
        <MotionPressable
          accessibilityRole={
            selectionMode === "none"
              ? "button"
              : selectionMode === "single"
                ? "radio"
                : "checkbox"
          }
          accessibilityLabel={`${item.contactName}, Fable profile ${item.name}`}
          accessibilityState={{
            ...(selectionMode !== "none"
              ? { checked: selected.includes(item.id) }
              : {}),
            disabled,
          }}
          disabled={disabled}
          onPress={() => onSelect(item)}
          style={styles.row}
        >
          <UserAvatar user={item} size={46} />
          <View style={styles.body}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: colors.ink }]}
            >
              {item.contactName}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.detail, { color: colors.inkMuted }]}
            >
              {emailMode
                ? "Found by email"
                : `${item.name} · ${item.phoneNumber}`}
            </Text>
          </View>
          <AppIcon
            name={
              selectionMode === "none"
                ? "forward"
                : selected.includes(item.id)
                  ? "selected"
                  : "circle"
            }
            color={
              selected.includes(item.id) ? colors.primary : colors.inkFaint
            }
            size={25}
          />
        </MotionPressable>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <View style={styles.empty}>
            <AppIcon name={emailMode ? "mail" : "people"} size={38} />
            <Text style={[styles.name, { color: colors.ink }]}>
              {emailMode
                ? emailSearch.valid
                  ? "No account found"
                  : "Find someone by email"
                : hasMore
                  ? "Searching your contacts…"
                  : query
                    ? "No matching contacts"
                    : "Your contacts on Fable"}
            </Text>
            <Text style={[styles.copy, { color: colors.inkMuted }]}>
              {emailMode
                ? emailSearch.valid
                  ? "No other Fable account matches this email address."
                  : "Enter a complete email address to find someone on Fable."
                : hasMore
                  ? "Load more contacts to keep looking."
                  : "Find phone contacts on Fable, or enter someone's full email address above."}
              {!emailMode && !ownNumber
                ? " Add your number with its country code in Your Profile to match local-format numbers."
                : ""}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              accessibilityLabel={
                emailMode ? "Searching by email" : "Loading contacts"
              }
            />
          ) : null}
          {error ? (
            <>
              <Text
                accessibilityRole="alert"
                style={[styles.copy, { color: colors.dangerButton }]}
              >
                {error}
              </Text>
              <BrutalButton
                title={
                  emailMode
                    ? "Retry email search"
                    : contacts.denied
                      ? "Open phone settings"
                      : "Retry contacts"
                }
                variant="outline"
                onPress={() => {
                  if (emailMode) emailSearch.retry();
                  else if (contacts.denied) void Linking.openSettings();
                  else void loadMore();
                }}
              />
              {!emailMode && contacts.denied ? (
                <Text style={[styles.copy, { color: colors.inkMuted }]}>
                  You can also enter a full email address above without allowing
                  contacts access.
                </Text>
              ) : null}
            </>
          ) : !loading && hasMore ? (
            <BrutalButton
              title="Load more contacts"
              variant="outline"
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      }
    />
  );
}
const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 12,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: Fonts.medium, fontSize: 17 },
  detail: { fontFamily: Fonts.sans, fontSize: 12, marginTop: 5 },
  empty: { alignItems: "center", paddingTop: 48, paddingBottom: 24, gap: 15 },
  copy: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  footer: { padding: 16, gap: 16 },
});
