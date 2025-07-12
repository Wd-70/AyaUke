import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      naverId: string
      channelId: string
      channelName: string
      channelImageUrl: string
      followerCount: number
      isAdmin: boolean
      adminRole: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    naverId: string
    channelId: string
    channelName: string
    channelImageUrl: string
    followerCount: number
    isAdmin: boolean
    adminRole: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    naverId: string
    channelId: string
    channelName: string
    channelImageUrl: string
    followerCount: number
    isAdmin: boolean
    adminRole: string
  }
}