# Congregant Proximity Map — design note

Status: **proposed, not built.** Written 2026-09-03 from Shahad's stated intent.
Nothing here is decided except where it says so.

---

## What it is for

Emergency coordination. In a crisis the congregation needs to mobilise help by
proximity — who can reach whom quickly — rather than by department or branch.
The stated goal is a map a congregant can open and see who lives closest to them.

This is a legitimate and specific need. The note below is about how to meet it
without publishing more than the need requires.

---

## What it changes

**It amends a decision already on the books.** `home_address` is currently in the
**admin-and-self** tier, alongside full DOB, legal names, emergency contacts,
insurance and ID document URLs. See `directory-visibility-toggles.md`. Building a
member-visible map moves address data — in some form — into the member tier.

That is a decision to make deliberately, not a side effect of adding a feature.

### The combination is the real exposure

`MEMBER_VISIBLE_FAMILY = true` was accepted on 2026-08-29 **knowing it exposes
minors' legal names to all members**, on the reasoning that children have no other
name field. That was defensible in isolation.

Joining children's names to home locations in a single member-visible view is a
materially different thing from either one alone: it produces a browsable list of
where specific named children live, available to every account in the domain.

**This should be re-examined before the map ships**, not inherited. The options are
to keep family details out of the map layer entirely, to drop
`MEMBER_VISIBLE_FAMILY`, or to accept the combination explicitly and on the record.

### "Every congregant accepts this" — where that holds and where it does not

Membership consent is broad and reasonable for the ordinary case. It does not
cover:

- a member with a protective order against another member,
- someone estranged from family who are also members,
- a member who has left and whose row has not yet been archived,
- anyone whose safety depends on an address not being browsable.

These are not hypothetical in a congregation of any size. The design answer is a
**per-person opt-out**, not a blanket assumption — and the opt-out must be quiet
enough that exercising it is not itself a signal. A member who opts out simply does
not appear in the member-facing map layer. Leadership and E.R.T. still hold the
exact address, because that is where the emergency capability actually lives.

---

## The design that meets the goal with most of the risk removed

**"Who lives closest to me" is a distance question, not an address question.**

Serve members a deliberately coarsened location plus an accurate distance ranking.
A congregant sees *"Brother X — about 1.2 miles, north"* and can coordinate. They
do not see the house.

### Precision tiers

| Audience | Sees | Why |
|---|---|---|
| Member | Coarsened point (rounded, or fixed offset ~0.5 mi) + accurate distance + direction | Enough to know who is near. Not enough to find a door. |
| Self | Own exact location | It is their own data. |
| E.R.T. / leadership group | Exact coordinates and address | They are the ones dispatching help. |
| Opted out | Absent from the member layer entirely | Still reachable by leadership. |

Access is by **Google Group**, as everywhere else in this project — never by named
individual.

### Data model

- Geocode **once, at save time**, when the address is written. Store `latitude`,
  `longitude` and `geocoded_at` as new sheet columns (append to the header row —
  never hardcode column positions).
- Store the **coarsened** coordinates as their own columns, derived at save time.
  The member payload then never carries the precise pair at all, the same way
  `getUsers()` already redacts per caller rather than hiding at render time.
- Re-geocode only when the address string changes.

**Never geocode on page render.** Geocoding 54 addresses per page view turns a few
dozen API events a month into thousands, and it is the single thing most likely to
produce a surprise invoice.

---

## Cost and API exposure

Google Maps Platform requires **billing enabled** on the Cloud project — this is
what currently breaks address autocomplete (`BillingNotEnabledMapError`). Since
March 1 2025 the old $200 monthly credit is replaced by a per-SKU free monthly
allowance: 10,000 events for Essentials-tier SKUs, 5,000 for Pro, 1,000 for
Enterprise.

At roughly 54 staff, geocoding once per address change and loading a map view
occasionally, real usage sits far below any of those thresholds. Expected cost is
zero.

**But a map is a much heavier consumer than autocomplete** — Dynamic Maps loads per
view, per member, where autocomplete fires only while someone types in one field.
The controls belong in place before the map ships, not after:

- per-API **quota caps** — the practical spend ceiling,
- a **billing budget with alerts**,
- an **API restriction** limiting the key to Maps JavaScript + Places + Geocoding.

An HTTP referrer restriction is impractical: Apps Script serves these pages from a
randomized `*.googleusercontent.com` sandbox origin. Quota caps do the real work.

Note also that `MAPS_API_KEY` is necessarily readable by every signed-in member —
`doGet()` injects it into the profilesetup templates. That is unavoidable for a
client-side Maps feature. While billing is off the key is worthless to a thief;
**enabling billing is the moment it becomes a financial liability**, which is why
the caps go in during the same visit to the console.

---

## Open questions for Shahad

1. How coarse should the member-visible location be? A rounded grid, a fixed radius
   offset, or a named neighbourhood with no point at all?
2. Does the map layer show family members, or adults only? (See the combination
   problem above.)
3. Which group is the "exact location" tier — `tn-admin@`, an E.R.T. group, or both?
4. Is the opt-out self-service in the profile editor, or a request to `it@`?
5. Should members outside a campus radius be shown at all, or does the map scope to
   one campus at a time?

---

## Related

- `directory-visibility-toggles.md` — the current field tiers this amends
- `standalone-apps-check.md` — palette pass and deploy list
- `CLAUDE.md` — brand tokens, group-based permissions convention
