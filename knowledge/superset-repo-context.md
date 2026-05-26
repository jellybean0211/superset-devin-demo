---
name: Apache Superset repo orientation
trigger_description: Use when working on any apache/superset task, especially API/schema or OpenAPI changes.
pinned_repo: apache/superset
---

Apache Superset is a Python (Flask) BI tool with a React frontend.

Key directories for backend API work:
- `superset/` — main Python package
- `superset/dashboards/` — dashboard REST API, schemas, models
  - `api.py` — Flask-AppBuilder ModelRestApi for dashboards
  - `schemas.py` — marshmallow schemas used for request/response (de)serialization
- `superset/cli/update.py` — Click commands, including `update-api-docs` that regenerates the OpenAPI spec
- `docs/static/resources/openapi.json` — the generated OpenAPI spec served at https://superset.apache.org/docs/api/
- `tests/unit_tests/dashboards/` and `tests/integration_tests/dashboards/` — dashboard tests

Schema → OpenAPI generation:
- Superset uses `flask-appbuilder` + `apispec` + `apispec-webframeworks` to derive OpenAPI from marshmallow schemas.
- `fields.List(fields.Nested(X))` and `fields.Nested(X, many=True)` both produce lists at runtime, but apispec sometimes mis-renders the latter as a single `$ref` in the generated spec — prefer `fields.List(fields.Nested(X))` for response schemas you want to appear as arrays in the OpenAPI doc.

Dev environment:
- Python 3.10+ required.
- `pip install -e ".[development]"` from repo root installs editable mode with dev deps.
- The `superset` CLI requires `SUPERSET_CONFIG_PATH` set and an initialized metadata DB. For doc-only changes, regenerating openapi.json may still require a minimal app context.

PR conventions:
- Use Conventional Commits in PR titles: `fix(api): ...`, `feat(dashboard): ...`, etc.
- Reference the issue in the PR body: `Closes #<n>` or `Refs #<n>`.
- Keep PRs focused; do not bundle unrelated cleanup.
