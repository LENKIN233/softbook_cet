# Current Real App Blind Audit

## Scope

This audit reviews the real app screenshot set in `docs/design/app-screenshots/current-real-app/` as if the reviewer has no PR history. The screenshots are implementation evidence, not design authority.

## Snapshot Verdict

| Screenshot | Current read | Main failure | Required reset |
|---|---|---|---|
| `auth.png` | Looks like a competent entry surface, but it does not yet establish the Learning / Space product identity. | The user sees account access before understanding the app's object grammar. | Auth should borrow the same card-object and address language in a quieter, gated form. |
| `learning.png` | Closer to a usable learning surface than earlier versions. | It still reads as page composition around a card, not one operating surface with attached layers. | Make the current card object the app's physical center and attach tools to it. |
| `detail.png` | Cleaner after visual polish. | It still behaves like a result report page rather than a resolved state of the same learning object. | Convert result detail into an attached answer slip that can expand without becoming a separate report. |
| `space.png` | Has some object intent. | It still risks becoming a designed list or shelf picture rather than a navigable physical hierarchy. | Make current library / group / box / card visible in a spatial address model. |
| `statistics.png` | Quiet enough to avoid gamification. | It lacks a strong reason to exist inside the same one-screen app grammar. | Treat stats as a low-pressure ledger attached to the learning day, not a dashboard. |
| `mine.png` | Operationally clear. | It feels like a generic account/settings page and does not inherit the product world. | Make account, membership, and recovery live inside the same softbook object system. |

## Root Cause

The current app is not failing mainly because of color, line, or spacing details. It is failing because the implementation has no single app-level interaction grammar. Each screen tries to become a complete page. That makes the app feel like stacked mobile web sections instead of a mainstream mobile app centered on one current learning object.

## Perturbation Findings

- If every current RN screen is treated as visually wrong, the surviving truth is still clear: one current card, one primary action, secondary tools, feedback, recovery, and Space continuity.
- If the current accepted mocks are treated as incomplete, the search run must not patch implementation first; it must generate and compare full surface candidates.
- If leadership sees only screenshots, the failure is the missing app archetype: no coherent shell, no persistent current object grammar, and no obvious relationship between Learning and Space.
- If the app must remain one-screen, extra information cannot be solved by scrolling. It must move into attached slips, sheets, object drill-in states, or quiet secondary layers.
- If Space is not allowed to become a normal page, the app shell must give Space a physical grammar before RN layout work begins.

## Design Review Checklist Answers

Q1: Current-library evidence is inconsistent across the screenshot set. The reset must make Reading or the active library the single strong accent for Learning / Detail / Space, while Statistics and Mine stay neutral.

Q2: Current focal objects are inconsistent. Learning has a card, Detail has a report, Space has a page, Statistics has metrics, and Mine has account controls. The reset needs one reusable hierarchy: current object, attached action layer, quiet chrome.

Q3: Learning silhouettes are partly present, but the result detail state does not read as a Learning silhouette continuation. Space hierarchy is not strong enough when blurred.

Q4: The screenshots no longer show the worst forbidden patterns, but their stacked-panel grammar still drifts toward dashboard and page-section composition.

Q5: The target is phone; the reset must preserve safe area, avoid horizontal overflow, and keep navigation as a floating capsule rather than a full-width bottom strip.

Q6: Learning must not promote module selection; Statistics must use tabular numbers; flip remains exactly two self-assess states, 有把握 = #22C58B mint and 再回看 = #F5B100 amber.
