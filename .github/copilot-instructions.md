# GitHub Copilot Instructions

## Code Style & Structure
- Generate function and variable names that are descriptive and self-documenting
- Avoid generating comments unless explaining *why* something is done, not *what* is being done
- Prefer suggesting pure functions over stateful operations when possible
- Keep generated functions small and focused on a single responsibility
- Use early returns to reduce nesting and improve readability

## Testing Philosophy
- Follow Arrange-Act-Assert structure for test organization
- Generate tests that describe behavior, not implementation
- Include tests for boundaries and edge cases, not just the happy path
- Prefer many small, focused tests over fewer large tests
- Make test names descriptive of the scenario being tested

## Code Quality
- Favor composition over inheritance in suggestions
- Minimize dependencies between modules
- Handle errors explicitly rather than ignoring them
- Use meaningful variable names that explain intent
- Keep cyclomatic complexity low in generated code

## Performance Considerations
- Suggest readable solutions over premature optimization
- Consider algorithmic complexity for data processing
- Recommend caching expensive operations when appropriate

## General Principles
- Generated code should read like well-written prose
- Prioritize clarity and maintainability
- Suggest consistent patterns within the existing codebase
- Delete unused code aggressively
