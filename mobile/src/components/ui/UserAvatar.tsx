import { useEffect, useState } from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import { api, getApiBaseUrl, getSessionToken } from "@/services/api";
import type { User } from "@/types/chat";
import { MonogramAvatar } from "../brutal/MonogramAvatar";

export function UserAvatar({
  user,
  size = 46,
  self = false,
}: {
  user: User;
  size?: number;
  self?: boolean;
}) {
  const [loaded, setLoaded] = useState<{
    version: string;
    source: ImageSourcePropType;
  } | null>(null);
  const version = `${user.id}:${user.photoVersion ?? 0}:${self}`;
  const source =
    user.photoVersion && loaded?.version === version ? loaded.source : null;
  useEffect(() => {
    let alive = true;
    if (user.photoVersion)
      void getSessionToken()
        .then((token) => {
          if (!alive || !token) return;
          const workspace = api.getSelectedWorkspaceId();
          setLoaded({
            version,
            source: {
              uri: `${getApiBaseUrl()}${self ? "/auth/profile/photo" : `/team/profiles/${encodeURIComponent(user.id)}/photo`}?v=${user.photoVersion}`,
              headers: {
                Authorization: `Bearer ${token}`,
                ...(workspace ? { "X-Workspace-Id": workspace } : {}),
              },
            },
          });
        })
        .catch(() => {
          /* A failed photo lookup retains this real user's initials. */
        });
    return () => {
      alive = false;
    };
  }, [user.id, user.photoVersion, self, version]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <MonogramAvatar
        monogram={user.monogram}
        backgroundColor={user.avatarColor}
        size={size}
      />
      {source && (
        <Image
          source={source}
          style={{ position: "absolute", width: size, height: size }}
          onError={() => setLoaded(null)}
          accessible={false}
        />
      )}
    </View>
  );
}
