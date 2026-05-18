import { addNoteTool } from "./add-note.js";
import { api4PassthroughTool } from "./api4-passthrough.js";
import { createContactTool } from "./create-contact.js";
import { createMembershipTool } from "./create-membership.js";
import { describeEntityTool } from "./describe-entity.js";
import { describeFieldOptionsTool } from "./describe-field-options.js";
import { listEventsTool, registerForEventTool } from "./events.js";
import { findContactsTool } from "./find-contacts.js";
import { getContactTool } from "./get-contact.js";
import { getContributionsTool } from "./get-contributions.js";
import { getRelationshipsTool } from "./get-relationships.js";
import { addToGroupTool, removeFromGroupTool } from "./group-membership.js";
import { listEntitiesTool } from "./list-entities.js";
import { logActivityTool } from "./log-activity.js";
import { recordContributionTool } from "./record-contribution.js";
import { listSavedSearchesTool, runSavedSearchTool } from "./saved-search.js";
import { sendReceiptTool } from "./send-receipt.js";
import { systemInfoTool } from "./system-info.js";
import { tagContactsTool, untagContactsTool } from "./tag-contacts.js";
import type { ToolDefinition } from "./types.js";
import { updateContactTool } from "./update-contact.js";
import { whoamiTool } from "./whoami.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allTools(): ToolDefinition<any>[] {
  return [
    // Diagnostics
    systemInfoTool,
    whoamiTool,
    // Read
    findContactsTool,
    getContactTool,
    getRelationshipsTool,
    getContributionsTool,
    listEventsTool,
    listSavedSearchesTool,
    runSavedSearchTool,
    // Introspection
    listEntitiesTool,
    describeEntityTool,
    describeFieldOptionsTool,
    // Write (env-gated)
    createContactTool,
    updateContactTool,
    logActivityTool,
    recordContributionTool,
    addToGroupTool,
    removeFromGroupTool,
    registerForEventTool,
    createMembershipTool,
    addNoteTool,
    tagContactsTool,
    untagContactsTool,
    sendReceiptTool,
    // Passthrough
    api4PassthroughTool,
  ];
}
