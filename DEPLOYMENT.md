# Deploy Triply

Status: deployment files are prepared; no public deployment has been verified.

## Existing hosting account

Connect the private GitHub repository `bibek061/triply`, branch `main`, to a Node.js web service. GitHub Pages/static-only hosting cannot run its accounts, chat, uploads or APIs.

| Setting | Value |
| --- | --- |
| Runtime | Node.js 24 |
| Build | `node scripts/check.js && node --test tests/*.test.js` |
| Start | `node server.js` |
| Instances | 1 |
| Health check | `/healthz` |
| `HOST` | `0.0.0.0` |
| `PORT` | The port supplied by the host |
| `NODE_ENV` | `production` |
| `DATA_DIR` | Absolute path inside the host's persistent volume |
| `PUBLIC_ORIGIN` | Exact HTTPS origin assigned to the app, without a path |

Attach persistent storage before starting. SQLite, uploads and caches use DATA_DIR. Production startup rejects missing origin/storage settings; it cannot detect whether the host actually mounted a persistent disk, so verify that in the dashboard. `/healthz` checks that the database is readable without returning personal data or making external provider calls. SIGTERM/SIGINT stops accepting requests and closes the database after current requests finish (10-second shutdown limit).

Use the hosting provider's HTTPS endpoint. A custom domain requires PUBLIC_ORIGIN to match that domain. The app checks request origins and sets Secure session cookies. Do not copy local `.env`, local accounts, test databases or personal uploads into a deployment by default.

## Optional Render Blueprint

`render.yaml` specifies one Node 24 web service, a 1 GB persistent disk at `/var/data/triply`, health checks, and deployment after GitHub checks pass. The origin automatically comes from Render's RENDER_EXTERNAL_URL unless PUBLIC_ORIGIN is explicitly set for a custom domain.

The specified 0.5 CPU / 512 MB instance is listed at $7/month, plus $0.25/month for 1 GB disk, as checked October 4, 2026. This is a base estimate, not a spending cap; taxes, workspace plans, bandwidth, builds and third-party API usage can add costs. Confirm the dashboard quote before creating a service. [Pricing](https://render.com/pricing), [persistent disks](https://render.com/docs/disks), [Blueprint reference](https://render.com/docs/blueprint-spec).

In Render, create a Blueprint from the private repository using an account authorized to read it. Review the service and disk before provisioning. No provider tokens are included in the Blueprint. The public app can start with discovery and booking comparison links while pricing integrations remain unconfigured.

Add new provider credentials only to the host's secret environment settings when ready. The previously shared local Duffel test token should be rotated before using a hosted copy. See PRICING-SETUP.md. Test offers must remain marked as test data; production access is a separate provider approval.

## Verify after deployment

1. Open the assigned HTTPS URL and `/healthz`; both should return successfully.
2. Search a city and category, load its map/photos and open a place page.
3. Create a designated launch-test account; verify sign-in, saving and a clearly labeled test post. Confirm Secure/HttpOnly session cookies and rejection of writes from another origin.
4. Restart the service and confirm the test account, saved place and photo persist. Keep the same disk attached during later deploys and rollback.
5. Check the provider connection statuses; do not treat sandbox fares or comparison links as live quotes.

Keep database and media backups together. Stop writes before a file-level copy of the entire data directory, or use a SQLite-aware backup process. Deployment with an attached disk can briefly interrupt service. Before broad public traffic, address the operational limits in README.md: moderation and recovery workflows, image validation, monitoring, and suitable map-service capacity. Rate limiting is currently process-local and based on the connection address; behind a shared reverse proxy this is conservative and can affect multiple visitors together.
