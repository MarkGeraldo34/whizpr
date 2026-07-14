'use client';

import { useEffect, useRef, useState } from 'react';

function useReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll('.reveal');

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    targets.forEach((el) => observer.observe(el));

    // Safety net: if intersection events never arrive for some reason (an
    // odd embedding context, a browser quirk), don't leave content stuck
    // invisible — reveal everything after a short delay regardless.
    const fallback = window.setTimeout(() => {
      targets.forEach((el) => el.classList.add('in-view'));
    }, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return containerRef;
}

function IllustrationConnect() {
  return (
    <svg viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="70" height="130" rx="14" fill="#161d29" stroke="#2e3a4a" strokeWidth="1.5" />
      <rect x="32" y="70" width="46" height="32" rx="7" fill="#F1841F" fillOpacity="0.16" stroke="#F1841F" strokeWidth="1.6" />
      <circle cx="55" cy="86" r="7" fill="#F1841F" />
      <path d="M96 85h30" stroke="#3375BB" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round" />
      <circle cx="150" cy="85" r="34" fill="#161d29" stroke="#2e3a4a" strokeWidth="1.5" />
      <path
        d="M150 68a17 17 0 0 0-17 17c0 12 17 26 17 26s17-14 17-26a17 17 0 0 0-17-17Z"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.6"
      />
      <path d="M142 85l5.5 5.5L159 79" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IllustrationPrepay() {
  return (
    <svg viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="110" cy="42" r="26" fill="#F1841F" />
      <text x="110" y="51" textAnchor="middle" fontSize="22" fontWeight="700" fill="#161d29" fontFamily="ui-sans-serif, sans-serif">
        $
      </text>
      <path d="M110 72v22" stroke="#F1841F" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
      <path d="M100 90 110 100 120 90" stroke="#F1841F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="55" y="105" width="110" height="50" rx="10" fill="#161d29" stroke="#2e3a4a" strokeWidth="1.5" />
      <rect x="65" y="128" width="90" height="17" rx="6" fill="#232c38" />
      <rect x="65" y="128" width="55" height="17" rx="6" fill="#F1841F" fillOpacity="0.55" />
      <text x="110" y="120" textAnchor="middle" fontSize="10" fill="#8593a6" fontFamily="ui-sans-serif, sans-serif">
        prepaid balance
      </text>
    </svg>
  );
}

function IllustrationCapture() {
  return (
    <svg viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="65" y="15" width="90" height="120" rx="14" fill="#161d29" stroke="#2e3a4a" strokeWidth="1.5" />
      <circle cx="110" cy="65" r="26" fill="none" stroke="#E42313" strokeWidth="2" />
      <circle cx="110" cy="65" r="14" fill="#E42313" fillOpacity="0.25" stroke="#E42313" strokeWidth="1.6" />
      <rect x="95" y="35" width="30" height="9" rx="3" fill="#2e3a4a" />
      <path
        d="M110 148a20 20 0 0 0-20 20c0 14 20 34 20 34s20-20 20-34a20 20 0 0 0-20-20Z"
        transform="translate(0 -40) scale(0.85)"
        fill="#F1841F"
      />
      <circle cx="110" cy="115" r="6" fill="#161d29" transform="translate(0 -40) scale(0.85) translate(19.4 20.3)" />
      <path d="M40 150v-10a12 12 0 0 1 12-12h116a12 12 0 0 1 12 12v10" stroke="#3375BB" strokeWidth="1.6" strokeDasharray="3 5" fill="none" />
    </svg>
  );
}

function IllustrationRoute() {
  return (
    <svg viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="70" cy="90" r="10" fill="none" stroke="#E42313" strokeWidth="1.6" opacity="0.35" />
      <circle cx="70" cy="90" r="22" fill="none" stroke="#E42313" strokeWidth="1.6" opacity="0.25" />
      <circle cx="70" cy="90" r="34" fill="none" stroke="#E42313" strokeWidth="1.6" opacity="0.15" />
      <path d="M70 78a12 12 0 0 0-12 12c0 9 12 20 12 20s12-11 12-20a12 12 0 0 0-12-12Z" fill="#E42313" />
      <path d="M84 88h64" stroke="#8593a6" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round" />
      <rect x="150" y="60" width="56" height="56" rx="12" fill="#161d29" stroke="#2e3a4a" strokeWidth="1.5" />
      <path
        d="M178 74 158 84v14c0 12 8.5 21.5 20 25 11.5-3.5 20-13 20-25V84Z"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.8"
      />
      <path d="M171 96l5 5 9-10" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS = [
  {
    title: 'Connect & verify',
    body: 'Sign in with your Ethereum wallet. A signed message (no gas, no transaction) proves the alert really came from you, so responders and other users can trust it wasn’t spoofed or spammed.',
    illustration: IllustrationConnect,
  },
  {
    title: 'Prepay in USDT',
    body: 'Top up a small prepaid balance in USDT before anything happens. There’s no subscription and nothing is charged until you actually send an alert — the deposit just sits ready, verified on-chain.',
    illustration: IllustrationPrepay,
  },
  {
    title: 'Capture the moment',
    body: 'When something’s wrong, open Whizpr, snap a photo or a few seconds of video, add a quick note if you can, and your exact GPS location is attached automatically.',
    illustration: IllustrationCapture,
  },
  {
    title: 'Reach the right responders',
    body: 'Your report is timestamped, tied to your verified wallet, and queued for delivery to the responders closest to where it happened — not a generic hotline queue.',
    illustration: IllustrationRoute,
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`about-toggle-icon${open ? ' open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AboutExplainer() {
  const containerRef = useReveal();
  const [introOpen, setIntroOpen] = useState(false);

  return (
    <div ref={containerRef} className="about">
      <section className="about-intro reveal">
        <button
          type="button"
          className="about-toggle"
          onClick={() => setIntroOpen((open) => !open)}
          aria-expanded={introOpen}
          aria-controls="about-intro-content"
        >
          What is Whizpr?
          <ChevronIcon open={introOpen} />
        </button>
        <div id="about-intro-content" className={`about-collapse${introOpen ? ' expanded' : ''}`}>
          <div className="about-collapse-inner">
            <p>
              Whizpr is a real-time public safety alert network. When something is happening — a fire
              spreading through a building, a crash on a quiet road, a medical emergency with no
              ambulance in sight — every second counts, and the gap between &ldquo;someone should call
              for help&rdquo; and &ldquo;help is actually on the way&rdquo; is where people get hurt.
              Whizpr closes that gap by turning any connected phone into a verified, instantly
              dispatchable alert beacon.
            </p>
            <p>
              Instead of dialing a number and waiting on hold, or posting to a social feed and hoping
              the right person happens to see it, you open Whizpr, capture what&rsquo;s happening, and
              send it. Your report carries your exact location, a timestamp, and a cryptographic
              guarantee that it came from a real, wallet-verified person — not a bot, not a prank, not
              a duplicate.
            </p>
          </div>
        </div>
      </section>

      <section className="about-steps">
        {STEPS.map((step, index) => {
          const Illustration = step.illustration;
          return (
            <div key={step.title} className="about-step reveal" style={{ transitionDelay: `${index * 90}ms` }}>
              <div className="about-step-art">
                <Illustration />
              </div>
              <div className="about-step-copy">
                <span className="about-step-index">{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="about-trust reveal">
        <h2>Built on transparency, not promises</h2>
        <p>
          Traditional emergency apps ask you to trust a company&rsquo;s backend with no visibility into
          what happens to your report or your money. Whizpr&rsquo;s prepaid balance lives on-chain: every
          deposit is a verifiable transaction, every alert debit is auditable, and nothing moves without
          your wallet&rsquo;s signature. You always know exactly what you&rsquo;ve paid for and what
          you&rsquo;re holding in reserve for the moment you actually need it.
        </p>
      </section>
    </div>
  );
}
