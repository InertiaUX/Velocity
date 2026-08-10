# Security Policy

Fixes land on the default branch when we can.

## Reporting

Do **not** open a public issue for security-sensitive bugs (e.g. RCE via the
plugin host, OAuth callback abuse, or local HTTP listeners).

Use a private [GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on [InertiaUX/Velocity](https://github.com/InertiaUX/Velocity) if enabled, or contact the maintainers via the organization profile.

Include OS/version, Velocity version, repro steps, and whether the issue is
localhost-only or network-reachable.

## Scope

- OAuth / plugin callbacks must bind to **loopback** (`127.0.0.1`) only. Exposure beyond loopback is a bug.
- Plugins run in sandboxed iframes but are still third-party code. Only install plugins you trust.
- Update feeds and plugin repo feeds should be **HTTPS**. Report MITM-friendly cleartext update or repo URLs.
- Plugin package downloads from a repo must be HTTPS (localhost allowed for development).
- Do not report issues that require a malicious plugin the user intentionally installed, unless the host fails to enforce documented sandbox boundaries.
- Spotify / third-party API account issues belong with those providers.
