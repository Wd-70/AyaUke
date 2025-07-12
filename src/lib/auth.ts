import { auth } from "@/app/api/auth/[...nextauth]/route"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function getIsAyauke() {
  const session = await auth()
  return session?.user?.isAyauke ?? false
}

export { auth as getServerSession }