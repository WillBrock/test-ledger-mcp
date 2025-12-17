# /fix-flaky-test

Analyze a flaky WebdriverIO e2e test and provide actionable fixes.

## Input

The user will provide:
- A stack trace from a failed test run
- Optionally: the test name or file path

## Analysis Steps

### 1. Parse the Stack Trace

Extract from the provided stack trace:
- The test file and line number where the failure occurred
- The specific assertion or WebdriverIO command that failed
- Any timeout values mentioned
- The error type (ElementNotFound, StaleElement, Timeout, assertion failure, etc.)

### 2. Read the Test Code

Use the file path from the stack trace to read the full test file:
```
Read the test file to understand the test structure, setup/teardown, and the specific failing assertion
```

### 3. Query Historical Data via MCP Tools

Use the test-results MCP server tools to gather data. Run these in sequence:

**Step 3a: Get test history**
```
Use the get_test_history tool with:
- spec_file: (extracted from stack trace)
- test_title: (extracted from stack trace)
- days: 30
```
This tells you failure rate, flaky rate, and when issues started.

**Step 3b: Get failure patterns**
```
Use the get_failure_patterns tool with:
- spec_file: (from stack trace)
```
This reveals time-of-day patterns, browser-specific issues, and version correlations.

**Step 3c: Check for correlated failures**
```
Use the get_correlated_failures tool with:
- spec_file: (from stack trace)
- test_title: (from stack trace)
- min_correlation: 0.3
```
This finds tests that fail together, indicating shared setup issues.

### 4. Identify the Flakiness Category

Classify the issue into one of these common WebdriverIO flakiness patterns:

**Timing/Race Conditions:**
- Missing `await` on async operations
- Element not yet visible/clickable when action attempted
- Page navigation not complete
- Animation or transition interference
- Network request not yet resolved

**Selector Issues:**
- Non-unique selectors matching multiple elements
- Dynamic IDs or classes that change between runs
- Elements inside iframes not properly scoped
- Shadow DOM elements requiring special handling

**State/Environment Issues:**
- Test data pollution from previous tests
- Shared state between parallel tests
- Browser cache/cookies from previous runs
- Time-dependent logic (dates, timestamps)
- Viewport size differences

**Infrastructure Issues:**
- Network timeouts to external services
- CI resource constraints causing slowdowns
- Browser version inconsistencies
- Memory leaks in long test suites

### 5. Provide Specific Fixes

Based on the category, suggest concrete code changes:

**For timing issues:**
```javascript
// Instead of immediate click
await element.click();

// Use waitForClickable with explicit timeout
await element.waitForClickable({ timeout: 5000 });
await element.click();

// Or wait for specific condition
await browser.waitUntil(
  async () => (await element.isDisplayed()) && (await element.isEnabled()),
  { timeout: 5000, timeoutMsg: 'Element not ready for interaction' }
);
```

**For selector issues:**
```javascript
// Instead of brittle selector
const element = await $('div.btn-primary');

// Use data-testid attributes
const element = await $('[data-testid="submit-button"]');

// Or more specific chaining
const element = await $('form.login').$('button[type="submit"]');
```

**For state issues:**
```javascript
// Add explicit cleanup in afterEach
afterEach(async () => {
  await browser.deleteCookies();
  await browser.execute(() => localStorage.clear());
});

// Or isolate test data
const testId = `test-${Date.now()}`;
```

**For network issues:**
```javascript
// Wait for network idle
await browser.waitUntil(
  async () => {
    const pending = await browser.execute(() =>
      performance.getEntriesByType('resource').filter(r => !r.responseEnd).length
    );
    return pending === 0;
  },
  { timeout: 10000 }
);
```

### 6. Output Format

Provide your analysis in this structure:

**Summary:** One-line description of the likely cause

**Flakiness Category:** [Timing | Selector | State | Infrastructure]

**Evidence:**
- What in the stack trace points to this conclusion
- Historical patterns if MCP data was available
- Relevant code from the test file

**Recommended Fix:**
- Specific code changes with before/after examples
- Any configuration changes needed (timeouts, retries)
- Whether this is a quick fix or needs deeper refactoring

**Prevention:**
- Patterns to avoid in future tests
- Any eslint rules or custom linting that could catch this

**Confidence:** [High | Medium | Low] with explanation

---

## Example Usage

User provides:
```
Test: LoginPage.should allow user to login with valid credentials
Error: element ("#submit-btn") still not clickable after 3000ms
  at clickElement (node_modules/webdriverio/build/commands/element/click.js:35:15)
  at login.spec.js:42:24
```

Claude should:

1. **Parse the stack trace**
   - Spec file: `login.spec.js`
   - Test title: `should allow user to login with valid credentials`
   - Error type: Element not clickable (timing issue)

2. **Use MCP tools to gather data**
   ```
   get_test_history(spec_file="login.spec.js", test_title="should allow user to login with valid credentials")
   → 5.3% failure rate, 3.3% flaky rate, averaging 0.4 retries

   get_failure_patterns(spec_file="login.spec.js")
   → Failures cluster between 2-4 PM, worse on Chrome than Firefox

   get_correlated_failures(spec_file="login.spec.js", test_title="should allow user to login with valid credentials")
   → "should show dashboard after login" fails 70% of the time this test fails
   ```

3. **Read the test file**
   ```
   Read login.spec.js to understand the test implementation
   ```

4. **Identify the root cause**
   - Timing issue: button not clickable
   - Likely cause: animation or async operation before button is ready
   - Correlation with dashboard test suggests login state setup issue

5. **Provide specific fix**
   ```javascript
   // Before
   await $('#submit-btn').click();

   // After
   await $('#submit-btn').waitForClickable({ timeout: 5000 });
   await $('#submit-btn').click();
   ```
