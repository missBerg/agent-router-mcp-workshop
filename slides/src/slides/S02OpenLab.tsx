import { DeckSlide } from '../components/DeckSlide'
import { QR } from '../components/QR'
import { SpeakerNotes } from '../components/SpeakerNotes'
import { CODESPACES_URL, LAB_SITE_URL, splitUrl } from '../config'

export function S02OpenLab() {
  return (
    <DeckSlide
      className="s-open"
      notes={
        <SpeakerNotes
          time="0:00–0:02"
          segment="Welcome · open your Codespace NOW"
          cues={[
            <>Say it at minute 0 so environments boot during the intro. The Codespace image is prebuilt, but the first start still takes a minute or two.</>,
            <>Leave this slide up while you introduce yourself and the session. Come back to it if people walk in late.</>,
            <>Ask for hands: "Who sees a terminal in their browser already?" Helpers walk the aisles for GitHub sign-in prompts.</>,
            <>Local install is opt-in: macOS arm64 or Linux, <code>./lab setup</code>, about 330 MB. Steer people to Codespaces on conference Wi-Fi.</>,
            <>Windows or Intel Mac? Codespaces only (there are no local <code>aigw</code> builds for them).</>,
          ]}
        >
          <p>
            Before I say anything else: <b>scan this and open your Codespace now.</b> It's a full lab environment in
            your browser: the router, five MCP servers, a sample agent, all pre-installed. It boots while I talk.
          </p>
          <p>
            The small code is the lab guide. Every step we do today is written there, so you can go at your own pace.
          </p>
          <p>No pre-work, no installs. If you have a GitHub account, you're set.</p>
        </SpeakerNotes>
      }
    >
      <div className="open-grid">
        <div className="open-left">
          <p className="kicker">Before anything else</p>
          <h2 className="title open-title">Open your lab now</h2>
          <p className="lead open-lead">It boots while we talk.</p>
          <ul className="open-paths">
            <li>
              <span className="open-path-name">Codespaces</span>
              <span>browser only, any OS</span>
            </li>
            <li>
              <span className="open-path-name">Local</span>
              <span>
                macOS arm64 / Linux · <code className="ic">./lab setup</code>
              </span>
            </li>
          </ul>
          <div className="open-guide">
            <QR value={LAB_SITE_URL} size={200} title="Lab guide" />
            <div>
              <p className="open-guide-label">Lab guide</p>
              <p className="open-guide-url">
                {splitUrl(LAB_SITE_URL)[0]}
                <br />
                {splitUrl(LAB_SITE_URL)[1]}
              </p>
            </div>
          </div>
        </div>
        <div className="open-right">
          <p className="open-scan">Scan · open in Codespaces</p>
          <QR
            value={CODESPACES_URL}
            size={600}
            title="Open the workshop Codespace"
            caption={
              <code>
                {splitUrl(CODESPACES_URL)[0]}
                <br />
                {splitUrl(CODESPACES_URL)[1]}
              </code>
            }
          />
        </div>
      </div>
    </DeckSlide>
  )
}
