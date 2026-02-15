### Backend Smoke Summary

- Status: `passed`
- Checks: `7`
- Startup: `897ms`
- Total: `1260ms`

| Section | Status | Duration | Check |
| --- | --- | ---: | --- |
| Public | passed | 897ms | [Public] health responds 200 |
| Unauthorized | passed | 5ms | [Unauthorized] auth/me unauthorized |
| Unauthorized | passed | 7ms | [Unauthorized] admin slo unauthorized |
| Authenticated | passed | 5ms | [Authenticated] auth/me happy path |
| Authenticated | passed | 6ms | [Authenticated] tasks paginated shape |
| Authenticated | passed | 6ms | [Authenticated] admin slo happy path |
| Authenticated | passed | 5ms | [Authenticated] notifications read-all dry-run |

**Top slow checks**
- 897ms [Public] health responds 200
- 7ms [Unauthorized] admin slo unauthorized
- 6ms [Authenticated] tasks paginated shape

