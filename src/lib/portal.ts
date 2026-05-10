import type { PortalType } from "./types";

/** Default landing path after sign-in for each portal role. */
export function portalHomePath(portal: PortalType): string {
  switch (portal) {
    case "head_of_coe":
      return "/admin-1";
    case "admin_1":
      return "/admin-2";
    case "admin_2":
      return "/admin-2";
    case "library":
      return "/library";
    case "hostel":
      return "/hostel";
    case "fees":
      return "/fees";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

/** Maps stored `portal_notifications` portal strings (including legacy enum labels) to UI text. */
export function notificationPortalLabel(raw: string): string {
  switch (raw) {
    case "faculty":
      return portalDisplayLabel("admin_1");
    case "admin":
      return portalDisplayLabel("admin_2");
    case "super_admin":
      return portalDisplayLabel("head_of_coe");
    case "head_of_coe":
    case "admin_1":
    case "admin_2":
    case "library":
    case "hostel":
    case "fees":
      return portalDisplayLabel(raw as PortalType);
    default:
      return raw;
  }
}

/** Human-readable label for UI (navigation, tables, notifications). */

export function portalDisplayLabel(portal: PortalType): string {
  switch (portal) {
    case "head_of_coe":
      return "Admin 1";
    case "admin_1":
      return "Admin 2";
    case "admin_2":
      return "Admin 2";
    case "library":
      return "Library";
    case "hostel":
      return "Hostel";
    case "fees":
      return "Academic fees";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}
