import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <ProfileClient
      name={session.user.name}
      email={session.user.email}
      avatarId={session.user.avatarId}
    />
  );
}
