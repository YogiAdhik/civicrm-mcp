import { api4PassthroughTool } from "./api4-passthrough.js";
import { createContactTool } from "./create-contact.js";
import { describeEntityTool } from "./describe-entity.js";
import { findContactsTool } from "./find-contacts.js";
import { getContactTool } from "./get-contact.js";
import { addToGroupTool, removeFromGroupTool } from "./group-membership.js";
import { listEntitiesTool } from "./list-entities.js";
import { logActivityTool } from "./log-activity.js";
import { recordContributionTool } from "./record-contribution.js";
import { systemInfoTool } from "./system-info.js";
import type { ToolDefinition } from "./types.js";
import { updateContactTool } from "./update-contact.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allTools(): ToolDefinition<any>[] {
  return [
    // Diagnostics
    systemInfoTool,
    // Read
    findContactsTool,
    getContactTool,
    // Introspection
    listEntitiesTool,
    describeEntityTool,
    // Write (env-gated)
    createContactTool,
    updateContactTool,
    logActivityTool,
    recordContributionTool,
    addToGroupTool,
    removeFromGroupTool,
    // Passthrough
    api4PassthroughTool,
  ];
}
