# Moving this project to the shahad@truenation.org Claude account

Nothing migrates automatically between Claude accounts — conversations, Projects, memory,
artifacts, connectors and the device link are all per-account. This is a rebuild, staged
through the Mac, which is account-agnostic.

## Phase 1 — done on the old account (2026-09-15)

- [x] `claude/SYSTEM-MAP.md` — five Apps Script projects, scriptIds, deployment URLs, sheets, groups
- [x] `claude/class-scheduling-plan.md` — the full build plan
- [x] `claude/device-access.md` — folder paths and grant procedure
- [x] `claude/migration-checklist.md` — this file
- [x] `claude/CONTINUE-HERE.md` — the new-chat handoff
- [x] Teacher Portal security fix applied (`_foo` -> `foo_`, 31 helpers)
- [x] Stale repo paths fixed in `portal-status.md` and `CLAUDE.md` **on the Mac**
- [x] Stale files archived; manifests restored into `scripts/`
- [ ] **Shahad commits and pushes both repos**

## Phase 2 — set up the new account

- [ ] Sign the Claude **desktop app** into `shahad@truenation.org`
      (this drops the old account's link to the Mac — do Phase 1 first)
- [ ] Create a Claude Project, e.g. "TN Intranet"
- [ ] Upload as project docs: `CLAUDE.md`, `portal-status.md`, `claude/SYSTEM-MAP.md`,
      `claude/class-scheduling-plan.md`, `claude/CONTINUE-HERE.md`,
      `Claude outputs/handoff-teachers-portal.md`
- [ ] Reconnect connectors. **Connect Google Drive as `shahad@truenation.org`** — on the old
      account it was the personal gmail, which is why the staff sheet
      `1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk` returned "not found".
- [ ] Re-link the Mac and grant the two folders (see `device-access.md`)
- [ ] Check whether the new account is Team/Enterprise — an admin may restrict connectors,
      memory generation, or artifact publishing

## Phase 3 — verify before trusting it

- [ ] First message points at `claude/CONTINUE-HERE.md`
- [ ] Confirm both folders are readable
- [ ] Confirm Drive now reaches the staff sheet
- [ ] Re-publish the scheduling plan as an artifact if you want the visual version
- [ ] Re-teach working preferences (they were in the old account's memory):
      paste-don't-dump, he runs git, WCAG AA, sans-serif only, visual learner,
      ready-to-use documents over guided instructions

## Phase 4 — the Calendar scope blocker  [CLEARED 2026-09-21]

`https://www.googleapis.com/auth/calendar` is now granted to client `105017769716672004648` in
domain-wide delegation, alongside `groups`, `script.send_mail` and `userinfo.email`. Nothing
below is outstanding; it is kept for the record of how the decision was reached.


**LARGELY DISSOLVED 2026-09-19.** Decision A (see `sheet-schema.md`) put every write in Apps
Script, so the service-account route below is not the one being taken. Apps Script works out its
own scopes from the code: the first time `CalendarApp` appears, the editor asks for the calendar
scope on the next run and a re-authorisation, with no admin console change. What IS still
required: the account that deploys the web app (`executeAs: USER_DEPLOYING`) must have edit
rights on each of the four calendars, and the public Classes calendar still has to be created.

**Also on record: the explicit `oauthScopes` block below is INCOMPLETE.** It omits
`admin.directory.user.readonly`, `admin.directory.group.member.readonly`, `groups` and
`userinfo.email`, which the portal's admin check and name lookup depend on. Pasting it as written
would break `isAdmin()` and `displayName_()`. Since auto-scoping already works, the safest option
is to declare no `oauthScopes` block at all - which is what the manifest does today.

Nothing calendar-related works until this is granted.

**If the calendar push runs in Apps Script** (recommended — it has time-driven triggers and
`CalendarApp` built in; Vercel does not without Vercel Cron): add to the teacher portal's
`appsscript.json`, which currently declares **no `oauthScopes` block at all**:

```
"oauthScopes": [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/script.scriptapp",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.send_mail"
]
```

Then open the script, run any function once, accept the consent screen. No admin console change.

**If it runs from Next.js via the service account:**

1. `admin.google.com` -> Security -> Access and data control -> API controls
2. Manage Domain-Wide Delegation
3. Find client ID `105017769716672004648` -> Edit
4. Append: `https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/calendar.readonly`
5. Authorize, wait ~5 minutes
6. **Redeploy Vercel** — existing tokens do not gain scopes. This is the same trap as
   `spreadsheets` vs `spreadsheets.readonly`.
7. Share each calendar with `GOOGLE_ADMIN_EMAIL` at "Make changes to events" — delegation alone
   does not grant calendar access.

## Still outstanding after migration

- [ ] Create `graphics-lead@truenation.org` (Ratazah)
- [ ] Create the public **Classes** calendar (see plan §7)
- [ ] Full handoffs, one area per session: directory, announcements, profile editor, groups library
- [ ] Resolve whether the groups+members library is consumed by anything
- [ ] `SECURE_ID_FOLDER_ID` is unset — ID uploads land in root Drive, domain-shared.
      **Highest open security item.**
