// The API is plain JS with no declarations. entityParity.test.ts imports its real
// config so the two sides of the sync contract are checked against each other rather
// than against a copy.
//
// Deliberately typed as an open record: enumerating the keys here would recreate the
// duplicate list the parity test exists to catch.
declare module '*/focus-go-api/sync/config.js' {
  export const SYNC_TABLES: Record<string, string>
  export const SYNC_ENTITY_TYPES: string[]
}
