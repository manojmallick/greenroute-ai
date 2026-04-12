# Contributing to GreenRoute AI

Thank you for considering contributing to GreenRoute AI! This guide will help you get started.

## Code of Conduct

Be respectful. Be constructive. Focus on the problem, not the person.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/greenroute-ai`
3. Install dependencies: `npm install`
4. Copy env vars: `cp .env.example .env` and fill in your keys
5. Start the stack: `docker-compose up`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(router): add GNN heuristic fallback
fix(monitor): handle API timeout gracefully
docs(readme): add architecture diagram
test(astar): add edge case for unreachable nodes
chore(ci): add lint step to GitHub Actions
```

Types: `feat` · `fix` · `docs` · `test` · `chore` · `refactor` · `perf`

## Branch Strategy

- `main` — production, protected (requires PR + CI pass)
- `feat/<name>` — feature branches
- `fix/<name>` — bug fix branches

## Pull Request Process

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure `npm test` passes
4. Open a PR — fill in the template
5. Request review (or self-review for solo dev)

## Algorithm Contributions

If you're contributing to the routing algorithms:

- All new algorithms go in `packages/router-agent/src/algorithms/`
- Must include unit tests in `__tests__/`
- Include JSDoc with time/space complexity
- Benchmark against existing A\* for comparison

## Questions?

Open an issue or reach out via [LinkedIn](https://www.linkedin.com/in/manoj-mallick-9487413a).
