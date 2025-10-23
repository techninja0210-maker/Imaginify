import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";
import { canAccessAdmin } from "./roles";

export async function requireAdmin() {
  const { userId } = auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserById(userId);
  
  if (!user) {
    redirect("/sign-in");
  }

  if (!canAccessAdmin(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireSuperAdmin() {
  const { userId } = auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserById(userId);
  
  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== 'SUPER_ADMIN') {
    redirect("/dashboard");
  }

  return user;
}



