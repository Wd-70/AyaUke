import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      naverId: string
      channelId: string
      userId: string // MongoDB ObjectId
      channelName: string
      channelImageUrl: string
      followerCount: number
      isAdmin: boolean
      adminRole: string
      selectedTitle: {
        id: string
        name: string
        description: string
        rarity: string
        colorClass: string
      } | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    naverId: string
    channelId: string
    userId: string // MongoDB ObjectId
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
    userId: string // MongoDB ObjectId
    channelName: string
    channelImageUrl: string
    followerCount: number
    isAdmin: boolean
    adminRole: string
  }
}