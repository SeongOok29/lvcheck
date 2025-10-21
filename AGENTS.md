# Repository Guidelines

## Project Structure & Module Organization
- Keep application logic under `src/lvcheck/`, grouping subpackages by domain (e.g., `rules/`, `ingest/`, `reports/`).
- Place integration helpers under `src/lvcheck/adapters/`; keep pure logic separated from IO and external services.
- Mirror modules in `tests/` using `tests/<module>/test_*.py`; share factories and fixtures from `tests/fixtures/`.
- Store scripts that glue workflows together in `scripts/`; keep larger design notes in `docs/architecture.md`.

## Build, Test, and Development Commands
- `python -m venv .venv && source .venv/bin/activate` — create/enter the standard local environment.
- `pip install -e .[dev]` — install the package plus dev extras once `pyproject.toml` lists them.
- `make lint` — run formatters (`black`, `ruff`) and static checks; fix before committing.
- `make test` — execute the pytest suite with coverage reporting; mirrors CI behavior.
- `python -m lvcheck.cli` — launch the CLI entry point for quick smoke tests.

## Coding Style & Naming Conventions
- Enforce `black` (line length 88) and `ruff`; rely on `make lint` or pre-commit to keep them consistent.
- Indent with 4 spaces; prefer explicit imports, and sort them via `ruff --fix` or `isort` if configured.
- Use `snake_case` for modules/functions, `PascalCase` for classes, and `UPPER_SNAKE_CASE` for constants and settings keys.
- Typing is required on public APIs; add `typing.assert_never` guards for exhaustive matches.

## Testing Guidelines
- Tests mirror package paths; each feature gains a `tests/<feature>/test_*.py` file with clear arrange-act-assert sections.
- Use pytest fixtures in `tests/conftest.py` to centralize setup; keep fixtures small and composable.
- Cover edge cases (invalid payloads, boundary thresholds, concurrency paths) and document regressions with descriptive test names.
- Run `pytest --cov=lvcheck --cov-report=term-missing` locally before pushing.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`); scope with `/` when touching subpackages.
- Keep commits focused; explain intent and side effects in the body when behavior or contracts change.
- Pull requests must include a summary, testing notes, linked issues, and screenshots/logs for anything user-facing.
- Draft PRs until CI passes; request reviews only when lint/test status is green.

## Security & Configuration Tips
- Never commit secrets; maintain `.env.example` and load variables via `pydantic` settings or `dotenv` helpers.
- Validate external input at boundaries and avoid blanket `except Exception` blocks; log context-rich errors.
- Pin dependencies in `pyproject.toml`, review them with `pip list --outdated`, and remove unused packages promptly.
