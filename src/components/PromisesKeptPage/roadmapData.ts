export type RoadmapStatus =
  | 'delivered'
  | 'evolving'
  | 'open'
  | 'declined'
  | 'promise'
  | 'founding'

export type RoadmapTheme =
  | 'Launch'
  | 'Product'
  | 'Divine Manager'
  | 'Infrastructure'
  | 'Partnership'
  | 'Community'
  | 'Transparency'

export type Milestone = {
  date: string
  title: string
  description: string
  status: RoadmapStatus
  themes: RoadmapTheme[]
}

export type RoadmapEra = {
  id: string
  period: string
  title: string
  description: string
  milestones: Milestone[]
}

export const statusLabels: Record<RoadmapStatus, string> = {
  delivered: 'Delivered',
  evolving: 'Evolving',
  open: 'In progress',
  declined: 'Declined',
  promise: 'Promise',
  founding: 'Founding promise',
}

export const roadmapEras: RoadmapEra[] = [
  {
    id: 'launch-foundations',
    period: 'Feb – Mar 2025',
    title: 'Launch, proof and early tooling',
    description:
      'The original three-phase roadmap moved from a launch promise into the first working version of the burn engine.',
    milestones: [
      {
        date: '5 Feb 2025',
        title: 'Three-phase roadmap unveiled',
        description:
          'Published the founding plan: bond HolyC, secure its listing and boost, then build a unique passive-burning utility.',
        status: 'founding',
        themes: ['Launch'],
      },
      {
        date: '6 Feb 2025',
        title: 'HolyC successfully bonded',
        description:
          'HolyC completed bonding on pump.tires and migrated to PulseX, fulfilling Phase 0 one day after the roadmap was shared.',
        status: 'delivered',
        themes: ['Launch'],
      },
      {
        date: '6 Feb 2025',
        title: 'Listing and boost activated',
        description:
          'Funded the Dexscreener listing and post-launch marketing boost, including delegating the listing work to a community member when needed.',
        status: 'delivered',
        themes: ['Launch', 'Community'],
      },
      {
        date: '6 Feb 2025',
        title: 'Outside-community partnerships first proposed',
        description:
          'Proposed pairing liquidity with other community tokens—the early idea that eventually became a way to offer automated, recurring value to partner communities.',
        status: 'promise',
        themes: ['Partnership', 'Community'],
      },
      {
        date: '12 Feb 2025',
        title: 'JIT Compiler announced on-chain',
        description:
          'Put the Phase 2 idea on-chain: HolyC/JIT conversion, burn and arbitrage mechanics that let a non-burning reserve asset participate in permanent supply reduction.',
        status: 'delivered',
        themes: ['Product', 'Divine Manager'],
      },
      {
        date: '14 Feb 2025',
        title: 'Manual proof of design',
        description:
          'Ran the first manual HolyC/JIT arbitrage cycles to demonstrate that price divergence could produce value for the burn system.',
        status: 'delivered',
        themes: ['Divine Manager'],
      },
      {
        date: '18–19 Feb 2025',
        title: 'Early automation contract work',
        description:
          'Moved the manual proof toward contract-based automation, forming the bridge between the initial concept and the later manager architecture.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '20 Feb 2025',
        title: 'Website prototype live',
        description:
          'Deployed the first holycpls.vercel.app documentation site, replacing scattered launch information with a dedicated product surface.',
        status: 'delivered',
        themes: ['Product'],
      },
      {
        date: '7 Mar 2025',
        title: 'Arb Guardian development',
        description:
          'Started an off-chain route simulator for the available pools—a precursor to the later scanner and Divine Manager stack.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '7 Mar 2025',
        title: 'TempleOS NotebookLM access',
        description:
          'Invited community members to request access to the project NotebookLM so they could study the system and its history directly.',
        status: 'delivered',
        themes: ['Community'],
      },
      {
        date: '20 Mar 2025',
        title: 'Remix interactive guide released',
        description:
          'Published the “TempleOS – Remix Guide,” giving technical users a practical manual for interacting with the compiler through Remix.',
        status: 'delivered',
        themes: ['Community', 'Product'],
      },
    ],
  },
  {
    id: 'public-product',
    period: 'Jul – Sep 2025',
    title: 'Public dApp and product hardening',
    description:
      'The prototype became a usable dApp while the next generation of automated execution took shape.',
    milestones: [
      {
        date: '11–12 Jul 2025',
        title: 'Compile and Restore dApp launched',
        description:
          'Released the public Compile/Restore interface with on-chain simulation, pool and supply tracking, explainers and an open-source repository.',
        status: 'delivered',
        themes: ['Product'],
      },
      {
        date: '14 Jul 2025',
        title: 'Mobile and read-only access',
        description:
          'Delivered the mobile-friendly view and removed the need to connect a wallet just to inspect the application.',
        status: 'delivered',
        themes: ['Product'],
      },
      {
        date: '8 Aug 2025',
        title: 'Buy-side fee-exemption experiment',
        description:
          'Shipped pool exemptions for JIT/PLS and HolyC/JIT to test more efficient buying. The policy was later reversed after an MEV bypass was found.',
        status: 'evolving',
        themes: ['Product', 'Infrastructure'],
      },
      {
        date: '11 Aug 2025',
        title: 'Brick-by-brick growth stance',
        description:
          'Publicly chose durable product work and honest expectations over unnecessary influencer spending or promises of a “magic 100x.”',
        status: 'delivered',
        themes: ['Transparency', 'Community'],
      },
      {
        date: '22–24 Sep 2025',
        title: 'Guardian and ping architecture',
        description:
          'Designed the permissioned off-chain guardian path that would feed safe opportunities into the automated execution system.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '24 Sep 2025',
        title: 'Divine Manager V1 blueprint',
        description:
          'Shared the architecture for an automated, fee-exempt manager that could capture protocol opportunities before public MEV bots.',
        status: 'delivered',
        themes: ['Divine Manager'],
      },
    ],
  },
  {
    id: 'manager-v1',
    period: 'Nov 2025',
    title: 'Manager V1, the first partner integration and product visibility',
    description:
      'Automation moved on-chain, the website began exposing its work, and the first partner burn system launched.',
    milestones: [
      {
        date: '16 Nov 2025',
        title: 'First automated Manager execution announced',
        description:
          'Divine Manager V1 began scanning and executing. The public first-run report cited roughly 126K HolyC burned; that historical figure remains attributed rather than transaction-reconciled.',
        status: 'delivered',
        themes: ['Divine Manager'],
      },
      {
        date: '18 Nov 2025',
        title: 'Website content overhaul',
        description:
          'Expanded the landing page with tokenomics explainers and Divine Manager tracking so the system was visible instead of remaining “under the hood.”',
        status: 'delivered',
        themes: ['Product', 'Transparency'],
      },
      {
        date: '18 Nov 2025',
        title: 'Official @HolyCpls X page launched',
        description:
          'Opened a dedicated public channel for TempleOS product updates, ecosystem explanations and the project’s longer-form operating story.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '19 Nov 2025',
        title: 'Divine Manager guide rewritten',
        description:
          'Rebuilt the Manager guide around simpler onboarding so users could understand what the automation does and why it matters.',
        status: 'delivered',
        themes: ['Community', 'Product'],
      },
      {
        date: '21 Nov 2025',
        title: 'Briah partnership',
        description:
          'Launched the first outside-community integration: liquidity plus automated buy-and-burn routing that gives Briah recurring value from the TempleOS engine. Briah remains present in later V2 execution receipts.',
        status: 'delivered',
        themes: ['Partnership', 'Divine Manager'],
      },
      {
        date: '25 Nov 2025',
        title: 'JIT fee policy hardened',
        description:
          'Patched a path used by MEV bots to bypass JIT fees and re-enabled buy-side taxes to reinforce the deflationary design.',
        status: 'delivered',
        themes: ['Product', 'Infrastructure'],
      },
      {
        date: '25 Nov 2025',
        title: 'JIT burn volume meter',
        description:
          'Added a real-time website meter for JIT burn volume, while clearly separating wrapper burn volume from HolyC permanently removed.',
        status: 'delivered',
        themes: ['Product', 'Transparency'],
      },
    ],
  },
  {
    id: 'partners-and-ops',
    period: 'Jan – Mar 2026',
    title: 'Watcher, partners and 24/7 operations',
    description:
      'The ecosystem widened from one partner to three while the execution stack became faster, more persistent and more aggressive.',
    milestones: [
      {
        date: '31 Jan 2026',
        title: '@DivineWatcher_Bot live',
        description:
          'Launched a Telegram bot that publishes execution updates and rolling 24-hour supply snapshots, removing the need for manual reporting.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '1 Feb 2026',
        title: 'CoinMafia integration',
        description:
          'Deployed the contracts and liquidity path needed to add CoinMafia to automated partner buy-and-burn distribution.',
        status: 'delivered',
        themes: ['Partnership', 'Divine Manager'],
      },
      {
        date: '4–5 Mar 2026',
        title: 'DumbMoney integration',
        description:
          'Finalized the DumbMoney partnership, brought its buy-and-burn path on-chain and built a dedicated dashboard on the TempleOS domain.',
        status: 'delivered',
        themes: ['Partnership', 'Product'],
      },
      {
        date: '5–7 Mar 2026',
        title: 'HolyC LP wrapper built and tested',
        description:
          'Built and tested a 0-IL-style, fee-exempt liquidity wrapper. It was not confirmed as a public dApp and remains an open product direction.',
        status: 'open',
        themes: ['Product', 'Infrastructure'],
      },
      {
        date: '6 Mar 2026',
        title: 'Focused X arbitrage reporting',
        description:
          'Started a narrower public reporting format for individual arbitrages, keeping the main feed useful without turning every execution into noise.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '6–10 Mar 2026',
        title: 'Guides and HolyC removal tracker',
        description:
          'Published two optimized website guides plus a HolyC removal tracker with a seven-day annualized calculator.',
        status: 'delivered',
        themes: ['Product', 'Community'],
      },
      {
        date: '11–19 Mar 2026',
        title: 'Feeder and per-block evolution',
        description:
          'Introduced a 24/7 micro-edge Feeder role, tuned the balance between an overly conservative Manager and an overly aggressive scanner, and expanded the active path set from two to six.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '13 Mar 2026',
        title: '24/7 VPS deployment',
        description:
          'Moved scanning to a dedicated server so opportunities could be evaluated continuously and acted on at the first viable moment.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '18–19 Mar 2026',
        title: 'Weapon 1 delivered: Sharper Eyes',
        description:
          'Hardened scanner logic and publicly reported Weapon 1 live, improving the system’s ability to see and capture small opportunities.',
        status: 'delivered',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '19 Mar 2026',
        title: 'Weapon 2 mapped: Atomic Lockout',
        description:
          'Outlined the next protection layer: an AOT Relayer that would keep fee exemptions inside one atomic execution and make copied opportunities harder to reproduce. It was implemented and delivered in July.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '19 Mar 2026',
        title: 'Weapon 3 deliberately declined',
        description:
          'Chose not to deploy the proposed “nuclear fee shield” after judging its unintended consequences more dangerous than its potential benefit.',
        status: 'declined',
        themes: ['Transparency', 'Infrastructure'],
      },
    ],
  },
  {
    id: 'reliability-and-scale',
    period: 'Apr – Jun 2026',
    title: 'Reliability, accounting and route scale',
    description:
      'The focus shifted from simply finding opportunities to proving that they were genuinely profitable, explainable and repeatable.',
    milestones: [
      {
        date: '20 Apr – 11 May 2026',
        title: 'Community model and indexer explainers',
        description:
          'Published liquidity and dashboard explanations, clarified indexer behavior and corrected the misconception that JIT transfer tax funds the treasury.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '10 Jun 2026',
        title: 'Same-block retry logic',
        description:
          'Added retries for transient preflight failures such as RPC timeouts, allowing the Manager to recover inside the same block instead of missing the opportunity.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '11 Jun 2026',
        title: 'Durable forensics suite',
        description:
          'Started recording “silent denials”—the exact reasons potential trades were rejected—so policy and governance could be refined from evidence.',
        status: 'delivered',
        themes: ['Infrastructure', 'Transparency'],
      },
      {
        date: '14 Jun 2026',
        title: 'Whole-inventory mark-to-market guard',
        description:
          'Added portfolio-wide accounting that rejects trades which look profitable in one token but lose total value across the Manager’s inventory.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '14–19 Jun 2026',
        title: 'Route expansion, discovery and visualization',
        description:
          'Reported 18 paths, automatic pool discovery and beta per-arbitrage route visualization. The 18-path count belongs to this June work, not the later V2 cutover.',
        status: 'delivered',
        themes: ['Divine Manager', 'Product'],
      },
    ],
  },
  {
    id: 'manager-v2',
    period: 'Jul 2026',
    title: 'V2 cutover, public receipts and the next operating layer',
    description:
      'A dense month of guards, adapters, partner expansion, public analytics and independently checkable V2 execution evidence.',
    milestones: [
      {
        date: '6 Jul 2026',
        title: 'WPLS cycle turned into an accounting lesson',
        description:
          'A live cycle finished net-negative after the historical partner split and gas, giving the later net-edge and accounting guards a concrete failure case to eliminate.',
        status: 'delivered',
        themes: ['Transparency', 'Divine Manager'],
      },
      {
        date: '8 Jul 2026',
        title: 'Learned token fee registry',
        description:
          'Implemented a default-enabled, keyless background probe that learns unknown transfer fees and quarantines unsupported routes. The exact VPS revision remains a runtime verification item.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '10 Jul 2026',
        title: 'Weapon 2 reaches fork-test stage',
        description:
          'Implemented the AOT Relayer promised in March and completed fork testing. Weapon 2 was now technically ready, but had not yet been integrated into production.',
        status: 'evolving',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '23 Jul 2026',
        title: 'Mixed PulseX router adapter',
        description:
          'Deployed an immutable adapter that can route PulseX V1 and V2 legs inside one atomic transaction.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '23 Jul 2026',
        title: 'Weapon 2 delivered: AOT Relayer V2',
        description:
          'Integrated AOT Relayer V2 into the live Manager stack, delivering the Atomic Lockout design through bounded fee exemptions and competitor-reproduction resistance.',
        status: 'delivered',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '23 Jul 2026',
        title: 'Divine Manager V2 cutover',
        description:
          'Moved production to the more efficient V2 Manager. The cutover audit records 10.061M HolyC, 9.580M JIT and 1M WPLS migrated; these are audit figures, not fresh chain totals.',
        status: 'delivered',
        themes: ['Divine Manager', 'Infrastructure'],
      },
      {
        date: '23 Jul 2026',
        title: 'FUPA integration',
        description:
          'Deployed the FUPA buy-and-burn contract as the fourth major partner, with its burner deployment and later execution receipt confirmed.',
        status: 'delivered',
        themes: ['Partnership', 'Divine Manager'],
      },
      {
        date: '24 Jul 2026',
        title: 'Gas-aware net-edge guard',
        description:
          'Finalized the affordability check so the bot only executes when expected profit strictly exceeds the real gas cost.',
        status: 'delivered',
        themes: ['Infrastructure', 'Divine Manager'],
      },
      {
        date: '25 Jul 2026',
        title: 'Automated arb reconstruction',
        description:
          'Added a website card that deep-queries on-chain events and reconstructs the steps of an arbitrage for users. The matching product code exists in repository history; the live Vercel deploy was not independently captured.',
        status: 'delivered',
        themes: ['Product', 'Transparency'],
      },
      {
        date: '25 Jul 2026',
        title: 'V2 production posture recorded',
        description:
          'Captured the live configuration: Divine Manager V2, mixed PulseX adapter, active AOT exemption, loops off and a 50% V2 distribution split.',
        status: 'delivered',
        themes: ['Divine Manager', 'Transparency'],
      },
      {
        date: '26 Jul 2026',
        title: 'Live analytics and performance overhaul',
        description:
          'Announced the Manager liquidity modal, more accurate flow summaries, partner buy-and-burn archive and a faster live feed backed by hourly GitHub history. Matching product code is present in repository history.',
        status: 'delivered',
        themes: ['Product', 'Transparency'],
      },
      {
        date: '26 Jul 2026',
        title: 'Promises-kept AI log shared',
        description:
          'Published an AI-assisted summary of the project’s promises and deliveries, creating the starting point for this fuller public roadmap.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '26 Jul 2026',
        title: 'Founder JIT liquidity support offered',
        description:
          'Offered fee-exempt HolyC-to-JIT conversion help for interested liquidity providers, warned against supplying JIT alone unintentionally and restated that the main HolyC/WPLS LP remains locked.',
        status: 'evolving',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '27 Jul 2026',
        title: 'V2/AOT execution verified on-chain',
        description:
          'A successful receipt confirmed the full bot → AOT Relayer V2 → Manager V2 → mixed adapter path, all four partner recipients and the HolyC burn in one execution.',
        status: 'delivered',
        themes: ['Divine Manager', 'Partnership'],
      },
      {
        date: '27 Jul 2026',
        title: 'Watcher arb batching live',
        description:
          'The notifier grouped three RPC-verified successful arbitrages into one Telegram report, with batching support reported up to ten executions.',
        status: 'delivered',
        themes: ['Community', 'Infrastructure'],
      },
      {
        date: '25–27 Jul 2026',
        title: 'Partner history and activity views refined',
        description:
          'Repository work added partner buy-and-burn history, liquidity coverage, faster history preload, V2 flow decoding, Manager activity and DumbMoney UI refinements.',
        status: 'delivered',
        themes: ['Product', 'Partnership'],
      },
      {
        date: '28 Jul 2026',
        title: 'First TempleOS Scribe posts live',
        description:
          'Published the first @HolyCpls post through the TempleOS Scribe workflow, followed by a second live dashboard feature post. Manual review and feedback are live; full automation remains a future goal.',
        status: 'delivered',
        themes: ['Community', 'Transparency'],
      },
      {
        date: '29 Jul 2026',
        title: 'Promises-kept roadmap completed',
        description:
          'Turned the collected Telegram history and achievement log into this public, navigable record—closing the website-roadmap promise made on 26 July.',
        status: 'delivered',
        themes: ['Product', 'Transparency'],
      },
    ],
  },
]

export const roadmapMilestones = roadmapEras.flatMap((era) => era.milestones)
