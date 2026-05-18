import { Link } from 'react-router-dom'
import styles from './Legal.module.css'

export default function PrivacyPolicy() {
  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>← Groovz</Link>

      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.meta}>Last updated: May 2026</p>

      <div className={styles.section}>
        <p className={styles.body}>
          Groovz is a music intelligence service. This policy explains what information we collect, why we collect it, and how we handle it. We have tried to write this clearly rather than in legal language.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Who we are</h2>
        <p className={styles.body}>
          Groovz is a side project operated by an individual based in the United Kingdom. For any privacy-related questions, contact us at <a href="mailto:ubahakweemeka@gmail.com" className={styles.link}>ubahakweemeka@gmail.com</a>.
        </p>
        <p className={styles.body}>
          As a service based in and operated from the UK, Groovz is subject to UK GDPR. We act as the data controller for all personal information described in this policy.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. What we collect</h2>

        <p className={styles.body}><strong style={{ color: 'var(--color-text-primary)' }}>Account information</strong></p>
        <p className={styles.body}>When you sign up: your email address, a securely hashed password (the original is never stored), and your region (used only for pricing display).</p>

        <p className={styles.body}><strong style={{ color: 'var(--color-text-primary)' }}>Usage signals</strong></p>
        <p className={styles.body}>When you use Groovz to generate playlists, we log signals that power your personalised experience:</p>
        <ul className={styles.list}>
          <li className={styles.listItem}>The seed tracks you choose</li>
          <li className={styles.listItem}>A short hash of any text prompts you submit — the full prompt text is never stored</li>
          <li className={styles.listItem}>Playlists you generate, including duration and generation type</li>
          <li className={styles.listItem}>Context cards you select</li>
          <li className={styles.listItem}>Whether you regenerate a playlist from the same seed</li>
        </ul>

        <p className={styles.body}><strong style={{ color: 'var(--color-text-primary)' }}>Spotify listening history</strong> (only with your explicit consent)</p>
        <p className={styles.body}>
          If you connect Spotify and enable signal collection during onboarding, we periodically fetch your recently played tracks and top tracks. This data is stored as usage signals and is used solely to build your taste profile. You can disable this at any time in your profile settings.
        </p>

        <p className={styles.body}><strong style={{ color: 'var(--color-text-primary)' }}>Platform tokens</strong></p>
        <p className={styles.body}>
          When you connect a streaming platform, we store your access and refresh tokens. These are encrypted at rest using AES-256-GCM and are never exposed to the frontend or any third party.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Legal basis for processing</h2>
        <p className={styles.body}>
          We process your data on the basis of <strong style={{ color: 'var(--color-text-primary)' }}>consent</strong>. At sign-up you explicitly agree to this Privacy Policy and our Terms of Service. Spotify signal collection requires a second, separate opt-in during onboarding. You may withdraw consent for signal collection at any time without losing access to Groovz.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. How we use your data</h2>
        <dl className={styles.dataList}>
          {[
            { term: 'Email address',         desc: 'Account authentication and login' },
            { term: 'Usage signals',         desc: 'Building your personalised taste profile and improving recommendations' },
            { term: 'Spotify recently played', desc: 'Taste profile signals (with consent only)' },
            { term: 'Spotify top tracks',    desc: 'Taste profile signals (with consent only)' },
            { term: 'Platform tokens',       desc: 'Exporting playlists to your chosen streaming platform' },
            { term: 'Region',                desc: 'Displaying pricing in your local currency' },
          ].map(({ term, desc }) => (
            <div key={term} className={styles.dataItem}>
              <dt className={styles.dataTerm}>{term}</dt>
              <dd className={styles.dataDesc}>{desc}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.body}>
          We do not use your data for advertising. We do not use your data to train any publicly available model.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Spotify integration — detailed disclosure</h2>
        <p className={styles.body}>
          Groovz connects to Spotify using the following permissions. We request only what we need.
        </p>
        <div className={styles.scopeBlock}>
          <div className={styles.scope}>
            <p className={styles.scopeName}>user-read-private</p>
            <p className={styles.scopeDesc}>To read your Spotify profile and verify your account identity.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>user-read-email</p>
            <p className={styles.scopeDesc}>To confirm your Spotify account identity during connection.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>user-library-read</p>
            <p className={styles.scopeDesc}>To display your liked songs and playlists so you can pick a seed track for generation.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>playlist-modify-public</p>
            <p className={styles.scopeDesc}>To create playlists in your Spotify account when you choose to export a generated playlist.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>playlist-modify-private</p>
            <p className={styles.scopeDesc}>To create private playlists in your Spotify account when you choose to export.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>user-read-recently-played</p>
            <p className={styles.scopeDesc}>To collect listening history as taste signals. Only fetched with your explicit consent, enabled during onboarding and controllable in settings.</p>
          </div>
          <div className={styles.scope}>
            <p className={styles.scopeName}>user-top-read</p>
            <p className={styles.scopeDesc}>To collect your top tracks as taste signals across short, medium and long time ranges. Same consent requirement as above.</p>
          </div>
        </div>
        <p className={styles.body}>
          Spotify listening data is stored as structured signal records in our database. It is never visible to other users, never sold, never shared with third parties, and is permanently and irreversibly deleted when you delete your account.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>6. How long we keep your data</h2>
        <p className={styles.body}>
          We retain your data for as long as your account is active. When you delete your account using the "Delete account" button in your profile:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>Your account, email address and preferences are permanently deleted</li>
          <li className={styles.listItem}>All usage signals, including any Spotify listening history we collected, are permanently deleted</li>
          <li className={styles.listItem}>Your encrypted platform tokens are permanently deleted</li>
          <li className={styles.listItem}>Playlists already exported to your streaming platform remain there — we have no ability to delete content from third-party platforms once it is exported</li>
        </ul>
        <p className={styles.body}>
          There is no grace period. Deletion is immediate and irreversible.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Who we share your data with</h2>
        <p className={styles.body}>
          We do not sell your data. We do not share your personal data with any third party for commercial purposes. We use the following services to operate Groovz:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}><strong>Spotify</strong> — playlist export and listening history collection (with consent)</li>
          <li className={styles.listItem}><strong>Last.fm</strong> — music metadata and the recommendation graph. No personal data is sent to Last.fm.</li>
          <li className={styles.listItem}><strong>Groq</strong> — text processing for understanding playlist prompts. Prompts are processed as short summaries; full prompt text is never sent or stored.</li>
          <li className={styles.listItem}><strong>Hugging Face</strong> — text embeddings used during generation. No identifying information is sent.</li>
          <li className={styles.listItem}><strong>Railway</strong> (backend hosting) and <strong>Vercel</strong> (frontend hosting) — infrastructure providers. Both operate under standard data processing terms.</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>8. Your rights</h2>
        <p className={styles.body}>Under UK GDPR, you have the right to:</p>
        <ul className={styles.list}>
          <li className={styles.listItem}><strong>Access</strong> your data — email us and we will provide a summary of what we hold</li>
          <li className={styles.listItem}><strong>Delete</strong> your data — use the "Delete account" button in your profile. This is immediate and permanent.</li>
          <li className={styles.listItem}><strong>Withdraw consent</strong> for Spotify signal collection at any time in your profile settings, without losing access to Groovz</li>
          <li className={styles.listItem}><strong>Port</strong> your data — contact us for a copy in a common format</li>
          <li className={styles.listItem}><strong>Complain</strong> to the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className={styles.link}>ico.org.uk</a> if you believe we have mishandled your data</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>9. Security</h2>
        <p className={styles.body}>
          Passwords are hashed using a secure one-way algorithm. Platform tokens are encrypted at rest using AES-256-GCM. Access tokens are never exposed to the frontend or any external service. All data is transmitted over HTTPS.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>10. Cookies</h2>
        <p className={styles.body}>
          We use a single HTTP-only cookie to maintain your login session. This cookie is not accessible to JavaScript, contains only a secure refresh token, and is used solely for authentication. We do not use advertising, tracking or analytics cookies.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>11. Changes to this policy</h2>
        <p className={styles.body}>
          If we make material changes to this policy we will notify you by email at the address associated with your account before those changes take effect. Continued use of Groovz after notification constitutes acceptance.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>12. Contact</h2>
        <p className={styles.body}>
          For any privacy-related requests or questions: <a href="mailto:ubahakweemeka@gmail.com" className={styles.link}>ubahakweemeka@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
