import styles from './DumbMoneyPage.module.css'

const dumbTokenomics = [
  'Total Supply: 28 Billion',
  'Initial Burn: 14 Billion',
  '6% Tax on Buys, Sells, and Transfers',
  '1% Reflections, rewarding holders',
  '2% Buy and Burn of $DUMB',
  '1% Burn of $DUMB',
  '2% Liquidity',
]

const dampTokenomics = [
  'Total Supply: 1 Billion',
  'Initial Burn: 300 Million',
  '3% Tax on Buys, Sells, and Transfers',
  '1% Reflection to holders',
  '1% Buy and Burn of $DUMB',
  '1% Burn of $DAMP',
]

function DumbMoneyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bgGlowOne} />
      <div className={styles.bgGlowTwo} />
      <main className={styles.shell}>
        <section className={`${styles.panel} ${styles.heroPanel}`}>
          <p className={styles.logoText}>DumbMoney.win Logo</p>
          <h1 className={styles.heroTitle}>Welcome to DumbMoney.win</h1>
          <p className={styles.heroLead}>
            DumbMoney.win is a fully decentralized token ecosystem that operates with zero human intervention—just you and the code.
            Built for true decentralization, it has no owner and no admin keys, ensuring that it runs purely on immutable smart
            contracts that cannot be altered.
          </p>
        </section>

        <section className={styles.tokenGrid}>
          <article className={`${styles.panel} ${styles.tokenPanel}`}>
            <h2 className={styles.tokenTitle}>$DUMB Token</h2>
            <p className={styles.tokenLine}>
              A fully decentralized token ecosystem that operates with zero human intervention—just you and the code. $DUMB - The
              Smartest Dumb Money
            </p>
            <p className={styles.tokenLine}>They called it dumb money—so we made it unstoppable. 💰</p>
            <p className={styles.tokenLine}>
              $DUMB is a fully decentralized, self-running token with no admin keys, no rug risks, and all LPs burnt.
            </p>
            <p className={styles.tokenLine}>
              Every trade fuels the ecosystem with reflections, liquidity boosts, and an automated buy &amp; burn. It&apos;s dumb, but it&apos;s
              built different.
            </p>
            <p className={styles.tokenAddress}>
              DumbMoney - $Dumb: 0xe65112d2f120c8cb23ADC80D8E8122c0c8b7fF8D
            </p>

            <div className={styles.tokenomicsSingle}>
              <div className={styles.tokenomicsCard}>
                <h3 className={styles.tokenomicsTitle}>$DUMB Tokenomics</h3>
                <ul className={styles.tokenomicsList}>
                  {dumbTokenomics.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className={`${styles.panel} ${styles.tokenPanel}`}>
            <h2 className={styles.subTokenTitle}>$DAMP - Amplify the Dumbness</h2>
            <p className={styles.tokenLine}>What&apos;s better than dumb money? A dumb amplifier. 📢🚀</p>
            <p className={styles.tokenLine}>
              $DAMP Token serves as a powerful amplifier within the Dumbmoney.win ecosystem. Engineered for impact, it enhances bot
              activity and boosts token volume for both itself and $DUMB.
            </p>
            <p className={styles.tokenLine}>$DAMP exists to supercharge $DUMB with volume, burns, and reflections.</p>
            <p className={styles.tokenLine}>
              With every transaction, it pumps both itself and $DUMB, making sure the ecosystem never stops moving. More trades, more
              burns, more dumb fun.
            </p>
            <p className={styles.tokenAddress}>
              Dumb Amplifier - $Damb: 0x8357aA9070dc7d8d154Da74561CEc58cA30c41C3
            </p>

            <div className={styles.tokenomicsSingle}>
              <div className={styles.tokenomicsCard}>
                <h3 className={styles.tokenomicsTitle}>$DAMP Tokenomics</h3>
                <ul className={styles.tokenomicsList}>
                  {dampTokenomics.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}

export default DumbMoneyPage
