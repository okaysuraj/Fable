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
  const { loading, hasMore, error, loadMore } = contacts;
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
  const rows = contacts.contacts.filter(
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
        if (contacts.hasMore && !contacts.loading && !contacts.error)
          void contacts.loadMore();
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
              {item.name} · {item.phoneNumber}
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
        !contacts.loading && !contacts.error ? (
          <View style={styles.empty}>
            <AppIcon name="people" size={38} />
            <Text style={[styles.name, { color: colors.ink }]}>
              {contacts.hasMore
                ? "Searching your contacts…"
                : query
                  ? "No matching contacts"
                  : "Your contacts on Fable"}
            </Text>
            <Text style={[styles.copy, { color: colors.inkMuted }]}>
              {contacts.hasMore
                ? "Load more contacts to keep looking."
                : "Contacts appear here when their Fable profile has a matching phone number."}
              {!ownNumber
                ? " Add your number with its country code in Your Profile to match local-format numbers."
                : ""}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {contacts.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
          {contacts.error ? (
            <>
              <Text
                accessibilityRole="alert"
                style={[styles.copy, { color: colors.dangerButton }]}
              >
                {contacts.error}
              </Text>
              <BrutalButton
                title={
                  contacts.denied ? "Open phone settings" : "Retry contacts"
                }
                variant="outline"
                onPress={() => {
                  if (contacts.denied) void Linking.openSettings();
                  else void contacts.loadMore();
                }}
              />
            </>
          ) : !contacts.loading && contacts.hasMore ? (
            <BrutalButton
              title="Load more contacts"
              variant="outline"
              onPress={() => void contacts.loadMore()}
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
