# Contributing to GreenRoute AI

Thank you for your interest in contributing to GreenRoute AI! We are building an autonomous, agentic logistics optimization platform to help reduce urban delivery CO₂ emissions.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally: `git clone https://github.com/manojmallick/greenroute-ai.git`
3. **Install dependencies**: This is an npm workspace monorepo. Run `npm install` at the root.
4. **Copy the Environment File**: `cp .env.example .env` and fill out your local API keys (Google Maps, Gemini).
5. **Start Local Environment**: Run `docker-compose up` to spin up the local Redis and Postgres instances, along with the agent services.

## Development Workflow

1. Create a descriptively named branch: `git checkout -b feature/gnn-heuristic` or `git checkout -b fix/astar-infinite-loop`.
2. Ensure you are following **Conventional Commits** for your commit messages (e.g., `feat: add graph neural net heuristic` or `fix: resolve crash in API gateway`).
3. Run `npm run lint` and `npm test` before pushing.
4. Push your branch to GitHub and open a Pull Request against `main`.

## Pull Request Guidelines

- All PRs must pass the GitHub Actions CI pipeline (Lint + Test).
- Include a clear description of what the PR accomplishes.
- If it fixes an open issue, link it using `Fixes #123`.
- Any changes to core algorithms (`astar.js`, `dijkstra.js`) MUST include updated or new unit tests to prevent pathfinding regressions.

## Architecture Guidelines

- GreenRoute AI heavily relies on a multi-agent orchestrated pattern. New functionality should ideally not bloat the API Gateway.
- Determine if your feature belongs in the **Router Agent** (pathfinding), **Monitor Agent** (data polling & anomaly detection), or **Replanner Agent** (decision making / LLM interaction).
- All agent intercommunication MUST occur over the Redis pub/sub channels, documented in `CLAUDE.md`.

Thank you for helping us make city logistics greener!
