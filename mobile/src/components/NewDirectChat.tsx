import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable as Pressable } from "./ui/MotionPressable";
import { api } from "@/services/api";
import type { Channel } from "@/types/chat";
import { useDirectory } from "./useDirectory";
import { BrutalInput } from "./brutal/BrutalInput";
import { BrutalButton } from "./brutal/BrutalButton";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";

export function NewDirectChat({
  currentUserId,
  onCreated,
}: {
  currentUserId: string;
  onCreated: (channel: Channel) => void;
}) {
  const people = useDirectory(api.fetchTeamDirectory);
  const colors = useBrutalTheme();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.ink }}>To:</Text>
      <BrutalInput
        accessibilityLabel="Find a person"
        placeholder="Search people in your group"
        value={people.query}
        onChangeText={people.search}
        maxLength={120}
      />
      {!!(error || people.error) && (
        <Text accessibilityRole="alert" style={{ color: colors.accentPink }}>
          {error || people.error}
        </Text>
      )}
      {people.loading && (
        <Text style={{ color: colors.inkMuted }}>Finding people…</Text>
      )}
      {people.page?.data
        .filter((p) => p.id !== currentUserId)
        .map((p) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${p.name}`}
            key={p.id}
            disabled={Boolean(pending)}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.bgCardAlt,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
            onPress={async () => {
              setPending(p.id);
              setError("");
              try {
                const result = await api.createDirect(p.id);
                if (alive.current) onCreated(result);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Could not open this conversation.",
                );
              } finally {
                setPending("");
              }
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 20 }}>
              {p.monogram}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: "600" }}>
                {p.name}
              </Text>
              <Text style={{ color: colors.inkMuted }}>@{p.handle}</Text>
            </View>
            {pending === p.id ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="forward" size={19} />}
          </Pressable>
        ))}
      {!people.loading &&
        !people.error &&
        !people.page?.data.some((p) => p.id !== currentUserId) && (
          <Text style={{ color: colors.inkMuted }}>
            No other people here yet. Invite someone through Manage groups.
          </Text>
        )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <BrutalButton
          title="Previous"
          disabled={!people.canPrevious || people.loading}
          onPress={people.previous}
        />
        <BrutalButton
          title="Next"
          disabled={!people.page?.hasMore || people.loading}
          onPress={people.next}
        />
      </View>
    </View>
  );
}
