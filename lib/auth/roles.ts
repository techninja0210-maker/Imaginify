import { UserRole } from "@prisma/client";

/**
 * Role-based permission system for Imaginify
 * Defines what actions each role can perform
 */

export function canUpdateUserCredits(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canDeleteUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canUpdateUserRoles(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageOrganizations(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function canViewAllUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageSystemSettings(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: UserRole): number {
  switch (role) {
    case "USER":
      return 1;
    case "ADMIN":
      return 2;
    case "SUPER_ADMIN":
      return 3;
    default:
      return 0;
  }
}

/**
 * Check if a role has higher or equal permissions than another
 */
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}
