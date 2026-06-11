import type { PortalType } from "./types";

/** Map legacy DB portal enum values (admin_1, admin_2, …) to current roles. */
export function normalizePortalType(raw: string | null | undefined): PortalType | null {
  if (!raw) return null;
  switch (raw) {
    case "admin":
    case "admin_2":
    case "faculty":
      return "admin";
    case "head_of_coe":
    case "admin_1":
    case "super_admin":
      return "head_of_coe";
    case "library":
    case "hostel":
    case "fees":
      return raw;
    default:
      return null;
  }
}

/** All stored recipient_portal values that belong to a normalized role. */
export function portalNotificationRecipientValues(portal: PortalType): string[] {
  switch (portal) {
    case "admin":
      return ["admin", "admin_2", "faculty"];
    case "head_of_coe":
      return ["head_of_coe", "admin_1", "super_admin"];
    default:
      return [portal];
  }
}

/** Default landing path after sign-in for each portal role. */
export function portalHomePath(portal: PortalType | string): string {
  const normalized = typeof portal === "string" ? normalizePortalType(portal) : portal;
  if (!normalized) return "/login";

  switch (normalized) {
    case "head_of_coe":
      return "/coe";
    case "admin":
      return "/admin";
    case "library":
      return "/library";
    case "hostel":
      return "/hostel";
    case "fees":
      return "/fees";
    default: {
      const _exhaustive: never = normalized;
      return _exhaustive;
    }
  }
}

/** Maps stored `portal_notifications` portal strings (including legacy enum labels) to UI text. */
export function notificationPortalLabel(raw: string): string {
  switch (raw) {
    case "faculty":
    case "admin":
    case "admin_2":
      return portalDisplayLabel("admin");
    case "super_admin":
    case "admin_1":
    case "head_of_coe":
      return portalDisplayLabel("head_of_coe");
    case "library":
    case "hostel":
    case "fees":
      return portalDisplayLabel(raw as PortalType);
    default:
      return raw;
  }
}

/** Human-readable label for UI (navigation, tables, notifications). */
export function portalDisplayLabel(portal: PortalType | string): string {
  const normalized = typeof portal === "string" ? normalizePortalType(portal) : portal;
  if (!normalized) return String(portal);

  switch (normalized) {
    case "head_of_coe":
      return "COE";
    case "admin":
      return "Admin";
    case "library":
      return "Library";
    case "hostel":
      return "Hostel";
    case "fees":
      return "Academic fees";
    default: {
      const _exhaustive: never = normalized;
      return _exhaustive;
    }
  }
}
