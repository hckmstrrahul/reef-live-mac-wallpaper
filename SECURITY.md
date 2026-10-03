# Security and privacy

Reef is an offline desktop app. It has no accounts, analytics, tracking or automatic updater. Theme preferences stay on the Mac. A read-only mouse monitor observes desktop gestures and forwards eligible events to the local renderer; it does not record them or monitor global keyboard input.

The native web view permits only its bundled main page and validates bridge messages. A Content Security Policy restricts script loading; WebKit inspection is disabled unless explicitly enabled for local development. These are defensive boundaries, not a sandbox or a formal security guarantee. The app runs with the normal permissions of its user.

Build/install tools access npm, browser downloads and optionally recorded public asset sources. The dev server listens on `127.0.0.1` only. Local app builds are ad-hoc signed, not Developer ID-signed or notarized.

## Reporting a vulnerability

Use **Security → Report a vulnerability** on the GitHub repository for sensitive reports. Include the affected revision, reproducible steps and impact. Do not publish credentials or private files in an issue. Only the latest source revision is maintained; there is no guaranteed response time.

The [initial review](docs/REVIEW.md) records the checks performed before publication and the remaining validation limits.
