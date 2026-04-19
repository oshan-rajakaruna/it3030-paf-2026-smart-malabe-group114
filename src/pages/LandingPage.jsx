import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import campusMark from '../assets/campus-mark.png';
import { ROUTE_PATHS } from '../routes/routeConfig';

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

function AnimatedSection({ children, className = '', threshold = 0.12, id }) {
  const [ref, visible] = useInView(threshold);

  return (
    <section id={id} ref={ref} className={`${className} ${visible ? 'um-reveal-visible' : 'um-reveal'}`}>
      {children}
    </section>
  );
}

function MiniDashboard({ large = false }) {
  const baseBars = [45, 55, 42, 72, 52, 61, 48];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timerId = window.setInterval(() => setTick((value) => value + 1), 1800);
    return () => window.clearInterval(timerId);
  }, []);

  const bars = baseBars.map((bar, index) => Math.max(20, Math.min(82, bar + Math.sin(tick * 0.8 + index) * 10)));

  return (
    <div className={large ? 'um-dashboard um-dashboard-large' : 'um-dashboard'}>
      <div className="um-dashboard-top">
        <div className="um-dots">
          <span className="um-red" />
          <span className="um-yellow" />
          <span className="um-green" />
        </div>
        <span>UNIMATRIX OS</span>
      </div>

      <div className="um-dash-stats">
        <div>
          <span>Rooms</span>
          <strong>24/36</strong>
        </div>
        <div>
          <span>Tickets</span>
          <strong>12 open</strong>
        </div>
        <div>
          <span>Users</span>
          <strong>1,284</strong>
        </div>
      </div>

      {large ? (
        <>
          <div className="um-chart-title">BOOKING ACTIVITY - THIS WEEK</div>
          <div className="um-chart">
            {bars.map((height, index) => (
              <i key={`${height}-${index}`} style={{ height: `${height}%` }} className={index === 3 ? 'um-chart-hot' : ''} />
            ))}
          </div>
          <div className="um-week-labels">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
        </>
      ) : null}

      <div className="um-ticket-list">
        {[
          { id: '#TK-041', text: 'AC fault - Lab 3B', status: 'In Progress', tone: 'warm' },
          { id: '#TK-042', text: 'Projector replacement', status: 'Open', tone: 'danger' },
          ...(large ? [{ id: '#TK-043', text: 'Lighting - Hall A', status: 'Resolved', tone: 'good' }] : []),
        ].map((ticket) => (
          <div className="um-ticket-row" key={ticket.id}>
            <span><b>{ticket.id}</b> {ticket.text}</span>
            <em className={`um-ticket-${ticket.tone}`}>{ticket.status}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Smart Booking System',
    text: 'Reserve lecture halls, labs, and shared spaces in real time. Avoid double bookings with intelligent conflict detection and automated confirmations.',
    tone: 'blue',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="10" y="12" width="28" height="26" rx="4" />
        <path d="M10 20h28M17 7v9M31 7v9" />
        <rect x="16" y="25" width="9" height="6" rx="1" />
        <path d="M34 34h8M38 30v8" />
      </svg>
    ),
  },
  {
    title: 'Maintenance & Ticketing',
    text: 'Log facility issues instantly. Track tickets from creation through resolution with automated routing to the right technician.',
    tone: 'cyan',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="10" y="10" width="28" height="28" rx="4" />
        <circle cx="24" cy="20" r="5" />
        <path d="M16 30h16M16 35h12M35 14h5M37.5 11.5v5" />
      </svg>
    ),
  },
  {
    title: 'Admin Dashboard & Analytics',
    text: 'Get full visibility across all campus resources. Monitor utilisation, generate reports, and make data-driven decisions with live dashboards.',
    tone: 'violet',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="9" y="9" width="30" height="30" rx="4" />
        <path d="M15 31l7-8 6 4 7-11" />
        <path d="M15 17h7M15 23h4" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Create Booking or Ticket',
    text: 'Users submit a booking request or maintenance ticket via a simple, guided form - available on any device.',
  },
  {
    number: '02',
    title: 'Admin Reviews & Assigns',
    text: 'Administrators instantly receive and review requests, approve bookings, or route tickets to the right team member.',
  },
  {
    number: '03',
    title: 'Technician Resolves',
    text: 'Assigned staff action and close out tasks in the field. Requesters receive real-time status notifications throughout.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <div className="um-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&family=Space+Grotesk:wght@500;600;700;800&display=swap');
        @keyframes umPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes umFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes umGlow{0%,100%{box-shadow:0 0 0 rgba(59,130,246,0)}50%{box-shadow:0 0 34px rgba(59,130,246,.2)}}
        .um-page{min-height:100vh;background:#050b16;color:#e7edf7;font-family:'DM Sans',sans-serif;overflow-x:hidden;background-image:linear-gradient(rgba(64,94,140,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(64,94,140,.10) 1px,transparent 1px),radial-gradient(circle at 50% 10%,rgba(37,99,235,.10),transparent 38%);background-size:274px 274px,274px 274px,100% 100%}
        .um-page *{box-sizing:border-box}
        .um-page h1,.um-page h2,.um-page h3,.um-title{font-family:'Space Grotesk',sans-serif}
        .um-nav{height:82px;position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 5.1%;background:rgba(5,11,22,.88);border-bottom:1px solid rgba(59,130,246,.12);backdrop-filter:blur(18px)}
        .um-brand{display:flex;align-items:center;gap:13px}.um-brand-mark{width:46px;height:46px;display:grid;place-items:center;background:transparent;box-shadow:none}.um-brand-mark img{width:100%;height:100%;object-fit:contain}.um-brand strong{font-family:'Space Grotesk',sans-serif;font-size:22px;letter-spacing:-.04em}
        .um-actions{justify-self:end;display:flex;align-items:center;gap:15px}.um-btn{min-height:48px;border-radius:12px;padding:0 27px;font:700 16px 'DM Sans',sans-serif;letter-spacing:.02em;cursor:pointer;transition:transform .22s,background .22s,border-color .22s}.um-btn:hover{transform:translateY(-2px)}.um-btn.ghost{background:rgba(8,16,31,.58);border:1px solid rgba(96,165,250,.22);color:#b9d7ff}.um-btn.primary{border:1px solid rgba(37,99,235,.8);background:#2563eb;color:#fff;box-shadow:0 14px 38px rgba(37,99,235,.28)}
        .um-hero{min-height:100vh;display:grid;grid-template-columns:minmax(420px,.9fr) minmax(620px,1.25fr);gap:70px;align-items:center;padding:168px 5.1% 104px;position:relative}.um-hero-copy{max-width:820px}.um-hero-pill{display:inline-flex;align-items:center;gap:12px;height:34px;padding:0 18px;border-radius:999px;background:rgba(30,64,111,.36);border:1px solid rgba(71,125,200,.28);color:#7c8da4;font:800 13px 'IBM Plex Mono',monospace;letter-spacing:.18em;text-transform:uppercase}.um-hero-pill::before{content:'';width:9px;height:9px;border-radius:50%;background:#22d3ee;box-shadow:0 0 18px rgba(34,211,238,.75);animation:umPulse 1.7s infinite}.um-hero h1{margin:38px 0 26px;color:#f2f7ff;font-size:64px;line-height:1.06;letter-spacing:.015em;font-weight:800}.um-hero h1 span{background:linear-gradient(90deg,#2563eb 0%,#22d3ee 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.um-hero p{max-width:560px;margin:0;color:#7a899f;font-size:20px;line-height:1.7;letter-spacing:.02em}.um-hero-actions{display:flex;align-items:center;gap:14px;margin-top:42px}.um-hero-trust{display:flex;align-items:center;gap:18px;margin-top:54px}.um-avatar-stack{display:flex}.um-avatar-stack span{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;margin-left:-6px;border:2px solid #06101f;color:white;font-size:12px;font-weight:800}.um-avatar-stack span:first-child{margin-left:0;background:#3b82f6}.um-avatar-stack span:nth-child(2){background:#93c5fd}.um-avatar-stack span:nth-child(3){background:#22d3ee}.um-avatar-stack span:nth-child(4){background:#f59e0b}.um-trust-copy strong{display:block;color:#dbe4ef;font-size:15px}.um-trust-copy small{display:block;margin-top:4px;color:#59677a;font-size:13px}.um-hero-visual{position:relative;min-height:540px;display:grid;align-items:center;animation:umFloat 7s ease-in-out infinite}.um-hero-visual .um-dashboard{padding:28px;border-radius:22px;background:#071527;box-shadow:0 48px 120px rgba(0,0,0,.34)}.um-hero-visual .um-dashboard-top{margin-bottom:22px}.um-hero-visual .um-dash-stats{margin-bottom:20px}.um-hero-visual .um-dashboard .um-chart-title{margin-top:4px}.um-hero-visual .um-ticket-row{min-height:42px}.um-uptime-badge{position:absolute;right:-22px;top:70px;min-width:104px;padding:17px 18px;border-radius:12px;border:1px solid rgba(71,125,200,.32);background:#0a1d36;box-shadow:0 22px 60px rgba(0,0,0,.26)}.um-uptime-badge span{display:block;color:#6f7e91;font-size:11px}.um-uptime-badge strong{display:block;margin-top:7px;color:#60a5fa;font-size:22px}.um-confirm-badge{position:absolute;left:-24px;bottom:88px;display:flex;align-items:center;gap:12px;min-width:236px;padding:13px 18px;border-radius:12px;border:1px solid rgba(34,211,238,.24);background:#08213a;box-shadow:0 22px 60px rgba(0,0,0,.28)}.um-confirm-badge i{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:rgba(34,211,238,.12);color:#22d3ee;font-style:normal}.um-confirm-badge strong{display:block;color:#dbe4ef;font-size:14px}.um-confirm-badge span{display:block;color:#6f7e91;font-size:12px;margin-top:2px}
        .um-section{padding:88px 5.1%;position:relative}.um-section-center{text-align:center;max-width:880px;margin:0 auto 108px}.um-eyebrow{display:block;color:#3b82f6;font:800 14px 'IBM Plex Mono',monospace;letter-spacing:.22em;text-transform:uppercase;margin-bottom:30px}.um-title{margin:0;color:#eef4ff;font-size:50px;line-height:1.08;letter-spacing:.01em;font-weight:800}.um-copy{margin:28px auto 0;max-width:660px;color:#758397;font-size:19px;line-height:1.55;letter-spacing:.04em}
        .um-reveal{opacity:0;transform:translateY(42px);transition:opacity .8s ease,transform .8s cubic-bezier(.2,1,.2,1)}.um-reveal-visible{opacity:1;transform:none;transition:opacity .8s ease,transform .8s cubic-bezier(.2,1,.2,1)}
        .um-features{padding-top:112px;min-height:835px}.um-feature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px}.um-feature-card{min-height:364px;padding:40px 36px 34px;border:1px solid rgba(71,125,200,.28);border-radius:24px;background:rgba(10,25,45,.58);box-shadow:0 36px 120px rgba(0,0,0,.25);transition:transform .32s,border-color .32s,background .32s}.um-feature-card:hover{transform:translateY(-10px);background:rgba(12,31,56,.72);border-color:color-mix(in srgb,var(--tone) 40%,rgba(71,125,200,.28))}
        .um-icon{width:76px;height:76px;border-radius:18px;display:grid;place-items:center;background:color-mix(in srgb,var(--tone) 11%,transparent);border:1px solid color-mix(in srgb,var(--tone) 32%,transparent);margin-bottom:26px}.um-icon svg{width:42px;height:42px;fill:none;stroke:var(--tone);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.um-feature-card h3{margin:0 0 24px;font-size:23px;line-height:1.2;color:#dbe4ef}.um-feature-card p{margin:0 0 24px;color:#758397;font-size:17px;line-height:1.7;letter-spacing:.02em}.um-feature-card a{color:var(--tone);font-weight:800;text-decoration:none;letter-spacing:.05em}
        .um-workflow-card,.um-cta-card{border:1px solid rgba(71,125,200,.32);border-radius:30px;background:rgba(10,25,45,.63);box-shadow:0 48px 140px rgba(0,0,0,.28)}.um-workflow-card{display:grid;grid-template-columns:1fr .95fr;gap:64px;align-items:center;min-height:670px;padding:70px 86px}.um-workflow-copy .um-eyebrow{color:#2dd4bf;margin-bottom:28px}.um-workflow-copy h2{font-size:40px}.um-workflow-copy p{margin:24px 0 54px;color:#758397;font-size:17px;letter-spacing:.04em}.um-step{display:grid;grid-template-columns:58px 1fr;gap:24px;margin-bottom:40px}.um-step-no{width:58px;height:58px;border-radius:14px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--tone) 32%,transparent);background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone);font:800 15px 'IBM Plex Mono',monospace}.um-step h3{margin:2px 0 10px;font-size:22px}.um-step p{margin:0;font-size:16px;line-height:1.7}
        .um-workflow-visual{position:relative;animation:umFloat 6s ease-in-out infinite}.um-connector{position:absolute;left:-26px;top:50%;width:26px;height:136px;border-left:1px dashed rgba(96,165,250,.25);transform:translateY(-50%)}.um-connector i{position:absolute;left:-4px;width:8px;height:8px;border-radius:50%;background:#3b82f6}.um-connector i:nth-child(1){top:0}.um-connector i:nth-child(2){top:50%;background:#22d3ee}.um-connector i:nth-child(3){bottom:0;background:#818cf8}
        .um-dashboard{border:1px solid rgba(71,125,200,.28);border-radius:16px;background:#071527;padding:18px;font-family:'IBM Plex Mono',monospace}.um-dashboard-large{border-radius:22px;padding:28px}.um-dashboard-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:#334155;font-size:12px;letter-spacing:.17em}.um-dots{display:flex;gap:8px}.um-dots span{width:9px;height:9px;border-radius:50%}.um-red{background:#ef4444}.um-yellow{background:#f59e0b}.um-green{background:#22c55e}
        .um-dash-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.um-dash-stats div{border:1px solid rgba(71,125,200,.35);border-radius:8px;padding:10px}.um-dash-stats span{display:block;color:#526176;font-size:10px}.um-dash-stats strong{display:block;margin-top:4px;color:#3b82f6;font-size:13px}.um-dash-stats div:nth-child(2) strong{color:#22d3ee}.um-dash-stats div:nth-child(3) strong{color:#818cf8}.um-ticket-list{display:grid;gap:8px}.um-ticket-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid rgba(71,125,200,.25);border-radius:7px;background:rgba(15,35,61,.7);font-size:12px}.um-ticket-row b{color:#3b82f6}.um-ticket-row em{font-style:normal;border-radius:999px;padding:3px 9px;font-size:10px}.um-ticket-warm{color:#f59e0b;border:1px solid rgba(245,158,11,.32);background:rgba(245,158,11,.08)}.um-ticket-danger{color:#fb7185;border:1px solid rgba(244,63,94,.32);background:rgba(244,63,94,.08)}.um-ticket-good{color:#22c55e;border:1px solid rgba(34,197,94,.32);background:rgba(34,197,94,.08)}
        .um-preview-section{text-align:center}.um-preview-section .um-eyebrow{color:#8b8ff8}.um-preview-shell{max-width:1704px;margin:64px auto 0;border:1px solid rgba(71,125,200,.22);border-radius:26px;background:#071527;overflow:hidden;box-shadow:0 52px 140px rgba(0,0,0,.28)}.um-browser-top{height:60px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;padding:0 24px;border-bottom:1px solid rgba(71,125,200,.22)}.um-url{justify-self:center;width:min(318px,80%);height:30px;border:1px solid rgba(71,125,200,.42);border-radius:6px;color:#27364b;display:grid;place-items:center;font-size:12px}
        .um-preview-body{display:grid;grid-template-columns:64px 1fr;min-height:528px}.um-sidebar{border-right:1px solid rgba(71,125,200,.22);padding-top:20px;display:grid;justify-items:center;align-content:start;gap:34px}.um-sidebar span{width:17px;height:17px;border-radius:4px;background:#26384f}.um-sidebar span:first-child{width:36px;height:36px;background:#0c2548;border:1px solid rgba(59,130,246,.38);position:relative}.um-sidebar span:first-child::after{content:'';position:absolute;inset:10px;border-radius:4px;background:#3b82f6}.um-dashboard-zone{padding:28px}.um-chart-title{text-align:left;color:#506075;font-size:11px;letter-spacing:.15em;margin:18px 0 26px}.um-chart{height:58px;display:flex;align-items:end;gap:5px}.um-chart i{flex:1;background:#213d60;transition:height 1.2s ease}.um-chart .um-chart-hot{background:#3b82f6}.um-week-labels{display:flex;justify-content:space-around;color:#324256;font-size:11px;margin:9px 0 24px}
        .um-cta{padding-bottom:64px}.um-cta-card{min-height:600px;display:grid;place-items:center;text-align:center;padding:72px}.um-pill{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(59,130,246,.25);background:rgba(59,130,246,.09);color:#3b82f6;border-radius:999px;padding:9px 17px;font:800 13px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase}.um-pill::before{content:'';width:6px;height:6px;border-radius:50%;background:#3b82f6;animation:umPulse 1.6s infinite}.um-cta-card h2{margin:38px auto 30px;max-width:590px;font-size:48px;line-height:1.55;letter-spacing:.03em}.um-cta-card p{max-width:560px;margin:0 auto 42px;color:#758397;font-size:17px;line-height:1.55;letter-spacing:.04em}.um-cta-actions{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}.um-cta-note{display:block;margin-top:24px;color:#3d4859;font-size:14px}
        .um-footer{min-height:116px;border-top:1px solid rgba(71,125,200,.18);display:flex;align-items:center;justify-content:space-between;gap:28px;padding:0 5.1%;background:rgba(5,11,22,.78)}.um-footer-brand{display:flex;align-items:center;gap:14px;min-width:0}.um-footer-brand .um-brand-mark{width:38px;height:38px}.um-footer-brand .um-brand-mark img{width:100%;height:100%}.um-footer-brand strong{color:#e7edf7;font-size:19px;letter-spacing:-.03em}.um-footer-brand span{color:#344053;font-size:15px;white-space:nowrap}.um-footer-links{display:flex;align-items:center;gap:34px;flex-wrap:wrap}.um-footer-links a{color:#526176;text-decoration:none;font-size:15px;transition:color .2s}.um-footer-links a:hover{color:#b9d7ff}
        @media(max-width:1180px){.um-hero{grid-template-columns:1fr;gap:44px}.um-hero-visual{min-height:auto}.um-uptime-badge{right:18px}.um-confirm-badge{left:18px}}
        @media(max-width:980px){.um-feature-grid,.um-workflow-card{grid-template-columns:1fr}.um-workflow-card{padding:44px 28px}.um-preview-body{grid-template-columns:1fr}.um-sidebar{display:none}.um-title{font-size:38px}.um-cta-card h2{font-size:36px}.um-section,.um-hero{padding-left:24px;padding-right:24px}.um-footer{align-items:flex-start;flex-direction:column;padding:30px 24px}.um-footer-links{gap:18px}}
        @media(max-width:640px){.um-nav{padding:0 16px}.um-brand strong{font-size:18px}.um-btn{min-height:42px;padding:0 16px}.um-actions{gap:8px}.um-hero{padding-top:58px}.um-hero h1{font-size:42px}.um-hero p{font-size:17px}.um-hero-actions,.um-hero-trust{flex-wrap:wrap}.um-feature-card{padding:28px 22px}.um-workflow-card,.um-cta-card{border-radius:22px}.um-workflow-card{padding:34px 20px}.um-section-center{margin-bottom:52px}.um-title{font-size:32px}.um-copy{font-size:16px}.um-step{grid-template-columns:1fr}.um-dash-stats{grid-template-columns:1fr}.um-cta-card{padding:44px 20px}.um-uptime-badge,.um-confirm-badge{position:static;margin-top:14px}.um-hero-visual{display:block}.um-footer-brand{align-items:flex-start;flex-direction:column}.um-footer-brand span{white-space:normal}}
      `}</style>

      <nav className="um-nav">
        <div className="um-brand">
          <div className="um-brand-mark">
            <img src={campusMark} alt="UniMatrix campus mark" />
          </div>
          <strong>UniMatrix</strong>
        </div>

        <div className="um-actions">
          <button type="button" className="um-btn ghost" onClick={() => navigate(ROUTE_PATHS.LOGIN)}>Login</button>
          <button type="button" className="um-btn primary" onClick={() => navigate(ROUTE_PATHS.SIGNUP)}>Get Started</button>
        </div>
      </nav>

      <AnimatedSection className="um-hero" threshold={0.02}>
        <div className="um-hero-copy">
          <span className="um-hero-pill">Campus Intelligence Platform</span>
          <h1>
            Smart Campus <span>Management</span> System
          </h1>
          <p>
            Unified booking, maintenance ticketing, and resource management - all in one intelligent platform built for modern universities.
          </p>
          <div className="um-hero-actions">
            <button type="button" className="um-btn primary" onClick={() => navigate(ROUTE_PATHS.SIGNUP)}>Get Started →</button>
          </div>
        </div>

        <div className="um-hero-visual">
          <MiniDashboard large />
          <div className="um-uptime-badge">
            <span>Uptime SLA</span>
            <strong>99.9%</strong>
          </div>
          <div className="um-confirm-badge">
            <i>◷</i>
            <div>
              <strong>Booking confirmed</strong>
              <span>Lab 4B · 9:00 AM - 11:00 AM</span>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="um-section um-features" threshold={0.05}>
        <div id="features" className="um-section-center">
          <span className="um-eyebrow">Features</span>
          <h1 className="um-title">Everything your campus needs</h1>
          <p className="um-copy">Purpose-built modules that talk to each other, giving staff and students a seamless experience.</p>
        </div>

        <div className="um-feature-grid">
          {FEATURES.map((feature, index) => (
            <article
              className="um-feature-card"
              key={feature.title}
              style={{
                '--tone': feature.tone === 'blue' ? '#3b82f6' : feature.tone === 'cyan' ? '#22d3ee' : '#818cf8',
                transitionDelay: `${index * 90}ms`,
              }}
            >
              <div className="um-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection className="um-section">
        <div className="um-workflow-card">
          <div className="um-workflow-copy">
            <span className="um-eyebrow">How it works</span>
            <h2 className="um-title">Simple 3-step workflow</h2>
            <p>From request to resolution - UniMatrix keeps every stakeholder in the loop.</p>

            {STEPS.map((step, index) => (
              <div
                className="um-step"
                key={step.number}
                style={{ '--tone': index === 0 ? '#3b82f6' : index === 1 ? '#22d3ee' : '#818cf8' }}
              >
                <div className="um-step-no">{step.number}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="um-workflow-visual">
            <div className="um-connector"><i /><i /><i /></div>
            <MiniDashboard />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="um-section um-preview-section">
        <span className="um-eyebrow">System Preview</span>
        <h2 className="um-title">See UniMatrix in action</h2>

        <div className="um-preview-shell">
          <div className="um-browser-top">
            <div className="um-dots">
              <span className="um-red" />
              <span className="um-yellow" />
              <span className="um-green" />
            </div>
            <div className="um-url">app.unimatrix.edu/dashboard</div>
            <span />
          </div>
          <div className="um-preview-body">
            <aside className="um-sidebar">
              <span />
              <span />
              <span />
              <span />
            </aside>
            <div className="um-dashboard-zone">
              <MiniDashboard large />
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="contact" className="um-section um-cta">
        <div className="um-cta-card">
          <div>
            <span className="um-pill">Join 50+ institutions</span>
            <h2>Start managing your campus smarter</h2>
            <p>Get up and running in days, not months. No lengthy onboarding - just powerful tools ready to use.</p>
            <div className="um-cta-actions">
              <button type="button" className="um-btn primary" onClick={() => navigate(ROUTE_PATHS.SIGNUP)}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <footer className="um-footer">
        <div className="um-footer-brand">
          <div className="um-brand">
            <div className="um-brand-mark">
              <img src={campusMark} alt="UniMatrix campus mark" />
            </div>
            <strong>UniMatrix</strong>
          </div>
          <span>© 2025 UniMatrix Technologies. All rights reserved.</span>
        </div>

        <nav className="um-footer-links" aria-label="Footer links">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#support">Support</a>
          <a href="#documentation">Documentation</a>
        </nav>
      </footer>
    </div>
  );
}
