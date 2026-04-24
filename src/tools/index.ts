import { api4PassthroughTool } from "./api4-passthrough.js";
import { createContactTool } from "./create-contact.js";
import { createMembershipTool } from "./create-membership.js";
import { describeEntityTool } from "./describe-entity.js";
import { listEventsTool, registerForEventTool } from "./events.js";
import { findContactsTool } from "./find-contacts.js";
import { getContactTool } from "./get-contact.js";
import { getContributionsTool } from "./get-contributions.js";
import { getRelationshipsTool } from "./get-relationships.js";
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
    getRelationshipsTool,
    getContributionsTool,
    listEventsTool,
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
    registerForEventTool,
    createMembershipTool,
    // Passthrough
    api4PassthroughTool,
  ];
}
