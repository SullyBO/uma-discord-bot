# uma-discord-bot

A Discord bot for looking up Umamusume data.


## Prerequisites

- Node.js v20+
- Discord bot created via the [Developer Portal](https://discord.com/developers/applications)

## Setup

1. Clone the repo

   ```bash
   git clone https://github.com/SullyBO/uma-discord-bot.git
   cd uma-discord-bot
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create your environment file — populate it with info matching .env-example


## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the bot in development mode with auto-restarts (nodemon) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run deploy:dev` | Register discord slash commands to your dev server |
| `npm run format` | Format all source files with Prettier |
| `npm run lint` | Lint all source files with ESLint |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |


## Project Structure

```
src/
├── index.ts          # Entry point — client setup and command loading
├── types.ts          # Shared TypeScript interfaces (Uma, Skill, etc.)
├── commands/         # One file per slash command
│   ├── uma.ts
│   ├── umas.ts
│   └── skill.ts
└── api/
    └── client.ts     # All calls to the Axum backend
```


## Contributing

### Branching

Branch names should align with conventional commit types:

| Type | Example |
|---|---|
| New feature | `feat/uma-lookup` |
| Bug fix | `fix/skill-embed-crash` |
| Chore / tooling | `chore/update-dependencies` |
| Docs | `docs/update-readme` |
| Refactor | `refactor/api-client` |

### Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add /umas aptitude filter command
fix: handle null skill description from API
chore: update discord.js to v14.15
```

### Pull Requests

- All changes go through a PR — do not push directly to `main`
- Every PR requires review and approval before merging
- Keep PRs focused — one feature or fix per PR

## License
MIT, do whatever you want with it.
