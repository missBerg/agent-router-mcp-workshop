# Facilitator run-of-show

75 minutes · one presenter (+ helpers if you have them) · attendees on Codespaces or local.
The slides carry presenter notes that match this page. Clock times are from the session start.

## Before the day

- [ ] Run `./tools/e2e.sh` on the published repo (CI does this on every push — check it is green).
- [ ] Open a fresh Codespace from the README button **on the conference wifi** the day before; note how long it takes.
- [ ] Confirm the GHCR devcontainer image is public (Packages → `devcontainer` → Package settings → visibility).
- [ ] Do one full run as an attendee with an LLM (BYO key in a Codespace) and once with `./lab llm scripted`.
- [ ] Shorten the lab-site URL and the Codespaces URL (QR codes are on slides 2 and the last slide; URLs live in `slides/src/config.ts`).
- [ ] Have a personal hotspot as backup for the presenter laptop.

## In the room, before doors open

- [ ] Presenter laptop: Codespace open, `./lab reset --yes && ./lab llm <provider> && ./lab doctor` green.
- [ ] A second terminal tab ready for `./lab otel`.
- [ ] Slides in presenter mode; slide 2 (QR) ready.
- [ ] Wifi name/password written on the whiteboard (and on slide 2 if you know it in advance).

## Timeline

| Clock | Min | Slide(s) | What happens | Say / do |
| --- | --- | --- | --- | --- |
| 0:00 | 2 | 1–2 | Welcome, **open your Codespace now** | "Scan the QR, click *Create codespace*, and let it boot while I talk. No Codespace? `./lab setup` on macOS arm64/Linux." |
| 0:02 | 5 | 3–6 | Hook + live demo | `./lab agent --direct --list`, then `./lab agent --direct`. Point at **200 tools · ≈N k tokens**. If the model API rejects 200 tools, celebrate it: "the API refused before the agent even started — that's the problem." |
| 0:07 | 3 | 7–9 | Objectives, how labs work, Agent Router in one picture | Stress: *go at your own pace*, `./lab check N` gives feedback, `./lab solution N` catches you up any time. |
| 0:10 | 5 | 10 | **Lab 0** — set up & meet the agent | Walk the room. Most common blocker: LLM choice → "no key? `./lab llm scripted` — every lab still works". |
| 0:15 | 17 | 10 | **Lab 1** — Aggregate & filter | At 0:22 do a quick show of hands: "who has the router running?" At 0:28: "two minutes to the checkpoint". |
| 0:32 | 4 | 11–12 | Debrief 1 → concept: identity & authorization | Ask one person what their tool count went from/to. **Sync point:** "Not at the checkpoint? `./lab solution 1` and come with us." |
| 0:36 | 18 | 13 | **Lab 2** — Authorize | Watch for the classic: the deny rule placed *after* the allow rule — `./lab run` flags it. |
| 0:54 | 3 | 14–15 | Debrief 2 (deny-first) → concept: what to observe | **Sync point:** `./lab solution 2`. |
| 0:57 | 12 | 16 | **Lab 3** — Observe | Remind them: *two terminals* — `./lab otel` in one, the agent in the other. |
| 1:09 | 6 | 17–19 | Recall, take-home, thank you | Retrieval questions out loud before revealing answers. Point at **Bring your own agent** and the **Kubernetes take-home**. Feedback QR. |

**If you are running late:** shorten the hook demo (skip `--list`), cut debriefs to one slide each,
and make Lab 3 a guided demo on your screen while attendees follow along. Never cut the
"real tool call through the router" moments — they are the promise of the session.

**If you are running early:** invite people to the Stretch tasks, or demo *Bring your own agent*
with Claude Code / VS Code pointed at the router (`./lab connect`).

## Checkpoints at a glance

| Lab | `./lab check N` passes when… | Fast fix if someone is stuck |
| --- | --- | --- |
| 1 | the router exposes exactly the 8 needed tools **and** the agent made a tool call through it | `./lab solution 1` |
| 2 | no token → 401; triage-bot sees no deploy tools; release-bot deploys to staging; production → 403; the agent made a call | `./lab solution 2` |
| 3 | access log lines carry `agent.id`; a denied (403) call is in the log; the investigation questions are answered | `./lab solution 3`, then re-run the production attempt |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Codespace takes > 3 min | image not cached / prebuild missing | Keep going on the presenter screen; they catch up with `./lab solution N` |
| `./lab llm` test fails | wrong key/model, no credit | `./lab llm scripted` (still real tool calls), or fix the key |
| Agent: "the model API refused … 200 tools" | Lab 0 / Lab 1 *before* filtering, OpenAI-family model | Expected! That's the point — finish Lab 1's filter |
| Agent loops or wanders | small model | `--brain scripted`, or a larger model via `./lab llm` |
| `./lab run`: "Router not restarted — fix the error" | YAML mistake (indentation, typo, prefixed tool name) | Read the line number and hint it prints; `./lab solution N` if stuck |
| `./lab run`: router failed to start | port 1975 busy, or a config the router rejects | `./lab stop`, then `./lab run`; look at `.lab/router.log` |
| release-bot can't see `deploy__deploy` | an *Allow* rule with an argument condition | deny-first: Deny rule with the CEL, then a plain Allow |
| `./lab logs` is empty | Envoy flushes ~every second; or the router restarted | wait a second; run the agent again |
| `agent.id` empty in logs | only one of the two Lab 3 edits is done | `claimToHeaders` **and** `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES`, then `./lab run` |
| No traces in otel-tui | otel-tui started after the router? (fine) / started in the wrong place | `./lab otel` must run in the same Codespace/machine |
| Local Windows / Intel Mac | no aigw build for that platform | Codespace |

## After the session

- Leave the repo public; the lab site stays up for people finishing at home.
- Collect feedback (QR on the last slide); note which lab overran for next time.
