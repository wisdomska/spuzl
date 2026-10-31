# Security

Please report vulnerabilities privately through GitHub Security Advisories on this repository ("Report a vulnerability"). Do not open public issues for security problems.

- Every table has Row Level Security. Clients can only read their own rows and public leaderboard data.
- Scores, rewards, ratings and multiplayer results are decided on the server.
- The service-role key is server-only and checked out of client bundles in CI.
- Account creation and high-value endpoints are protected by Cloudflare Turnstile and rate limits.
