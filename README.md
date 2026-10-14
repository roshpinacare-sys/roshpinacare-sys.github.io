# SAOS Network — Front Door

[![SAOS office](https://roshpinacare-sys.github.io/Domain/badge/office.svg)](https://roshpinacare-sys.github.io/Domain/office3d/)
[![SAOS fleet](https://roshpinacare-sys.github.io/Domain/badge/fleet.svg)](https://roshpinacare-sys.github.io/Domain/status/)
[![steem-edge](https://roshpinacare-sys.github.io/Domain/badge/edge.svg)](https://roshpinacare-sys.github.io/Domain/money.html)


The org front door: live index of all public sites + measured fleet state.

- Fleet numbers are fetched client-side from the public raw source: `GridWatch/state/fleet-health.json` (independently measured every 30 min in GitHub cloud).
- Freshness law: measurements older than 24h are marked red. Failed measurements are shown as unreachable — never faked.
- No secrets, no private-repo links (private links 404 for public visitors — forbidden).
- Decisions route to sovereignty (sovereign-decider), not to individuals.

Sites: Domain (HQ) · Console (verify) · FleetHQ (office state) · GridWatch (control plane) · Pulse (public mirror) · Autonomy (arteries) · saos-runtime · steem · sovereign-runner-kit
