# Supabase MCP Configuration (Template)

1. Copy `.env.example` to `.env.local` and fill in:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://imzdwwkwctvenoiqgcwl.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
   MCP_SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
   MCP_SUPABASE_ACCESS_TOKEN="<mcp-access-token>"
   SUPABASE_PROJECT_REF="imzdwwkwctvenoiqgcwl"
   ```

2. Duplicate `mcp/supabase.mcp.json` to `mcp/supabase.mcp.local.json` (ignored by git if you add it to `.gitignore`), then replace the `${...}` placeholders or let your MCP launcher interpolate environment variables.

3. Start the Supabase MCP server/bridge with these env vars loaded. Example shell snippet:
   ```bash
   export $(grep -v '^#' .env.local | xargs)
   mcp-server --config mcp/supabase.mcp.local.json
   ```

Adjust the config format if your MCP runner expects a different schema.
