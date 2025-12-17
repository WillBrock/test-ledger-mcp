#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Configuration from environment
const API_BASE_URL = process.env.TEST_REPORTER_API_URL;
const API_KEY = process.env.TEST_REPORTER_API_KEY || "";
const DEFAULT_PROJECT_ID = process.env.TEST_REPORTER_PROJECT_ID;
// Helper to make API calls
async function apiCall(endpoint, params = {}) {
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
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error}`);
    }
    return response.json();
}
// Define the tools
const tools = [
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
        name: "get_test_errors",
        description: "Get error messages and stacktraces for a test's failures, grouped by unique error. Use this to see what errors are occurring and how often.",
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
                limit: {
                    type: "number",
                    description: "Maximum number of unique errors to return (default: 20)",
                    default: 20,
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
        description: "Get a list of flaky tests (tests that fail then pass on retry) across the project, sorted by flakiness rate.",
        inputSchema: {
            type: "object",
            properties: {
                project_id: {
                    type: "number",
                    description: "Project ID to filter by (optional)",
                },
                days: {
                    type: "number",
                    description: "Days to look back (default: 30)",
                    default: 30,
                },
                min_flaky_rate: {
                    type: "number",
                    description: "Minimum flaky rate percentage to include (default: 5)",
                    default: 5,
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
        description: "Get the most recent test failures for quick triage. Useful for seeing what's currently broken.",
        inputSchema: {
            type: "object",
            properties: {
                project_id: {
                    type: "number",
                    description: "Project ID to filter by (optional)",
                },
                spec_file: {
                    type: "string",
                    description: "Filter by spec file (optional)",
                },
                hours: {
                    type: "number",
                    description: "Hours to look back (default: 24)",
                    default: 24,
                },
                limit: {
                    type: "number",
                    description: "Maximum results (default: 50)",
                    default: 50,
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
        name: "search_errors",
        description: "Full-text search across error messages and stacktraces. Use this to find all tests affected by a specific type of error.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search term (e.g., 'timeout', 'element not found', 'ECONNREFUSED')",
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
                limit: {
                    type: "number",
                    description: "Maximum results (default: 50)",
                    default: 50,
                },
            },
            required: ["query"],
        },
    },
];
// Create the server
const server = new Server({
    name: "test-results-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "get_test_history":
                result = await apiCall("/api/tests/history", args);
                break;
            case "get_test_errors":
                result = await apiCall("/api/tests/errors", args);
                break;
            case "get_failure_patterns":
                result = await apiCall("/api/tests/patterns", args);
                break;
            case "get_correlated_failures":
                result = await apiCall("/api/tests/correlations", args);
                break;
            case "get_flaky_tests":
                result = await apiCall("/api/tests/flaky", args);
                break;
            case "get_recent_failures":
                result = await apiCall("/api/tests/recent-failures", args);
                break;
            case "get_test_trend":
                result = await apiCall("/api/tests/trend", args);
                break;
            case "search_errors":
                result = await apiCall("/api/tests/search-errors", args);
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
    }
    catch (error) {
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
