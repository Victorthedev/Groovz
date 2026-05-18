import { Link } from 'react-router-dom'
import styles from './Legal.module.css'

export default function Terms() {
  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>← Groovz</Link>

      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.meta}>Last updated: May 2026</p>

      <div className={styles.section}>
        <p className={styles.body}>
          These terms govern your use of Groovz. By creating an account, you agree to them. If you do not agree, do not use the service.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. What Groovz is</h2>
        <p className={styles.body}>
          Groovz is a music intelligence tool that generates personalised playlists. It uses music metadata from Last.fm, AI-powered text analysis, and (with your permission) your listening history to build playlists that reflect your taste. Groovz is a side project — it is provided as-is, without guarantees of uptime or continued availability.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Your account</h2>
        <p className={styles.body}>
          You must provide a valid email address to create an account. You are responsible for keeping your credentials secure. You may delete your account at any time from your profile — this is permanent and irreversible. You must be 13 or older to use Groovz.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. What you can do</h2>
        <p className={styles.body}>
          You may use Groovz to generate playlists for personal, non-commercial listening. You may connect streaming platforms to export playlists to your own accounts on those services. You may invite others to a Session Blend to generate a shared playlist.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. What you cannot do</h2>
        <ul className={styles.list}>
          <li className={styles.listItem}>Use Groovz to generate content for resale or commercial redistribution</li>
          <li className={styles.listItem}>Attempt to reverse-engineer, scrape or extract data from the Groovz service or its API</li>
          <li className={styles.listItem}>Circumvent rate limits or otherwise abuse the generation system</li>
          <li className={styles.listItem}>Use Groovz in a way that violates the terms of service of any connected platform (Spotify, Deezer or others)</li>
          <li className={styles.listItem}>Impersonate another person or create multiple accounts to circumvent any restrictions</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Third-party services</h2>
        <p className={styles.body}>
          Groovz integrates with third-party services including Spotify, Last.fm, Groq and Hugging Face. Your use of those services is governed by their own terms of service. Groovz is not affiliated with, endorsed by or in any way officially connected to any of these services or their operators.
        </p>
        <p className={styles.body}>
          Playlists exported to a streaming platform are governed by that platform's terms. We have no control over how they are treated once exported.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Availability</h2>
        <p className={styles.body}>
          Groovz is a hobby project. We make no guarantees about uptime, response times or continued availability of the service. The service may be interrupted, degraded or discontinued at any time. We will make reasonable efforts to notify users by email in advance of any planned discontinuation.
        </p>
        <p className={styles.body}>
          Playlists already exported to your streaming platform remain in your account regardless of Groovz's availability.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Intellectual property</h2>
        <p className={styles.body}>
          Groovz does not claim ownership of any music, track metadata or content surfaced through the service. All music content belongs to its respective rights holders. The Groovz name, wordmark and product are the property of Groovz.
        </p>
        <p className={styles.body}>
          The playlists you generate through Groovz are yours. We do not claim any rights over the playlists created using the service.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>8. Limitation of liability</h2>
        <p className={styles.body}>
          To the maximum extent permitted by applicable law, Groovz and its operator are not liable for any indirect, incidental, special or consequential damages arising from your use of the service, including but not limited to loss of data, loss of access to playlists, or service interruptions.
        </p>
        <p className={styles.body}>
          Our total liability to you for any claim arising from use of Groovz is limited to the amount you paid us in the twelve months preceding the claim. For users on the free plan, this is zero.
        </p>
        <p className={styles.body}>
          Nothing in these terms limits our liability for death or personal injury caused by negligence, fraud or anything else that cannot be excluded under English law.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>9. Termination</h2>
        <p className={styles.body}>
          You may stop using Groovz at any time and delete your account from your profile. We may suspend or terminate your account if you violate these terms, abuse the service, or if we decide to discontinue Groovz. We will make reasonable efforts to notify you by email before doing so, except in cases of serious abuse where immediate termination is warranted.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>10. Governing law</h2>
        <p className={styles.body}>
          These terms are governed by the laws of England and Wales. Any disputes arising from these terms or your use of Groovz will be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>11. Changes</h2>
        <p className={styles.body}>
          We may update these terms from time to time. If we make material changes we will notify you by email before those changes take effect. Continued use of Groovz after notification constitutes acceptance of the updated terms.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>12. Contact</h2>
        <p className={styles.body}>
          For any questions about these terms: <a href="mailto:ubahakweemeka@gmail.com" className={styles.link}>ubahakweemeka@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
