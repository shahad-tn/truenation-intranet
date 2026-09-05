// ─── EXPORT ALL CHAT SPACES + MEMBERS ────────────────────────────────────────
function exportChatSpaces() {
  const token   = ScriptApp.getOAuthToken();
  const headers = { Authorization: "Bearer " + token };
  const base    = "https://chat.googleapis.com/v1";

  const ss    = SpreadsheetApp.create("Chat Spaces Export");
  const sheet = ss.getActiveSheet();
  sheet.appendRow([
    "Space Name", "Description", "Space ID",
    "Space URL", "Created", "Last Active",
    "Member Name", "Member Role"
  ]);

  let pageToken;
  do {
    let url = base + "/spaces:search"
      + "?useAdminAccess=true"
      + "&pageSize=100"
      + "&query=" + encodeURIComponent(
          'customer="customers/my_customer" AND spaceType="SPACE"');
    if (pageToken) url += "&pageToken=" + pageToken;

    const res    = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
    const data   = JSON.parse(res.getContentText());
    const spaces = data.spaces || [];

    spaces.forEach(space => {
      const spaceName  = space.displayName || "(no name)";
      const spaceDesc  = space.spaceDetails?.description || "";
      const spaceId    = space.name;
      const spaceUrl   = space.spaceUri || "";
      const created    = space.createTime     ? space.createTime.substring(0, 10)     : "";
      const lastActive = space.lastActiveTime ? space.lastActiveTime.substring(0, 10) : "";

      // throttle between spaces to avoid bandwidth quota errors
      Utilities.sleep(500);

      let mToken;
      do {
        let mUrl = base + "/" + spaceId + "/members?useAdminAccess=true&pageSize=100";
        if (mToken) mUrl += "&pageToken=" + mToken;

        const mRes  = UrlFetchApp.fetch(mUrl, { headers, muteHttpExceptions: true });
        const mCode = mRes.getResponseCode();
        const mText = mRes.getContentText();

        // if still rate limited, wait longer and retry once
        if (mCode === 429 || mText.includes("Bandwidth quota")) {
          Logger.log("Rate limited on " + spaceId + " — waiting 10s and retrying...");
          Utilities.sleep(10000);
          const retry  = UrlFetchApp.fetch(mUrl, { headers, muteHttpExceptions: true });
          const rData  = JSON.parse(retry.getContentText());
          const rMems  = rData.memberships || [];
          rMems.forEach(m => {
            sheet.appendRow([spaceName, spaceDesc, spaceId, spaceUrl, created, lastActive,
              m.member?.displayName || m.member?.name || "", m.role || ""]);
          });
          mToken = rData.nextPageToken;
          return;
        }

        const mData   = JSON.parse(mText);
        const members = mData.memberships || [];

        if (members.length === 0) {
          sheet.appendRow([spaceName, spaceDesc, spaceId, spaceUrl, created, lastActive, "(no members)", ""]);
        }
        members.forEach(m => {
          sheet.appendRow([spaceName, spaceDesc, spaceId, spaceUrl, created, lastActive,
            m.member?.displayName || m.member?.name || "", m.role || ""]);
        });

        mToken = mData.nextPageToken;
      } while (mToken);
    });

    pageToken = data.nextPageToken;
  } while (pageToken);

  Logger.log("Done! " + ss.getUrl());
}

// ─── EXPORT ALL GROUPS + MEMBERS ─────────────────────────────────────────────
function exportGroups() {
  const ss    = SpreadsheetApp.create("Workspace Groups Export");
  const sheet = ss.getActiveSheet();

  const domain = Session.getActiveUser().getEmail().split("@")[1];
  const rows   = [["Group Name", "Group Email", "Member Email", "Role"]];
  let pageToken;

  do {
    const res = AdminDirectory.Groups.list({
      domain:     domain,
      maxResults: 200,
      pageToken:  pageToken
    });

    (res.groups || []).forEach(g => {
      Logger.log("Processing: " + g.name);

      // paginate members in case a group has more than 200
      let mToken;
      do {
        const mRes = AdminDirectory.Members.list(g.email, {
          maxResults: 200,
          pageToken:  mToken
        });
        const members = mRes.members || [];

        if (members.length === 0 && !mToken) {
          rows.push([g.name, g.email, "", ""]);
        }
        members.forEach(m => rows.push([g.name, g.email, m.email, m.role]));

        mToken = mRes.nextPageToken;
      } while (mToken);
    });

    pageToken = res.nextPageToken;
  } while (pageToken);

  // write everything in one shot instead of row by row
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log("Done: " + rows.length + " rows → " + ss.getUrl());
}


// ─── DEBUG: TEST CHAT API CONNECTION ─────────────────────────────────────────
function debugChatSpaces() {
  const token   = ScriptApp.getOAuthToken();
  const headers = { Authorization: "Bearer " + token };
  const base    = "https://chat.googleapis.com/v1";

  const url = base + "/spaces:search"
    + "?useAdminAccess=true"
    + "&pageSize=5"
    + "&query=" + encodeURIComponent(
        'customer="customers/my_customer" AND spaceType="SPACE"');

  const res = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
  Logger.log("Code: " + res.getResponseCode());
  Logger.log("Body: " + res.getContentText());
}