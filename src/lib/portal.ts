import type { PortalType } from "./types";

/** Default landing path after sign-in for each portal role. */
export function portalHomePath(portal: PortalType): string {
  switch (portal) {
    case "super_admin":
    case "head_of_coe":
      return "/coe";
    case "admin":
    case "faculty":
      return "/admin";
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
export function portalDisplayLabel(portal: PortalType): string {
  switch (portal) {
    case "super_admin":
    case "head_of_coe":
      return "COE";
    case "admin":
    case "faculty":
      return "Admin";
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
