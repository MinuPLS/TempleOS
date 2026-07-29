import { useEffect, type ReactNode } from 'react'
import {
  Bot,
  BookOpen,
  Check,
  Code2,
  Globe2,
  Handshake,
  MessageSquareText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import styles from './PromisesKeptPage.module.css'
import {
  roadmapEras,
  roadmapMilestones,
  statusLabels,
  type RoadmapStatus,
} from './roadmapData'

type PhaseCard = {
  phase: string
  title: string
  promise: string
  delivery: string
}

type PromiseTheme = {
  icon: LucideIcon
  title: string
  promise: string
  delivery: ReactNode
  tone: 'blue' | 'purple' | 'orange' | 'green' | 'pink' | 'cyan'
}

const phaseCards: PhaseCard[] = [
  {
    phase: '0',
    title: 'Bonding',
    promise: 'Push HolyC through bonding on pump.tires.',
    delivery: 'Bonded on 6 February 2025 and migrated to PulseX.',
  },
  {
    phase: '1',
    title: 'Listing & boost',
    promise: 'Secure the Dexscreener listing and fund a launch boost.',
    delivery: 'Listing funds were sent and the boost was confirmed live on 6 February 2025.',
  },
  {
    phase: '2',
    title: 'Passive burn utility',
    promise: 'Build a unique token-burning utility from a ready blueprint.',
    delivery: 'Evolved into the JIT Compiler and Divine Manager: an automated burn engine driven by arbitrage.',
  },
]

const promiseThemes: PromiseTheme[] = [
  {
    icon: Globe2,
    title: 'A professional public frontend',
    promise: 'Build a dedicated TempleOS website that could keep growing into a useful dashboard and mobile-ready dApp.',
    delivery: (
      <>
        The website grew alongside the project: from a focused home for the original idea, into a working
        Compile and Restore dApp, and then into a detailed public window on the wider ecosystem. New
        dashboards, trackers, live feeds and transaction views made each technical expansion easier to see
        and understand.
      </>
    ),
    tone: 'blue',
  },
  {
    icon: Bot,
    title: 'Automated protocol protection',
    promise: 'Capture opportunities for the ecosystem instead of leaving them entirely to external MEV bots.',
    delivery: (
      <>
        The automation was built in layers. Manual trades first proved the opportunity; V1 proved it could run
        on-chain; the Feeder, safeguards, Weapon 2 / AOT Relayer and V2 were then added in response to real
        limitations discovered in operation. Each stage solved a problem the previous stage exposed.
      </>
    ),
    tone: 'purple',
  },
  {
    icon: Handshake,
    title: 'Real value for outside communities',
    promise: 'Make TempleOS infrastructure useful beyond its own tokens through sustainable partnerships.',
    delivery: (
      <>
        TempleOS eventually turned an internal burn engine into a partnership model. Instead of keeping all
        captured value inside one project, the Manager can route part of it into automated buy-and-burns for
        partner tokens—giving Briah, CoinMafia, DumbMoney and FUPA recurring utility from the same engine.
      </>
    ),
    tone: 'orange',
  },
  {
    icon: BookOpen,
    title: 'Community tools and education',
    promise: 'Give the community practical ways to understand the compiler and follow the system.',
    delivery: (
      <>
        Following the ecosystem no longer depends on reading contracts or waiting for manual updates.
        <span className={styles.inlineCode}> @DivineWatcher_Bot</span> reports arbitrages and supply changes
        directly in Telegram, while the website’s live modals bring together Manager liquidity, burn activity,
        partner flows and reconstructed trades into a clearer view of ecosystem health.
      </>
    ),
    tone: 'green',
  },
  {
    icon: MessageSquareText,
    title: 'Honest communication',
    promise: 'Keep expectations grounded, including when markets were quiet or engineering was difficult.',
    delivery: (
      <>
        Across more than 18 months—including long stretches when activity was quieter than we hoped—I kept
        building, maintaining the system and expanding what the project could do. The commitment was never to
        pretend every period was exciting; it was to stay present, communicate realistically and keep moving
        the work forward.
      </>
    ),
    tone: 'pink',
  },
  {
    icon: Sparkles,
    title: 'A project-aware AI layer',
    promise: 'Turn the full Telegram history into project-aware AI that can help create accurate posts for the @HolyCpls X page.',
    delivery: (
      <>
        After 18 months, the project’s memory was spread across thousands of Telegram messages. Collecting
        them into a structured knowledge base made it possible for the Scribe to understand not just isolated
        facts, but the history and voice behind them. Its first posts are live under manual review while that
        understanding continues to improve.
      </>
    ),
    tone: 'cyan',
  },
]

const statusClassNames: Record<RoadmapStatus, string> = {
  delivered: styles.statusDelivered,
  evolving: styles.statusEvolving,
  open: styles.statusOpen,
  declined: styles.statusDeclined,
  promise: styles.statusPromise,
  founding: styles.statusFounding,
}

const openItems = [
  {
    label: 'In exploration',
    title: 'HolyC LP wrapper',
    description:
      'The 0-IL-style, fee-exempt wrapper was built and tested in March 2026, but no public dApp release is confirmed.',
  },
  {
    label: 'No decision',
    title: 'LibertySwap V3 migration',
    description:
      'A HolyC/JIT move to V3 pools was explored in July 2026. It remains an economic design question, not a shipped migration.',
  },
  {
    label: 'Manual first',
    title: 'Scribe social automation',
    description:
      'The first post is live and feedback is training the voice. Fully automated posting is still a goal, not the current operating mode.',
  },
  {
    label: 'Declined',
    title: 'Weapon 3 fee shield',
    description:
      'This was intentionally not implemented because the unintended effects outweighed the expected advantage.',
  },
  {
    label: 'Proposed',
    title: 'Holder and governance mechanics',
    description:
      'Earlier holder distributions, community-call gas rewards and governance-timelock ideas were discussed, but no completed public implementation is confirmed.',
  },
  {
    label: 'Unconfirmed',
    title: 'Partner-chat Watcher bot',
    description:
      'A smaller Watcher bot for partner chats was announced as the next step; the knowledge record does not yet contain delivery evidence.',
  },
  {
    label: 'Unconfirmed',
    title: 'Dedicated arb calculator',
    description:
      'A standalone calculator was mentioned during the 2025 product work, but the record does not clearly establish a finished public release.',
  },
  {
    label: 'Future ops',
    title: 'Automatic VPS billing',
    description:
      'Paying infrastructure costs automatically from treasury remains an operating idea rather than a deployed treasury function.',
  },
]

export function PromisesKeptPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Promises Kept | TempleOS'
    window.scrollTo(0, 0)

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main className={styles.page}>
      <div className={styles.glowField} aria-hidden="true">
        <span className={`${styles.glow} ${styles.glowPink}`} />
        <span className={`${styles.glow} ${styles.glowBlue}`} />
        <span className={`${styles.glow} ${styles.glowCyan}`} />
      </div>

      <div className={styles.pageShell}>
        <section className={styles.hero} aria-labelledby="promises-kept-title">
          <p className={styles.heroEyebrow}>Building the Temple</p>
          <h1 id="promises-kept-title" className={styles.heroTitle}>
            <span className={styles.heroPromise}>Promises kept.</span>
            <span className={styles.heroBrick}>Brick by brick.</span>
          </h1>

          <p className={styles.heroLead}>
            Over more than 18 months, TempleOS grew far beyond its original three-phase roadmap. What began as
            a token launch and a burn-utility idea expanded into the JIT Compiler, Divine Manager automation,
            partner infrastructure, public analytics, education tools and a project-aware AI workflow.
          </p>

          <p className={styles.heroPrinciple}>
            That growth is why I collected the full available Telegram history and organized it here: so
            anyone can follow how the ideas, decisions, experiments and delivered systems built on one another.
          </p>

          <dl className={styles.heroStats} aria-label="Roadmap summary">
            <div>
              <dt>Timeline entries</dt>
              <dd>{roadmapMilestones.length}</dd>
            </div>
            <div>
              <dt>Partner systems</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Manager generations</dt>
              <dd>2</dd>
            </div>
            <div>
              <dt>Continuous building</dt>
              <dd>18 mo.</dd>
            </div>
          </dl>
        </section>

        <section id="original-plan" className={styles.contentSection} aria-labelledby="original-plan-title">
          <header className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Where it started</span>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2 id="original-plan-title">The original roadmap</h2>
                <p>Three simple phases, all carried forward into the system that exists today.</p>
              </div>
              <span className={styles.completePill}>
                <Check size={14} aria-hidden="true" />
                3 / 3 foundations delivered
              </span>
            </div>
          </header>

          <div className={styles.phaseList}>
            {phaseCards.map((phase) => (
              <article className={styles.phaseRow} key={phase.phase}>
                <div className={styles.phaseIdentity}>
                  <span className={styles.phaseNumber}>Phase {phase.phase}</span>
                  <h3>{phase.title}</h3>
                </div>
                <div className={styles.phaseCopy}>
                  <p>
                    <span>Promise</span>
                    {phase.promise}
                  </p>
                  <p>
                    <span>What shipped</span>
                    {phase.delivery}
                  </p>
                </div>
                <span className={styles.phaseStatus}>
                  <Check size={12} aria-hidden="true" />
                  Delivered
                </span>
              </article>
            ))}
          </div>
        </section>

        <section id="promise-themes" className={styles.contentSection} aria-labelledby="promise-themes-title">
          <header className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>The bigger picture</span>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2 id="promise-themes-title">Promise → delivery</h2>
                <p>The roadmap is more than a list of commits. These are the commitments that shaped it.</p>
              </div>
            </div>
          </header>

          <div className={styles.themeList}>
            {promiseThemes.map((theme) => {
              const Icon = theme.icon

              return (
                <article className={`${styles.themeRow} ${styles[`theme${theme.tone}`]}`} key={theme.title}>
                  <div className={styles.themeIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <h3>{theme.title}</h3>
                  <div className={styles.themeCopy}>
                    <p>
                      <span>Promise</span>
                      {theme.promise}
                    </p>
                    <p className={styles.themeDelivery}>
                      <span>Delivered</span>
                      {theme.delivery}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section id="timeline" className={styles.contentSection} aria-labelledby="timeline-title">
          <header className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>The dated record</span>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2 id="timeline-title">Chronological achievement log</h2>
              </div>
            </div>
          </header>

          <div className={styles.eras}>
            {roadmapEras.map((era) => (
              <section className={styles.era} id={era.id} key={era.id}>
                <header className={styles.eraHeader}>
                  <div>
                    <span className={styles.eraPeriod}>{era.period}</span>
                    <h3>{era.title}</h3>
                    <p>{era.description}</p>
                  </div>
                  <span className={styles.eraCount}>{era.milestones.length} entries</span>
                </header>

                <div className={styles.timelineList}>
                  {era.milestones.map((milestone) => (
                    <article className={styles.milestoneRow} key={`${milestone.date}-${milestone.title}`}>
                      <time>{milestone.date}</time>
                      <div className={styles.milestoneCopy}>
                        <h4>{milestone.title}</h4>
                        <p>{milestone.description}</p>
                        <div className={styles.themeTags} aria-label="Milestone themes">
                          {milestone.themes.map((theme) => (
                            <span key={theme}>{theme}</span>
                          ))}
                        </div>
                      </div>
                      <span className={`${styles.statusBadge} ${statusClassNames[milestone.status]}`}>
                        {statusLabels[milestone.status]}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section id="still-building" className={styles.contentSection} aria-labelledby="still-building-title">
          <header className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>No blurred lines</span>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2 id="still-building-title">What is not being called “done”</h2>
                <p>Promises kept only means something when open and declined work is labeled just as clearly.</p>
              </div>
            </div>
          </header>

          <div className={styles.openList}>
            {openItems.map((item) => (
              <article className={styles.openRow} key={item.title}>
                <span className={styles.openLabel}>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.sourceNote}>
          <Code2 size={20} aria-hidden="true" />
          <div>
            <h2>How this record is maintained</h2>
            <p>
              Compiled from public Telegram announcements, the TempleOS knowledge base, deployment handoffs,
              repository history and on-chain receipts through 29 July 2026. Attributed figures remain labeled
              as such, and new evidence is appended instead of silently rewriting the past.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default PromisesKeptPage
