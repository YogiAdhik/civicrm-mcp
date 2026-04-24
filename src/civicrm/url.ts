import type { Cms } from "../config.js";

export interface BuildUrlOpts {
  baseUrl: string;
  cms: Cms;
  entity: string;
  action: string;
}

export function buildApi4Url({ baseUrl, cms, entity, action }: BuildUrlOpts): string {
  const path = `civicrm/ajax/api4/${encodeURIComponent(entity)}/${encodeURIComponent(action)}`;
  switch (cms) {
    case "drupal":
    case "backdrop":
    case "standalone":
      return `${baseUrl}/${path}`;
    case "wordpress":
      return `${baseUrl}/wp-admin/admin.php?page=CiviCRM&q=${path}`;
  }
}

export function buildApi3Url({ baseUrl, cms }: { baseUrl: string; cms: Cms }): string {
  const path = "civicrm/ajax/rest";
  switch (cms) {
    case "drupal":
    case "backdrop":
    case "standalone":
      return `${baseUrl}/${path}`;
    case "wordpress":
      return `${baseUrl}/wp-admin/admin.php?page=CiviCRM&q=${path}`;
  }
}
