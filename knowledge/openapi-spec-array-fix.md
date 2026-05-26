---
name: OpenAPI spec array type bug pattern (Superset)
trigger_description: Use when fixing Superset OpenAPI spec bugs where array-typed response fields render as single $ref objects instead of arrays.
pinned_repo: apache/superset
---

## Symptom
The runtime API returns an array, but `docs/static/resources/openapi.json` declares the property as a bare `$ref` object. Generated clients (NSwag, openapi-generator, etc.) then deserialize incorrectly and fail at runtime.

Example of the BUG in openapi.json:
```json
"owners": { "$ref": "#/components/schemas/DashboardRestApi.get_list.User2" }
```

Expected:
```json
"owners": {
  "type": "array",
  "items": { "$ref": "#/components/schemas/DashboardRestApi.get_list.User2" }
}
```

## Root cause
In marshmallow schemas under `superset/<resource>/schemas.py`, fields declared as `fields.Nested(X, many=True)` sometimes get rendered by apispec as a single `$ref` rather than an array. Fields declared as `fields.List(fields.Nested(X))` render correctly.

## Fix recipe
1. Open the relevant schema (e.g. `superset/dashboards/schemas.py`).
2. Find the response schema for the GET-list endpoint (e.g. `DashboardGetResponseSchema`).
3. Replace any `fields.Nested(X, many=True)` with `fields.List(fields.Nested(X))`.
4. Regenerate the spec:
   ```bash
   superset update-api-docs
   ```
   (Requires app context — set `SUPERSET_CONFIG_PATH` and a usable metadata DB.)
5. If regeneration is infeasible in the demo environment, fall back to a deterministic `jq` patch:
   ```bash
   jq '
     .components.schemas["DashboardRestApi.get_list"].properties.owners =
       {"type":"array","items":{"$ref":"#/components/schemas/DashboardRestApi.get_list.User2"}}
     | .components.schemas["DashboardRestApi.get_list"].properties.roles =
       {"type":"array","items":{"$ref":"#/components/schemas/DashboardRestApi.get_list.Role"}}
     | .components.schemas["DashboardRestApi.get_list"].properties.tags =
       {"type":"array","items":{"$ref":"#/components/schemas/DashboardRestApi.get_list.Tag"}}
   ' docs/static/resources/openapi.json > /tmp/_openapi.json \
     && mv /tmp/_openapi.json docs/static/resources/openapi.json
   ```
6. Verify the three properties are now array-typed in the regenerated file.

## Apply this pattern to other resources too
Check at minimum: charts, datasets, queries, saved_queries — they likely have the same bug for their `owners`/`tags`/`roles` fields. If the user's task scope allows, fix them in the same PR; if not, mention them in the PR description as follow-ups.
