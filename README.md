# SAOS Network — Front Door

The org front door: live index of all public sites + measured fleet state.

- Fleet numbers are fetched client-side from the public raw source: `GridWatch/state/fleet-health.json` (independently measured every 30 min in GitHub cloud).
- Freshness law: measurements older than 24h are marked red. Failed measurements are shown as unreachable — never faked.
- No secrets, no private-repo links (private links 404 for public visitors — forbidden).
- Decisions route to sovereignty (sovereign-decider), not to individuals.

Sites: Domain (HQ) · Console (verify) · FleetHQ (office state) · GridWatch (control plane) · Pulse (public mirror) · Autonomy (arteries) · saos-runtime · steem · sovereign-runner-kit
