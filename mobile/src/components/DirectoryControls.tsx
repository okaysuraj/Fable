/** Consistent search, failure feedback and cursor navigation for native server directories. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SearchField } from "./ui/SearchField";
import { BrutalButton } from "./brutal/BrutalButton";
import { Fonts } from "@/constants/theme";

interface Props {
  label: string;
  query: string;
  onSearch: (value: string) => void;
  total?: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
  canPrevious: boolean;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFirst: () => void;
  isFirst: boolean;
  showSearch?: boolean;
}
export function DirectoryControls({
  label,
  query,
  onSearch,
  total,
  loading,
  error,
  onRetry,
  canPrevious,
  hasMore,
  onPrevious,
  onNext,
  onFirst,
  isFirst,
  showSearch = true,
}: Props) {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  return (
    <View style={styles.container}>
      {showSearch && (
        <SearchField
          accessibilityLabel={label}
          placeholder={label}
          value={query}
          onChangeText={onSearch}
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={120}
        />
      )}
      {(canPrevious || hasMore || query) && (
        <Text style={styles.summary}>
          {total === undefined
            ? "Search results"
            : `${total} ${total === 1 ? "result" : "results"}`}
        </Text>
      )}
      {loading ? <ActivityIndicator color={BrutalColors.ink} /> : null}
      {error ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={{ color: BrutalColors.ink }}>
            {error}
          </Text>
          <BrutalButton
            size="sm"
            title="Retry results"
            variant="outline"
            onPress={onRetry}
          />
        </View>
      ) : null}
      {(canPrevious || hasMore) && (
        <View style={styles.buttons}>
          <BrutalButton
            title="Previous results"
            accessibilityLabel={`${label}: Previous results`}
            size="sm"
            variant="outline"
            disabled={loading || !canPrevious}
            onPress={onPrevious}
          />
          <BrutalButton
            title="Next results"
            accessibilityLabel={`${label}: Next results`}
            size="sm"
            variant="outline"
            disabled={loading || !hasMore}
            onPress={onNext}
          />
          {!isFirst ? (
            <BrutalButton
              title="First results"
              accessibilityLabel={`${label}: First results`}
              size="sm"
              variant="outline"
              disabled={loading}
              onPress={onFirst}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: { gap: 10, marginVertical: 12 },
    summary: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      color: BrutalColors.inkMuted,
    },
    buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  });
