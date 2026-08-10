import Image from "next/image";
import { avatarSrc, cn } from "@/lib/utils";

export function AvatarDisplay({
  avatarId,
  name,
  size = 40,
  className,
}: {
  avatarId: number;
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={avatarSrc(avatarId)}
      alt={name ?? "Avatar"}
      width={size}
      height={size}
      className={cn("rounded-full", className)}
    />
  );
}
