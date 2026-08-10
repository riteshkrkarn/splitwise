import { auth } from "@/auth";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <ProfileClient
      name={session.user.name}
      email={session.user.email}
      avatarId={session.user.avatarId}
    />
  );
}
