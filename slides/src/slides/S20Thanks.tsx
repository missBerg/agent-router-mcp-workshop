import { DeckSlide } from '../components/DeckSlide'
import { QR } from '../components/QR'
import { SpeakerNotes } from '../components/SpeakerNotes'
import { EVENT, LAB_SITE_URL, REPO_URL, SPEAKER, shortUrl, splitUrl } from '../config'
import arLockup from '../assets/ar-horizontal-on-dark-transparent.svg'
import aaifLogo from '../assets/aaif-logo-white.svg'

export function S20Thanks() {
  return (
    <DeckSlide
      tone="dark"
      footer={false}
      className="s-thanks"
      notes={
        <SpeakerNotes
          time="1:14–1:15"
          segment="Close"
          cues={[
            <>Leave this slide up while people pack up: the QR keeps the lab site one scan away.</>,
            <>Invite questions at the front; mention where to find you for the rest of {EVENT}.</>,
          ]}
        >
          <p>
            Thank you! You aggregated five MCP servers behind one router, cut 200 tools to 8, gave two agents two
            identities, blocked a production deploy, and found it again in the telemetry.
          </p>
          <p>
            Agent Router is open source and an Agentic AI Foundation project. Come build it with us: issues and PRs
            welcome, and I'm around for questions.
          </p>
        </SpeakerNotes>
      }
    >
      <div className="thanks">
        <div className="thanks-main">
          <h2 className="thanks-title">Thank you</h2>
          <p className="thanks-name">{SPEAKER.name}</p>
          <p className="thanks-role">
            {SPEAKER.org} · {SPEAKER.role}
          </p>
          <ul className="thanks-contacts">
            {SPEAKER.contacts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="thanks-repo">
            Workshop repo <code>{shortUrl(REPO_URL)}</code>
          </p>
          <div className="thanks-logos">
            <img className="thanks-ar" src={arLockup} alt="Agent Router" />
            <img className="thanks-aaif" src={aaifLogo} alt="Agentic AI Foundation" />
          </div>
        </div>
        <QR
          value={LAB_SITE_URL}
          size={420}
          title="Workshop lab site"
          caption={
            <>
              Labs stay online
              <br />
              <code>
                {splitUrl(LAB_SITE_URL)[0]}
                <br />
                {splitUrl(LAB_SITE_URL)[1]}
              </code>
            </>
          }
        />
      </div>
    </DeckSlide>
  )
}
