"use client";

import Image from "next/image";
import { AVATAR_IDS, avatarSrc, cn } from "@/lib/utils";

export function AvatarPicker({
  value,
  onChange,
  label = "Choose avatar",
}: {
  value: number;
  onChange: (id: number) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label={label}>
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={value === id}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full ring-offset-2 ring-offset-bg transition duration-150",
              value === id
                ? "ring-2 ring-primary"
                : "opacity-70 hover:opacity-100"
            )}
          >
            <Image
              src={avatarSrc(id)}
              alt={`Avatar ${id}`}
              width={52}
              height={52}
              className="rounded-full"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
