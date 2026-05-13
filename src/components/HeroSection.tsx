import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './HeroSection.module.css'

interface Props {
  lang: Lang
}

export default function HeroSection({ lang }: Props) {
  const t = useT(lang)

  return (
    <section className={styles.hero}>
      <motion.div
        className={styles.inner}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className={styles.title}>{t('hero_title')}</h1>
        <p className={styles.line}>{t('hero_line')}</p>
        <button type="button" className={styles.link} onClick={() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {t('hero_to_workspace')}
          <ChevronDown size={16} strokeWidth={2} aria-hidden />
        </button>
      </motion.div>
    </section>
  )
}
