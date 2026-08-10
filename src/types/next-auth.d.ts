import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    avatarId?: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      avatarId: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    avatarId?: number;
  }
}
