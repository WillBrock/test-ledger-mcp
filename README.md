# Test Reporter MCP Server

MCP (Model Context Protocol) server for [Test Ledger](https://testledger.dev) that enables Claude Code to analyze flaky tests, find failure patterns, suggest fixes and more.

## Installation

No installation required! Just add the configuration to Claude Code.

## Quick Start

### 1. Get your API key

Log into [testledger.dev](https://testledger.dev) and go to Settings → API Keys to generate a key.

### 2. Configure Claude Code

Add this to your Claude Code MCP config:

**Location:** `~/.claude.json` (global) or `.mcp.json` (project)

```json
{
  "mcpServers": {
    "test-reporter": {
      "command": "npx",
      "args": ["-y", "@testledger/mcp"],
      "env": {
        "TEST_LEDGER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 3. Restart Claude Code

That's it! Claude Code now has access to your test results.

## Usage

Once configured, you can ask Claude Code things like:

- "Why is `checkout.spec.js` flaky?"
- "What tests have been failing the most this week?"
- "Show me recent test failures"
- "Are there any tests that always fail together?"

### With the /fix-flaky-test command

For the best experience, add the [fix-flaky-test slash command](https://github.com/your-company/test-reporter-mcp/blob/main/commands/fix-flaky-test.md) to your project:

```bash
mkdir -p .claude/commands
curl -o .claude/commands/fix-flaky-test.md https://raw.githubusercontent.com/your-company/test-reporter-mcp/main/commands/fix-flaky-test.md
```

Then use it:

```
/fix-flaky-test

Test: LoginPage.should allow user to login with valid credentials
Error: element ("#submit-btn") still not clickable after 3000ms
  at login.spec.js:42:24
```

## Available Tools

The MCP server provides these tools to Claude:

| Tool | Description |
|------|-------------|
| `get_test_history` | Pass/fail/flaky statistics for a test |
| `get_failure_patterns` | Time-of-day, browser, and version patterns |
| `get_correlated_failures` | Tests that fail together (shared setup issues) |
| `get_flaky_tests` | Project-wide flaky test leaderboard |
| `get_recent_failures` | Recent failures for quick triage |
| `get_test_trend` | Failure rate over time |

## Configuration Options

| Environment Variable | Required | Description |
|--------------------------|-----|------------------------------------------------------------|
| `TEST_LEDGER_API_KEY`    | Yes | Your API key from the dashboard                            |
| `TEST_LEDGER_API_URL`    | No  | Custom API URL (default: `https://app-api.testledger.dev`) |
| `TEST_LEDGER_PROJECT_ID` | No  | Default project ID to use for queries                      |

### Example with all options

```json
{
  "mcpServers": {
    "test-reporter": {
      "command": "npx",
      "args": ["-y", "@testledger/mcp"],
      "env": {
        "TEST_LEDGER_API_KEY": "tr_live_abc123",
        "TEST_LEDGER_PROJECT_ID": "42"
      }
    }
  }
}
```

## Troubleshooting

### "Tool not found" errors

1. Restart Claude Code after updating config
2. Check for JSON syntax errors in your config file
3. Verify your API key is valid

### "API error 401"

Your API key is invalid or expired. Generate a new one from the dashboard.

### "API error 403"

Your API key doesn't have access to the requested project. Check project permissions.

## Support

- Documentation: [testledger.dev](https://testledger.dev)
- Issues: [GitHub Issues](https://github.com/your-company/test-reporter-mcp/issues)
