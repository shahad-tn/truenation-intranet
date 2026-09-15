# Reaching these files from a Claude session

Claude sessions run in a cloud container. Your Mac is reached through the device bridge, and
folder grants last for **one session only** — repeat this each new chat.

## Procedure

1. Call `get_device_info`. `connectedFolders` is usually empty at session start — that is
   normal, not an error. It also lists home-directory names.
2. Request both folders in **one** call (one prompt, minimal set):
   - `~/[vercel] truenation-intranet-directory` — the LIVE Next.js repo (`shahad-tn/truenation`)
   - `~/Documents/Claude/Projects/True Nation Intranet Project Build` — Apps Script sources
3. After the grant they mount under `$HOME/mnt/<folder-name>`. **The mount name drops any
   parent path**, so the second becomes `$HOME/mnt/True Nation Intranet Project Build`.

`~/truenation-intranet-directory` (no prefix) is an EMPTY leftover. Ignore it.

## Rules once connected

- Always give Shahad **macOS paths** (`~/...`), never the bridge's `$HOME/mnt/...` spelling.
- Claude edits files. **Shahad runs every git command himself.** Hand him the bash block.
- **No `#` comment lines inside bash blocks** — his zsh has `interactive_comments` off, so a
  comment line executes as a command and breaks the paste.
- For anything pasted into Apps Script, hand him **one `pbcopy` one-liner per file**. Never
  dump file contents into chat.
- The repo copy is authoritative. He pastes repo files into Apps Script, not the reverse.
- Never `.replace()` without asserting it matched. A silent no-op reported as success has
  burned this project more than once.
- `device_bash` cannot delete. Archive by `mv` into `archive/`.
