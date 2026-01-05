#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Test Results MCP Server

// Configuration from environment
const API_BASE_URL       = process.env.TEST_LEDGER_API_URL;
const API_KEY            = process.env.TEST_LEDGER_API_KEY || "";
const DEFAULT_PROJECT_ID = process.env.TEST_LEDGER_PROJECT_ID;

// API request timeout (25s to stay under 30s gateway limit)
const API_TIMEOUT_MS = 25000;

// Helper to make API calls with timeout
async function apiCall<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const url = new URL(endpoint, API_BASE_URL);

    // Inject default project ID if not provided
    if (DEFAULT_PROJECT_ID && !params.project_id) {
      params.project_id = DEFAULT_PROJECT_ID;
    }

    // Add query params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${API_TIMEOUT_MS / 1000}s. Try reducing 'days' or 'limit' parameters.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Define the tools
const tools: Tool[] = [
  {
    name: "get_test_history",
    description: "Get historical pass/fail/flaky statistics for a specific test. Use this to understand how often a test fails and its overall reliability.",
    inputSchema: {
      type: "object",
      properties: {
        spec_file: {
          type: "string",
          description: "The spec file path (e.g., 'login.spec.js' or 'tests/checkout.spec.ts')",
        },
        test_title: {
          type: "string",
          description: "Specific test title to filter by (optional - omit to get all tests in the spec)",
        },
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to look back (default: 30)",
          default: 30,
        },
      },
      required: ["spec_file"],
    },
  },
  {
    name: "get_failure_patterns",
    description: "Analyze when and how tests fail to identify patterns. Returns failure rates by hour, day of week, version, browser/site, and duration analysis.",
    inputSchema: {
      type: "object",
      properties: {
        spec_file: {
          type: "string",
          description: "The spec file path",
        },
        test_title: {
          type: "string",
          description: "Specific test title (optional)",
        },
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 30)",
          default: 30,
        },
      },
      required: ["spec_file"],
    },
  },
  {
    name: "get_correlated_failures",
    description: "Find tests that tend to fail together with a given test. High correlation suggests shared setup issues, test pollution, or dependencies.",
    inputSchema: {
      type: "object",
      properties: {
        spec_file: {
          type: "string",
          description: "The spec file to find correlations for",
        },
        test_title: {
          type: "string",
          description: "Specific test title (optional)",
        },
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 30)",
          default: 30,
        },
        min_correlation: {
          type: "number",
          description: "Minimum correlation threshold 0-1 (default: 0.5)",
          default: 0.5,
        },
      },
      required: ["spec_file"],
    },
  },
  {
    name: "get_flaky_tests",
    description: "Get a list of flaky tests (tests that fail then pass on retry) across the project, sorted by flakiness rate. Note: This scans all tests - use smaller 'days' values for faster results.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 3). Use smaller values for faster results.",
          default: 3,
        },
        min_flaky_rate: {
          type: "number",
          description: "Minimum flaky rate percentage to include (default: 5)",
          default: 5,
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 20)",
          default: 20,
        },
      },
    },
  },
  {
    name: "get_flaky_specs",
    description: "Get flaky specs from pre-computed materialized view. Faster than get_flaky_tests as it uses cached data refreshed hourly. Returns spec-level flakiness (not individual test level).",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        min_flaky_count: {
          type: "number",
          description: "Minimum number of flaky occurrences (default: 1)",
          default: 1,
        },
        min_flaky_percent: {
          type: "number",
          description: "Minimum flaky percentage to include (default: 10)",
          default: 10,
        },
        min_total_runs: {
          type: "number",
          description: "Minimum total runs for statistical significance (default: 1)",
          default: 1,
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 50)",
          default: 50,
        },
      },
    },
  },
  {
    name: "get_recent_failures",
    description: "Get the most recent test failures for quick triage. Useful for seeing what's currently broken. For faster results, provide a spec_file filter.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        spec_file: {
          type: "string",
          description: "Filter by spec file (recommended for faster results)",
        },
        hours: {
          type: "number",
          description: "Hours to look back (default: 24)",
          default: 24,
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 20)",
          default: 20,
        },
      },
    },
  },
  {
    name: "get_test_trend",
    description: "Get trend data for a test over time, useful for seeing if a test is getting more or less reliable.",
    inputSchema: {
      type: "object",
      properties: {
        spec_file: {
          type: "string",
          description: "The spec file path",
        },
        test_title: {
          type: "string",
          description: "Specific test title (optional)",
        },
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 30)",
          default: 30,
        },
        granularity: {
          type: "string",
          enum: ["day", "week"],
          description: "Time granularity for trend data (default: 'day')",
          default: "day",
        },
      },
      required: ["spec_file"],
    },
  },
  {
    name: "get_failure_screenshots",
    description: "Get screenshots from recent test failures. Returns presigned S3 URLs that can be viewed with the Read tool to see exactly what the UI looked like when the test failed.",
    inputSchema: {
      type: "object",
      properties: {
        spec_file: {
          type: "string",
          description: "The spec file path (e.g., 'login.spec.js')",
        },
        test_title: {
          type: "string",
          description: "Specific test title to filter by (optional)",
        },
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 7)",
          default: 7,
        },
        limit: {
          type: "number",
          description: "Maximum screenshots to return (default: 10)",
          default: 10,
        },
      },
      required: ["spec_file"],
    },
  },
  {
    name: "get_consecutive_failures",
    description: "Get tests that are failing consecutively (broken tests, not flaky). Returns tests where the last 2+ runs have failed, with timing info (last_passed_date, first_failed_date) useful for identifying which merge broke them.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "number",
          description: "Project ID to filter by (optional)",
        },
        version: {
          type: "string",
          description: "Version to filter by (e.g., '12.1.0'). If not provided, uses latest version.",
        },
        days: {
          type: "number",
          description: "Days to look back (default: 10)",
          default: 10,
        },
        min_consecutive_failures: {
          type: "number",
          description: "Minimum number of consecutive failures to include (default: 2)",
          default: 2,
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 50)",
          default: 50,
        },
      },
    },
  },
];

// Create the server
const server = new Server(
  {
    name: "test-results-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "get_test_history":
        result = await apiCall("/tests/history", args as Record<string, unknown>);
        break;

      case "get_failure_patterns":
        result = await apiCall("/tests/patterns", args as Record<string, unknown>);
        break;

      case "get_correlated_failures":
        result = await apiCall("/tests/correlations", args as Record<string, unknown>);
        break;

      case "get_flaky_tests":
        result = await apiCall("/tests/flaky", args as Record<string, unknown>);
        break;

      case "get_flaky_specs":
        result = await apiCall("/tests/flaky-specs", args as Record<string, unknown>);
        break;

      case "get_recent_failures":
        result = await apiCall("/tests/recent-failures", args as Record<string, unknown>);
        break;

      case "get_test_trend":
        result = await apiCall("/tests/trend", args as Record<string, unknown>);
        break;

      case "get_failure_screenshots":
        result = await apiCall("/tests/failure-screenshots", args as Record<string, unknown>);
        break;

      case "get_consecutive_failures":
        result = await apiCall("/tests/consecutive-failures", args as Record<string, unknown>);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Test Results MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
