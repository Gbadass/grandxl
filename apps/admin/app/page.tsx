'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from 'framer-motion'
import { useAuthStore } from '../src/store/auth.store'
import { UserRole } from '@grandxl/types'

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
  }),
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

// ── Animated count ────────────────────────────────────────────────────────────

function AnimatedCount({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref    = useRef<HTMLSpanElement>(null)
  const count  = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString())
  const inView  = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    const ctrl = animate(count, to, { duration: 1.8, ease: 'easeOut' })
    return ctrl.stop
  }, [inView, count, to])

  return (
    <span ref={ref}>
      <motion.span>{rounded}</motion.span>{suffix}
    </span>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({ size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14' : 'h-10'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="GrandXL" className={`${h} w-auto object-contain`} />
  )
}

// ── App store badges ──────────────────────────────────────────────────────────

function AppStoreBadge({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const base = variant === 'dark'
    ? 'border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800'
    : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
  return (
    <a
      href="#"
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 transition ${base}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <div className="text-left">
        <p className="text-[9px] leading-none opacity-70">Download on the</p>
        <p className="text-xs font-semibold leading-tight">App Store</p>
      </div>
    </a>
  )
}

function PlayStoreBadge({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const base = variant === 'dark'
    ? 'border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800'
    : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
  return (
    <a
      href="#"
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 transition ${base}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-green-400">
        <path d="M3.18 23.76c.3.17.64.24.99.19L14.9 12 3.18.05a1.07 1.07 0 00-.99.19C1.79.6 1.5 1.1 1.5 1.72v20.56c0 .62.29 1.12.8 1.48l-.12-.07zM16.54 13.42l2.79-2.79-12.24-7.01 9.45 9.8zM22.49 10.8l-3.17-1.82-3.14 3.14 3.14 3.14 3.2-1.84c.91-.52.91-2.1-.03-2.62zM7.09 21.38l12.24-7.01-2.79-2.79-9.45 9.8z" />
      </svg>
      <div className="text-left">
        <p className="text-[9px] leading-none opacity-70">Get it on</p>
        <p className="text-xs font-semibold leading-tight">Google Play</p>
      </div>
    </a>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-sm' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/">
          <Logo dark={scrolled} />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {[
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Cities',       href: '#cities'       },
            { label: 'Why GrandXL',  href: '#why-grandxl'  },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className={`text-sm font-medium transition hover:text-orange-600 ${
                scrolled ? 'text-gray-600' : 'text-white/80'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'
            }`}
          >
            Log in
          </Link>
          <Link href="/auth/register">
            <motion.span
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              List your restaurant
            </motion.span>
          </Link>
        </div>
      </nav>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1920&q=80'

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* Background food photo */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      />
      {/* Gradient overlay: heavy on left, fades right so photo shows */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
      {/* Bottom fade to white for smooth transition */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white to-transparent" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-28">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-2xl"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-orange-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
              Now serving Benue — expanding across Nigeria
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            custom={1}
            className="mt-6 text-5xl font-extrabold leading-[1.07] tracking-tight text-white md:text-6xl lg:text-[72px]"
          >
            Grow your restaurant with{' '}
            <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
              GrandXL
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-5 max-w-lg text-lg leading-relaxed text-white/70"
          >
            Join GrandXL in Benue and reach thousands of hungry customers.
            We handle the delivery — you focus on the food.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} custom={3} className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/auth/register">
              <motion.span
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-orange-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-orange-600/30 transition hover:bg-orange-500"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                List your restaurant
                <ArrowRight />
              </motion.span>
            </Link>
            <motion.a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/10"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              See how it works
            </motion.a>
          </motion.div>

          {/* App store badges */}
          <motion.div variants={fadeUp} custom={4} className="mt-8 flex flex-wrap items-center gap-3">
            <p className="text-xs text-white/40">Customer app available on:</p>
            <AppStoreBadge variant="dark" />
            <PlayStoreBadge variant="dark" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ── Bento grid section ────────────────────────────────────────────────────────

function BentoGrid() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2"
        >
          {/* ── Card 1: Restaurant partner (tall, spans 2 rows) ─────────────── */}
          <motion.div
            variants={fadeUp}
            custom={0}
            whileHover="hover"
            className="group relative flex min-h-[340px] flex-col overflow-hidden rounded-3xl bg-orange-600 p-8 text-white lg:row-span-2 lg:min-h-0"
          >
            {/* Radial glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,200,100,0.35),_transparent_60%)]" />

            {/* Illustration — restaurant storefront */}
            <motion.div
              variants={{ hover: { y: -6, scale: 1.03 } }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="relative mb-auto flex items-center justify-center pt-4"
            >
              <svg viewBox="0 0 200 180" fill="none" className="h-52 w-52 drop-shadow-2xl">
                {/* Building base */}
                <rect x="30" y="80" width="140" height="90" rx="6" fill="rgba(255,255,255,0.15)" />
                <rect x="30" y="80" width="140" height="90" rx="6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                {/* Awning */}
                <path d="M20 80 Q100 55 180 80" fill="rgba(255,255,255,0.25)" />
                <path d="M20 80 Q100 55 180 80" stroke="white" strokeWidth="2" />
                {/* Sign board */}
                <rect x="55" y="62" width="90" height="22" rx="4" fill="white" fillOpacity="0.9" />
                <rect x="65" y="68" width="30" height="4" rx="2" fill="#ea580c" />
                <rect x="100" y="68" width="35" height="4" rx="2" fill="#ea580c" opacity="0.5" />
                {/* Door */}
                <rect x="82" y="120" width="36" height="50" rx="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                <circle cx="113" cy="146" r="3" fill="white" fillOpacity="0.8" />
                {/* Windows */}
                <rect x="42" y="100" width="28" height="22" rx="3" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <rect x="130" y="100" width="28" height="22" rx="3" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                {/* Window cross */}
                <line x1="56" y1="100" x2="56" y2="122" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                <line x1="42" y1="111" x2="70" y2="111" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                <line x1="144" y1="100" x2="144" y2="122" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                <line x1="130" y1="111" x2="158" y2="111" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                {/* Stars / sparkle */}
                <circle cx="165" cy="42" r="3" fill="white" fillOpacity="0.7" />
                <circle cx="155" cy="30" r="2" fill="white" fillOpacity="0.5" />
                <circle cx="175" cy="28" r="1.5" fill="white" fillOpacity="0.4" />
                {/* Smoke / steam from chimney */}
                <path d="M95 58 Q92 48 96 40 Q100 32 97 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity="0.4" />
                <path d="M105 58 Q108 46 104 38 Q100 30 103 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity="0.3" />
              </svg>
            </motion.div>

            {/* Text */}
            <div className="relative mt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-200">For restaurants</p>
              <h3 className="mt-2 text-2xl font-extrabold leading-tight">Your restaurant, on GrandXL</h3>
              <p className="mt-2 text-sm leading-relaxed text-orange-100">
                List your restaurant and reach hungry customers in your city. We handle logistics — you handle the cooking.
              </p>
              <Link href="/auth/register">
                <motion.span
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-orange-600 transition hover:bg-orange-50"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  List your restaurant <ArrowRight className="h-3.5 w-3.5" />
                </motion.span>
              </Link>
            </div>
          </motion.div>

          {/* ── Card 2: Order food (dark, wide) ─────────────────────────────── */}
          <motion.div
            variants={fadeUp}
            custom={1}
            whileHover="hover"
            className="group relative flex min-h-[260px] overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white lg:col-span-2"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(251,146,60,0.15),_transparent_60%)]" />

            {/* Text left */}
            <div className="relative z-10 flex max-w-xs flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">For customers</p>
                <h3 className="mt-2 text-2xl font-extrabold leading-tight">Order food you love</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Discover the best restaurants near you and get hot meals delivered fast.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                Download the app — coming soon
              </div>
            </div>

            {/* Illustration — phone with food */}
            <motion.div
              variants={{ hover: { x: -6, rotate: -2 } }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute -right-4 -bottom-4 opacity-80"
            >
              <svg viewBox="0 0 160 200" fill="none" className="h-52 w-40">
                {/* Phone body */}
                <rect x="20" y="10" width="100" height="175" rx="18" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
                <rect x="28" y="26" width="84" height="130" rx="6" fill="#18181b" />
                {/* Screen content - food card */}
                <rect x="34" y="34" width="72" height="50" rx="5" fill="#ea580c" opacity="0.9" />
                <rect x="34" y="34" width="72" height="50" rx="5" fill="url(#foodGrad)" />
                {/* Food circles on screen */}
                <circle cx="55" cy="56" r="14" fill="rgba(255,255,255,0.15)" />
                <circle cx="55" cy="56" r="10" fill="rgba(255,255,255,0.2)" />
                <circle cx="80" cy="52" r="10" fill="rgba(255,255,255,0.12)" />
                <circle cx="95" cy="58" r="8" fill="rgba(255,255,255,0.1)" />
                {/* App UI rows */}
                <rect x="34" y="92" width="72" height="8" rx="3" fill="#3f3f46" />
                <rect x="34" y="106" width="50" height="6" rx="3" fill="#3f3f46" opacity="0.6" />
                <rect x="34" y="118" width="72" height="20" rx="4" fill="#ea580c" opacity="0.8" />
                <rect x="46" y="124" width="48" height="4" rx="2" fill="white" opacity="0.9" />
                {/* Home indicator */}
                <rect x="55" y="170" width="30" height="3" rx="2" fill="#52525b" />
                <defs>
                  <linearGradient id="foodGrad" x1="34" y1="34" x2="106" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f97316" />
                    <stop offset="1" stopColor="#c2410c" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </motion.div>

          {/* ── Card 3: Rider (teal/green, wide) ────────────────────────────── */}
          <motion.div
            variants={fadeUp}
            custom={2}
            whileHover="hover"
            className="group relative flex min-h-[260px] overflow-hidden rounded-3xl bg-emerald-600 p-8 text-white lg:col-span-2"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_55%)]" />

            {/* Text left */}
            <div className="relative z-10 flex max-w-xs flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">For riders</p>
                <h3 className="mt-2 text-2xl font-extrabold leading-tight">Deliver and earn daily</h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100">
                  Ride on your own schedule. Flexible hours, competitive pay, and weekly payouts to your account.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-white/10 px-4 py-2 text-xs font-semibold text-emerald-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Rider signup opening soon
              </div>
            </div>

            {/* Illustration — delivery scooter */}
            <motion.div
              variants={{ hover: { x: -8 } }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute -right-2 bottom-0 opacity-90"
            >
              <svg viewBox="0 0 200 160" fill="none" className="h-44 w-52">
                {/* Rider */}
                <circle cx="110" cy="38" r="16" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                <path d="M94 55 Q110 48 126 55 L130 90 H90 Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                {/* Helmet */}
                <path d="M96 36 Q110 18 124 36" fill="rgba(255,255,255,0.3)" />
                {/* Delivery box on back */}
                <rect x="62" y="55" width="34" height="28" rx="4" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                <path d="M62 68 H96" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
                <rect x="70" y="59" width="18" height="4" rx="2" fill="white" fillOpacity="0.6" />
                {/* Scooter body */}
                <path d="M40 110 Q60 95 90 90 L130 90 Q150 90 160 100 L168 110" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M90 90 L85 110" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M130 90 L135 110" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Handlebars */}
                <path d="M126 72 L134 90" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="118" y1="72" x2="144" y2="72" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Wheels */}
                <circle cx="75" cy="120" r="20" stroke="rgba(255,255,255,0.6)" strokeWidth="3" fill="rgba(255,255,255,0.08)" />
                <circle cx="75" cy="120" r="8" fill="rgba(255,255,255,0.2)" />
                <circle cx="150" cy="120" r="20" stroke="rgba(255,255,255,0.6)" strokeWidth="3" fill="rgba(255,255,255,0.08)" />
                <circle cx="150" cy="120" r="8" fill="rgba(255,255,255,0.2)" />
                {/* Speed lines */}
                <line x1="18" y1="95" x2="38" y2="95" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                <line x1="10" y1="105" x2="35" y2="105" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
                <line x1="20" y1="115" x2="40" y2="115" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ── Stats (Zomato pill/card style) ───────────────────────────────────────────

const STATS = [
  { value: 180, suffix: '+', label: 'Restaurant partners' },
  { value: 50,  suffix: 'k+', label: 'Happy customers'   },
  { value: 1,   suffix: '',  label: 'City (Benue)'         },
  { value: 98,  suffix: '%', label: 'On-time delivery'    },
]

function Stats() {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm"
        >
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 md:grid-cols-4 md:divide-y-0">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="flex flex-col items-center justify-center gap-1 py-10 px-6 text-center"
              >
                <p className="text-4xl font-extrabold tabular-nums text-gray-900 md:text-5xl">
                  <AnimatedCount to={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-medium text-gray-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-4 text-center text-xs font-medium text-gray-400"
        >
          Trusted by restaurants across Nigeria · Growing every day
        </motion.p>
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    n: '01',
    title: 'Sign up in 5 minutes',
    desc: 'Fill in your restaurant name, cuisine, location, and hours. No paperwork, no phone calls required.',
    bg: 'bg-orange-100',
    iconBg: 'bg-orange-200',
    numColor: 'text-orange-400',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-16 w-16">
        {/* Document */}
        <rect x="18" y="10" width="44" height="56" rx="5" fill="#ea580c" fillOpacity="0.15" stroke="#ea580c" strokeWidth="2" />
        <rect x="24" y="22" width="32" height="3" rx="1.5" fill="#ea580c" fillOpacity="0.6" />
        <rect x="24" y="31" width="24" height="3" rx="1.5" fill="#ea580c" fillOpacity="0.4" />
        <rect x="24" y="40" width="28" height="3" rx="1.5" fill="#ea580c" fillOpacity="0.4" />
        {/* Pen */}
        <rect x="44" y="48" width="6" height="18" rx="2" transform="rotate(-35 44 48)" fill="#ea580c" />
        <path d="M54 58 L58 68 L50 65 Z" fill="#ea580c" />
        <rect x="41" y="48" width="6" height="5" rx="1" transform="rotate(-35 41 48)" fill="#ea580c" fillOpacity="0.4" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Get verified in 24h',
    desc: 'A real person reviews every application within 24 hours. We are invested in your success from day one.',
    bg: 'bg-orange-400',
    iconBg: 'bg-orange-500',
    numColor: 'text-orange-200',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-16 w-16">
        {/* Shield */}
        <path d="M40 12 L62 22 L62 42 C62 54 52 63 40 68 C28 63 18 54 18 42 L18 22 Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="2" />
        {/* Check */}
        <path d="M29 40 L37 48 L52 32" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Star sparkles */}
        <circle cx="65" cy="18" r="3" fill="white" fillOpacity="0.6" />
        <circle cx="15" cy="22" r="2" fill="white" fillOpacity="0.4" />
        <circle cx="68" cy="30" r="1.5" fill="white" fillOpacity="0.5" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Start earning',
    desc: 'Accept orders live on your dashboard, track every delivery, and receive weekly payouts. Zero commission in beta.',
    bg: 'bg-orange-600',
    iconBg: 'bg-orange-700',
    numColor: 'text-orange-300',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-16 w-16">
        {/* Coin stack */}
        <ellipse cx="40" cy="60" rx="20" ry="6" fill="white" fillOpacity="0.2" />
        <rect x="20" y="50" width="40" height="10" rx="5" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
        <ellipse cx="40" cy="50" rx="20" ry="6" fill="white" fillOpacity="0.3" />
        <rect x="20" y="40" width="40" height="10" rx="5" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.5" />
        <ellipse cx="40" cy="40" rx="20" ry="6" fill="white" fillOpacity="0.4" />
        <rect x="20" y="30" width="40" height="10" rx="5" fill="white" fillOpacity="0.35" stroke="white" strokeWidth="1.5" />
        <ellipse cx="40" cy="30" rx="20" ry="6" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="1.5" />
        <text x="40" y="34" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" fillOpacity="0.9">₦</text>
        {/* Arrow up */}
        <path d="M58 22 L58 10 M58 10 L53 15 M58 10 L63 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const lineProgress = useMotionValue(0)

  useEffect(() => {
    if (!inView) return
    animate(lineProgress, 1, { duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 })
  }, [inView, lineProgress])

  const scaleX = useTransform(lineProgress, [0, 1], [0, 1])

  return (
    <section id="how-it-works" className="overflow-hidden bg-white py-28">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-20 text-center"
        >
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-widest text-orange-600">
            How it works
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Live in 3 steps
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="mt-4 text-lg text-gray-500">
            No technical knowledge needed. Sign up and start selling today.
          </motion.p>
        </motion.div>

        {/* Process flow */}
        <div ref={ref} className="relative">
          {/* Animated connecting line (desktop) */}
          <div className="absolute left-[calc(16.67%)] right-[calc(16.67%)] top-16 hidden h-0.5 origin-left overflow-hidden bg-gray-100 md:block">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-300 via-orange-500 to-orange-600"
              style={{ scaleX, transformOrigin: 'left' }}
            />
          </div>

          <div className="grid gap-12 md:grid-cols-3 md:gap-6">
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.18 }}
                className="flex flex-col items-center text-center"
              >
                {/* Circle node */}
                <motion.div
                  whileHover={{ scale: 1.08, rotate: -3 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`relative flex h-32 w-32 items-center justify-center rounded-full shadow-xl ${step.bg}`}
                >
                  {step.illustration}
                  {/* Step number badge */}
                  <span className={`absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black shadow-md ${step.numColor.replace('text-', 'text-')}`} style={{ color: 'inherit' }}>
                    <span className="text-[11px] font-black text-gray-700">{step.n}</span>
                  </span>
                </motion.div>

                {/* Text */}
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <Link href="/auth/register">
            <motion.span
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-orange-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-500"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Get started — it's free
              <ArrowRight />
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// ── Cities ────────────────────────────────────────────────────────────────────

const CITIES = [
  { name: 'Benue',         active: true  },
  { name: 'Lagos',         active: false },
  { name: 'Abuja',         active: false },
  { name: 'Port Harcourt', active: false },
  { name: 'Ibadan',        active: false },
  { name: 'Kano',          active: false },
  { name: 'Enugu',         active: false },
  { name: 'Benin City',    active: false },
]

function Cities() {
  return (
    <section id="cities" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12 text-center"
        >
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-widest text-orange-600">
            Our cities
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900">
            Available across Nigeria
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="mt-3 text-gray-500">
            We are live in Benue and expanding to more cities soon.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-3"
        >
          {CITIES.map((city, i) => (
            <motion.div
              key={city.name}
              variants={fadeUp}
              custom={i}
              whileHover={{ scale: 1.04 }}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                city.active
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'bg-gray-100 text-gray-400 border border-transparent'
              }`}
            >
              {city.active ? (
                <span className="h-2 w-2 rounded-full bg-orange-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-gray-300" />
              )}
              {city.name}
              {!city.active && <span className="text-xs font-normal">(soon)</span>}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ── Why GrandXL ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    n: '01',
    title: 'Fast 24-hour approval',
    tag: 'Speed',
    desc: 'Every application reviewed by a real person within 24 hours. No automated waitlists — you talk to humans.',
    accent: 'from-orange-500 to-orange-600',
    tagColor: 'bg-orange-500/10 text-orange-400',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Zero commission in beta',
    tag: 'Revenue',
    desc: "Keep every kobo you earn. We'll give you 30 days notice before our commission ever changes. Your growth funds itself.",
    accent: 'from-emerald-500 to-emerald-600',
    tagColor: 'bg-emerald-500/10 text-emerald-400',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Real-time order dashboard',
    tag: 'Operations',
    desc: 'Orders hit your dashboard the instant they are placed. Accept, update, and track every delivery in one click.',
    accent: 'from-blue-500 to-blue-600',
    tagColor: 'bg-blue-500/10 text-blue-400',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Dedicated partner support',
    tag: 'Support',
    desc: 'WhatsApp and email support seven days a week. A real team that knows your restaurant and is invested in your success.',
    accent: 'from-purple-500 to-purple-600',
    tagColor: 'bg-purple-500/10 text-purple-400',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
]

function FeatureRow({ f, i }: { f: typeof FEATURES[number]; i: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rowRef, { once: true, margin: '-60px' })
  const barProgress = useMotionValue(0)
  const scaleX = useTransform(barProgress, [0, 1], [0, 1])

  useEffect(() => {
    if (!inView) return
    animate(barProgress, 1, { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 })
  }, [inView, barProgress])

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
      className="group relative -mx-6 cursor-default overflow-hidden px-6 py-8 transition-colors duration-300 hover:bg-white/[0.03] md:-mx-10 md:px-10"
    >
      {/* Animated fill bar at bottom of each row */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-800">
        <motion.div
          className={`h-full bg-gradient-to-r ${f.accent}`}
          style={{ scaleX, transformOrigin: 'left' }}
        />
      </div>

      {/* Left accent line on hover */}
      <div className={`absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b ${f.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      <div className="flex items-center gap-6 md:gap-10">
        {/* Number */}
        <span className="w-14 shrink-0 font-mono text-5xl font-black text-zinc-800 transition-colors duration-300 group-hover:text-zinc-700 md:text-6xl">
          {f.n}
        </span>

        {/* Divider */}
        <div className="hidden h-14 w-px shrink-0 bg-zinc-800 md:block" />

        {/* Tag + Title + Desc */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${f.tagColor}`}>
              {f.tag}
            </span>
          </div>
          <h3 className="mt-1.5 text-xl font-extrabold text-white transition-colors duration-300 group-hover:text-orange-50 md:text-2xl">
            {f.title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500 transition-colors duration-300 group-hover:text-zinc-400">
            {f.desc}
          </p>
        </div>

        {/* Icon */}
        <div className={`hidden shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-600 transition-all duration-300 group-hover:border-zinc-700 group-hover:text-white md:flex`}>
          <motion.div
            animate={inView ? { rotate: [0, -8, 0] } : {}}
            transition={{ duration: 0.6, delay: i * 0.1 + 0.3 }}
          >
            {f.icon}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function WhyGrandXL() {
  return (
    <section id="why-grandxl" className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        {/* Header */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-widest text-orange-500">
              Why GrandXL
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl"
            >
              Everything your restaurant<br className="hidden md:block" /> needs to thrive
            </motion.h2>
          </div>
          <motion.p variants={fadeUp} custom={2} className="max-w-xs text-sm text-zinc-500">
            Built specifically for Nigerian restaurants — from suya spots to fine dining.
          </motion.p>
        </motion.div>

        {/* Divider */}
        <div className="mb-2 h-px bg-zinc-800" />

        {/* Feature rows */}
        <div>
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.n} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────

const TRUST_POINTS = [
  'Live on the platform within 24 hours',
  'Zero commission during our beta period',
  'Real human support, 7 days a week',
  'Weekly payouts directly to your account',
]

function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-zinc-950 py-32">
      {/* Decorative background letterform */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none text-[320px] font-black leading-none text-white opacity-[0.025] md:text-[420px]"
      >
        XL
      </div>

      {/* Subtle top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 lg:items-center">

          {/* Left — headline + primary CTA */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <div className="h-px w-8 bg-orange-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-orange-500">
                Ready to partner?
              </p>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-5 text-5xl font-extrabold leading-[1.06] tracking-tight text-white md:text-6xl"
            >
              Your restaurant.<br />
              Your customers.<br />
              <span className="text-orange-500">Our delivery.</span>
            </motion.h2>

            <motion.p variants={fadeUp} custom={2} className="mt-6 text-base leading-relaxed text-zinc-500">
              GrandXL gets your food to more tables. Free to sign up, no technical skills needed, live in 24 hours.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10">
              <Link href="/auth/register">
                <motion.span
                  className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-orange-600 px-8 py-4 text-sm font-bold text-white shadow-2xl shadow-orange-600/20 transition hover:bg-orange-500"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  List your restaurant — it's free
                  <ArrowRight />
                </motion.span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right — trust signals + secondary CTA */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            {/* Trust points */}
            <div className="space-y-4">
              {TRUST_POINTS.map((point, i) => (
                <motion.div
                  key={point}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.25 + i * 0.08 }}
                  className="flex items-start gap-4"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-600/15">
                    <svg className="h-3 w-3 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  <p className="text-sm text-zinc-400">{point}</p>
                </motion.div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-zinc-800" />

            {/* Secondary — already a partner */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-600">Already a partner?</p>
                <p className="mt-0.5 text-xs text-zinc-700">Access your restaurant dashboard</p>
              </div>
              <Link href="/auth/login">
                <motion.span
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Sign in <ArrowRight className="h-3.5 w-3.5" />
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const NAV = [
    { label: 'How it works',     href: '#how-it-works'              },
    { label: 'Why GrandXL',      href: '#why-grandxl'               },
    { label: 'Our cities',       href: '#cities'                    },
    { label: 'For restaurants',  href: '/auth/register'             },
    { label: 'Sign in',          href: '/auth/login'                },
    { label: 'Contact us',       href: 'mailto:hello@grandxl.com'   },
    { label: 'Partner support',  href: 'mailto:partners@grandxl.com'},
  ]

  return (
    <footer className="bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              Nigeria's growing food delivery platform — connecting restaurants with hungry customers, one order at a time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <AppStoreBadge variant="dark" />
              <PlayStoreBadge variant="dark" />
            </div>
          </div>

          {/* Nav links */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:col-span-1 lg:col-span-2">
            {NAV.map(({ label, href }) => (
              href.startsWith('mailto') || href.startsWith('#') ? (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  {label}
                </Link>
              )
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 text-xs text-zinc-600 md:flex-row">
          <p>&copy; {new Date().getFullYear()} GrandXL Technologies Ltd. All rights reserved.</p>
          <p>Benue, Nigeria · Built for African restaurants</p>
        </div>
      </div>
    </footer>
  )
}

// ── Root page (auth-aware) ────────────────────────────────────────────────────

export default function RootPage() {
  const router = useRouter()
  const { user, isAuthenticated, isInitializing } = useAuthStore()

  useEffect(() => {
    if (isInitializing || !isAuthenticated || !user) return
    if (user.roles?.includes(UserRole.SUPER_ADMIN))           router.replace('/dashboard')
    else if (user.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/restaurant/dashboard')
  }, [isAuthenticated, isInitializing, user, router])

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <BentoGrid />
      <Stats />
      <HowItWorks />
      <Cities />
      <WhyGrandXL />
      <CTABanner />
      <Footer />
    </main>
  )
}
