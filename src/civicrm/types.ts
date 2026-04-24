export interface Api4Success<T = unknown> {
  version: 4;
  count: number;
  countFetched?: number;
  countMatched?: number;
  values: T[];
}

export interface Api4Error {
  error_code?: number;
  error_message: string;
}

export type Api4Response<T = unknown> = Api4Success<T> | Api4Error;

export function isApi4Error(r: Api4Response): r is Api4Error {
  return typeof (r as Api4Error).error_message === "string";
}

export const WRITE_ACTIONS = new Set([
  "create",
  "update",
  "save",
  "delete",
  "replace",
  "revert",
  "submit",
]);

export const DELETE_ACTIONS = new Set(["delete", "replace"]);

export function isWriteAction(action: string): boolean {
  return WRITE_ACTIONS.has(action);
}

export function isDeleteAction(action: string): boolean {
  return DELETE_ACTIONS.has(action);
}
