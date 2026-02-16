import { getSession } from "@/lib/auth/session";
import { HeaderClient } from "./header-client";

export async function Header() {
  const session = await getSession();

  return (
    <HeaderClient
      user={
        session
          ? {
              displayName: session.profile?.display_name ?? session.user.email ?? "",
              avatarUrl: session.profile?.avatar_url ?? undefined,
              role: session.profile?.role ?? "user",
            }
          : null
      }
    />
  );
}
