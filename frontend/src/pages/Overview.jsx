import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mic,
  RotateCcw,
  Star,
  Phone,
  Mail,
  Users,
  Flame,
  Building2,
  CalendarClock,
} from 'lucide-react';
import PropertyCard from '../components/PropertyCard';
import PropertyModal from '../components/PropertyModal';
import StatCard from '../components/StatCard';
import { InteractiveTilt, useMouseParallax } from '../components/InteractiveTilt';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
import { dashboardApi, propertiesApi } from '../services/api';

const PROCESS_STEPS = [
  {
    title: 'Request & requirements',
    desc: 'Speak naturally with PropVoice AI about your preferred city, BHK, budget, and possession timeline.',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Property selection',
    desc: 'Our AI engine filters verified listings from the database to match your exact budget and location.',
    image:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'AI Lead Qualification',
    desc: 'Every conversation is scored 0–100 (HOT, WARM, COLD) with transparent criteria and CRM summaries.',
    image:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Site visit & key transfer',
    desc: 'Schedule site visits seamlessly and track every follow-up task in the PropVoice CRM.',
    image:
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80',
  },
];

const ADVISORS = [
  {
    name: 'PropVoice AI Concierge',
    role: '24/7 Voice Qualification Agent',
    rating: '5.0',
    reviews: '120+ calls',
    contact: 'Launch Voice AI',
    isAI: true,
    photo: '/images/agents/ai-concierge.jpg',
  },
  {
    name: 'Arjun Mehta',
    role: 'Bangalore Luxury Specialist',
    rating: '4.9',
    reviews: '80 reviews',
    contact: '+91 00000 11111',
    photo: '/images/agents/arjun.jpg',
  },
  {
    name: 'Kavya Krishnan',
    role: 'Chennai Coastal & OMR Advisor',
    rating: '4.8',
    reviews: '88 reviews',
    contact: '+91 00000 22222',
    photo: '/images/agents/kavya.jpg',
  },
  {
    name: 'Siddharth Rao',
    role: 'Hyderabad HITEC City Broker',
    rating: '4.7',
    reviews: '76 reviews',
    contact: '+91 00000 33333',
    photo: '/images/agents/siddharth.jpg',
  },
];

const HISTOGRAM_CARDS = [
  {
    label: 'Lead qualification rate',
    bars: [42, 58, 50, 46, 62, 70, 56, 72, 44, 38],
  },
  {
    label: 'Qualified pipeline growth',
    bars: [18, 22, 28, 42, 44, 46, 48, 65, 78, 90],
  },
  {
    label: 'Avg. intent score',
    bars: [24, 82, 32, 52, 48, 76, 66, 30, 50, 56],
  },
];

export default function Overview() {
  const pageRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [hoveredBar, setHoveredBar] = useState({ card: null, bar: null });

  const collageParallax = useMouseParallax(14);

  const [tab, setTab] = useState('buy');
  const [city, setCity] = useState('all');
  const [propertyType, setPropertyType] = useState('all');
  const [budget, setBudget] = useState('all');
  const [bhk, setBhk] = useState('all');

  const fetchFilteredProperties = (overrides = {}) => {
    const t = overrides.tab ?? tab;
    const c = overrides.city ?? city;
    const pt = overrides.propertyType ?? propertyType;
    const b = overrides.budget ?? budget;
    const bk = overrides.bhk ?? bhk;

    const params = {};
    if (t === 'buy' || t === 'rent') params.listing_type = t;
    if (t === 'Ready to Move' || t === 'Under Construction') params.possession_status = t;
    if (c !== 'all') params.city = c;
    if (pt !== 'all') params.property_type = pt;
    if (bk !== 'all') params.bhk = bk;
    if (b === 'under_80l') params.max_price = 8000000;
    if (b === '80l_150l') {
      params.min_price = 8000000;
      params.max_price = 15000000;
    }
    if (b === 'above_150l') params.min_price = 15000000;

    propertiesApi
      .list(params)
      .then((res) => setProperties(res.slice(0, 6)))
      .catch(() => setProperties([]));
  };

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => setStats(null));
    fetchFilteredProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centralized GSAP + ScrollTrigger + Lenis scroll choreography
  useScrollAnimations(pageRef, [properties.length, Boolean(stats)]);

  const handleClearFilters = () => {
    setTab('buy');
    setCity('all');
    setPropertyType('all');
    setBudget('all');
    setBhk('all');
    fetchFilteredProperties({
      tab: 'buy',
      city: 'all',
      propertyType: 'all',
      budget: 'all',
      bhk: 'all',
    });
  };

  const qualRate = stats?.total_leads
    ? Math.round(((stats.hot_leads + stats.warm_leads) / stats.total_leads) * 100)
    : 75;
  const totalPropsCount = stats?.total_properties ?? 18;
  const avgScoreVal = Math.round(stats?.average_lead_score ?? 60);

  return (
    <div ref={pageRef} className="space-y-20 overflow-x-clip pb-12">
      {/* 1. Editorial Hero Section */}
      <section data-anim="hero-section" className="space-y-8">
        <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1
              data-anim="headline"
              className="text-4xl font-semibold tracking-tight text-[#111111] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]"
            >
              Find a place you
              <br />
              will call home
            </h1>
            <div data-anim="subcopy" className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/voice-assistant"
                className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-5 py-2.5 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                <Mic className="h-3.5 w-3.5" />
                Book a voice call
              </Link>
              <Link
                to="/properties"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-xs font-semibold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-100"
              >
                Explore properties
              </Link>
            </div>
          </div>

          <div data-anim="subcopy" className="lg:col-span-5">
            <p className="max-w-md text-sm leading-relaxed text-neutral-500">
              With PropVoice AI you will find not just accommodation, but a place where your new
              life begins — qualified intelligently through natural voice conversations.
            </p>
          </div>
        </div>

        {/* Shared Hero Image -> travels into Property Selection morph slot on desktop */}
        <div
          data-anim="hero-image"
          className="relative z-20 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm will-change-transform"
        >
          <img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85"
            alt="Modern architectural residence"
            className="h-[340px] w-full object-cover sm:h-[440px]"
          />
        </div>
      </section>

      {/* 2. Property Selection / Pinned Image Morph Section */}
      <section
        data-anim="morph-section"
        className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:p-10"
      >
        <div className="space-y-5 lg:col-span-5">
          <h2
            data-anim="headline"
            className="text-2xl font-semibold tracking-tight text-[#111111] sm:text-3xl"
          >
            See what we offer and how it works
          </h2>
          <p data-anim="subcopy" className="text-xs leading-relaxed text-neutral-500 sm:text-sm">
            Property selection, AI qualification, and site visit scheduling in one seamless flow.
          </p>

          <div className="space-y-3 pt-2">
            {PROCESS_STEPS.map((step, idx) => (
              <button
                key={step.title}
                type="button"
                onMouseEnter={() => setActiveStep(idx)}
                onClick={() => setActiveStep(idx)}
                className={`block w-full border-l-2 pl-4 text-left transition-all duration-300 ${
                  activeStep === idx
                    ? 'border-[#111111] text-[#111111]'
                    : 'border-transparent text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <p className="text-base font-semibold sm:text-lg">{step.title}</p>
                {activeStep === idx && (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{step.desc}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Target morph slot (pinned on desktop while scrolling through section) */}
        <div
          data-anim="morph-slot"
          className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 will-change-transform lg:col-span-7"
        >
          <img
            src={PROCESS_STEPS[activeStep].image}
            alt={PROCESS_STEPS[activeStep].title}
            className="h-72 w-full object-cover sm:h-80"
          />
          {/* Crossfade second morph image (entrance / steps) */}
          <img
            data-anim="morph-img-2"
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80"
            alt="Property entrance and architectural steps"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 will-change-transform"
          />
          {/* Floor-plan corner thumbnail */}
          <div
            data-anim="floorplan-thumb"
            className="pointer-events-none absolute bottom-3 right-3 h-20 w-28 overflow-hidden rounded-lg border border-neutral-200 bg-white/95 p-1.5 opacity-0 shadow-md will-change-transform"
          >
            <svg
              viewBox="0 0 120 80"
              className="h-full w-full stroke-[#111111]"
              fill="none"
              strokeWidth="1.5"
            >
              <rect x="6" y="6" width="108" height="68" rx="2" />
              <line x1="6" y1="42" x2="62" y2="42" />
              <line x1="62" y1="6" x2="62" y2="74" />
              <line x1="62" y1="36" x2="114" y2="36" />
              <path d="M44 42 A12 12 0 0 1 56 30" strokeDasharray="2 2" />
            </svg>
          </div>
        </div>
      </section>

      {/* 3. Expert Agents & Voice AI Concierge */}
      <section data-anim="agents-section" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            data-anim="headline"
            className="text-2xl font-semibold tracking-tight text-[#111111] sm:text-3xl"
          >
            Expert agents
          </h2>
          <Link
            to="/voice-assistant"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] transition hover:bg-neutral-100"
          >
            <Mic className="h-3.5 w-3.5" />
            Talk to AI Concierge
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADVISORS.map((agent) => (
            <div key={agent.name} data-anim="agent-card">
              <InteractiveTilt maxTilt={4.5} scale={1.02} className="rounded-xl">
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <div className="relative h-52 overflow-hidden rounded-lg bg-neutral-100">
                    <img
                      src={agent.photo}
                      alt={agent.name}
                      className="h-full w-full object-cover object-top transition-transform duration-500 hover:scale-105"
                    />
                    <span className="absolute left-2.5 top-2.5 rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#111111]">
                      {agent.isAI ? 'PROPVOICE AI' : 'HORIZON PARTNER'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-[#111111]">{agent.name}</h3>
                    <p className="text-xs text-neutral-500">{agent.role}</p>

                    <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                      <Star className="h-3.5 w-3.5 fill-[#111111] text-[#111111]" />
                      <span className="font-bold text-[#111111]">{agent.rating}</span>
                      <span className="text-neutral-400">/ {agent.reviews}</span>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {agent.isAI ? (
                        <Link
                          to="/voice-assistant"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#111111] py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {agent.contact}
                        </Link>
                      ) : (
                        <a
                          href={`tel:${agent.contact}`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#111111] py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {agent.contact}
                        </a>
                      )}
                      <Link
                        to="/followups"
                        className="rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-100"
                        title="Schedule follow-up"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </InteractiveTilt>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Statistics / Reliable Facilities Section */}
      <section
        data-anim="stats-section"
        className="space-y-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10"
      >
        <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2
              data-anim="headline"
              className="text-3xl font-semibold tracking-tight text-[#111111]"
            >
              Reliable intelligence
              <br />
              for smarter qualification
            </h2>
          </div>
          <div data-anim="subcopy" className="lg:col-span-5">
            <p className="text-xs leading-relaxed text-neutral-500 sm:text-sm">
              Every voice call is structured into transparent qualification metrics, helping your
              team prioritize high-intent buyers immediately.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {HISTOGRAM_CARDS.map((card, cardIdx) => {
            const targetVal =
              cardIdx === 0 ? qualRate : cardIdx === 1 ? totalPropsCount : avgScoreVal;
            const suffix = cardIdx === 0 ? '%' : cardIdx === 1 ? ' Listings' : '/100';
            return (
              <div
                key={card.label}
                data-anim="metric-card"
                className="rounded-xl border border-neutral-200 bg-[#FAFAFA] p-5 transition hover:border-neutral-300"
              >
                <p className="text-xs font-medium text-neutral-500">{card.label}</p>
                <p
                  data-anim="count-up"
                  data-target={targetVal}
                  data-suffix={suffix}
                  className="mt-1 text-3xl font-semibold tracking-tight text-[#111111]"
                >
                  {targetVal}
                  {suffix}
                </p>

                <div className="mt-6 flex h-20 items-end gap-1.5">
                  {card.bars.map((height, bIdx) => {
                    const isActive = hoveredBar.card === cardIdx && hoveredBar.bar === bIdx;
                    return (
                      <div
                        key={bIdx}
                        data-anim="stat-bar"
                        onMouseEnter={() => setHoveredBar({ card: cardIdx, bar: bIdx })}
                        onMouseLeave={() => setHoveredBar({ card: null, bar: null })}
                        style={{
                          height: `${height}%`,
                          transform: isActive ? 'scaleY(1.14)' : undefined,
                        }}
                        className={`flex-1 cursor-pointer border-t-2 border-[#111111] transition-colors duration-200 ${
                          isActive ? 'bg-[#111111]' : 'bg-neutral-200/80 hover:bg-neutral-300'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <div data-anim="stat-card">
            <StatCard
              title="Total Leads"
              value={
                <span data-anim="count-up" data-target={stats?.total_leads ?? 0}>
                  {stats?.total_leads ?? 0}
                </span>
              }
              subtitle={`Avg. Score: ${stats?.average_lead_score ?? 0}/100`}
              icon={Users}
              accent="blue"
            />
          </div>
          <div data-anim="stat-card">
            <StatCard
              title="Hot Leads"
              value={
                <span data-anim="count-up" data-target={stats?.hot_leads ?? 0}>
                  {stats?.hot_leads ?? 0}
                </span>
              }
              subtitle="Ready budget & clear intent"
              icon={Flame}
              accent="rose"
            />
          </div>
          <div data-anim="stat-card">
            <StatCard
              title="Active Listings"
              value={
                <span data-anim="count-up" data-target={stats?.total_properties ?? 0}>
                  {stats?.total_properties ?? 0}
                </span>
              }
              subtitle="Bangalore · Chennai · Hyderabad"
              icon={Building2}
              accent="emerald"
            />
          </div>
          <div data-anim="stat-card">
            <StatCard
              title="Pending Follow-ups"
              value={
                <span data-anim="count-up" data-target={stats?.pending_followups ?? 0}>
                  {stats?.pending_followups ?? 0}
                </span>
              }
              subtitle={`${stats?.completed_followups ?? 0} completed`}
              icon={CalendarClock}
              accent="amber"
            />
          </div>
        </div>
      </section>

      {/* 5. Collage Assembly ("Smart selection of premium real estate") */}
      <section
        data-anim="collage-section"
        onMouseMove={collageParallax.onMouseMove}
        onMouseLeave={collageParallax.onMouseLeave}
        className="grid grid-cols-1 items-center gap-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:p-10"
      >
        <div data-anim="collage-left" className="space-y-5 lg:col-span-6">
          <h2 className="text-3xl font-semibold tracking-tight text-[#111111] sm:text-4xl">
            Smart selection
            <br />
            of premium real estate
          </h2>
          <p className="max-w-md text-xs leading-relaxed text-neutral-500 sm:text-sm">
            We offer a curated selection of apartments and villas — each verified in our database
            and matched to your exact requirements by PropVoice AI.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/properties"
              className="rounded-lg bg-[#111111] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Explore properties
            </Link>
            <Link
              to="/voice-assistant"
              className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-xs font-semibold text-[#111111] transition hover:bg-neutral-100"
            >
              Get consultation
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-end gap-4 lg:col-span-6">
          <div
            data-anim="collage-photo"
            style={{
              transform: `translate3d(${(-collageParallax.offset.x * 0.85).toFixed(1)}px, ${(-collageParallax.offset.y * 0.85).toFixed(1)}px, 0)`,
            }}
            className="h-52 w-44 overflow-hidden rounded-xl border border-neutral-200 shadow-sm will-change-transform sm:h-60 sm:w-52"
          >
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=700&q=80"
              alt="Architectural exterior"
              className="h-full w-full object-cover"
            />
          </div>
          <div
            data-anim="collage-photo"
            style={{
              transform: `translate3d(${(collageParallax.offset.x * 0.6).toFixed(1)}px, ${(collageParallax.offset.y * 0.6).toFixed(1)}px, 0)`,
            }}
            className="-ml-8 mt-6 h-64 w-52 overflow-hidden rounded-xl border border-neutral-200 shadow-md will-change-transform sm:h-72 sm:w-64"
          >
            <img
              src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=700&q=80"
              alt="Luxury living space"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 6. Search + New Properties Grid */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2
              data-anim="headline"
              className="text-3xl font-semibold tracking-tight text-[#111111] sm:text-4xl"
            >
              We help you find the
              <br />
              home that will be yours
            </h2>
          </div>
          <div data-anim="subcopy" className="lg:col-span-5">
            <p className="max-w-md text-xs leading-relaxed text-neutral-500 sm:text-sm">
              Our curated projects across Bangalore, Chennai, and Hyderabad are backed by real-time
              database inventory and AI matching.
            </p>
          </div>
        </div>

        <div
          data-anim="search-card"
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4">
            {[
              { id: 'buy', label: 'Buy' },
              { id: 'rent', label: 'Rent' },
              { id: 'Ready to Move', label: 'Ready to move' },
              { id: 'Under Construction', label: 'New developments' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  fetchFilteredProperties({ tab: item.id });
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  tab === item.id
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-[#111111] transition focus:border-[#111111] focus:outline-none"
            >
              <option value="all">All cities</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Chennai">Chennai</option>
              <option value="Hyderabad">Hyderabad</option>
            </select>

            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-[#111111] transition focus:border-[#111111] focus:outline-none"
            >
              <option value="all">Any property type</option>
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
            </select>

            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-[#111111] transition focus:border-[#111111] focus:outline-none"
            >
              <option value="all">Any budget</option>
              <option value="under_80l">Under ₹80 Lakhs</option>
              <option value="80l_150l">₹80 Lakhs – ₹1.5 Cr</option>
              <option value="above_150l">Above ₹1.5 Cr</option>
            </select>

            <select
              value={bhk}
              onChange={(e) => setBhk(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-[#111111] transition focus:border-[#111111] focus:outline-none"
            >
              <option value="all">All sizes (BHK)</option>
              <option value="1 BHK">1 BHK</option>
              <option value="2 BHK">2 BHK</option>
              <option value="3 BHK">3 BHK</option>
              <option value="4 BHK">4 BHK</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/voice-assistant"
              className="text-xs font-semibold text-neutral-600 transition hover:text-[#111111]"
            >
              + Ask Voice AI for personalized matches
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-[#111111]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => fetchFilteredProperties()}
                className="rounded-lg bg-[#111111] px-5 py-2 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                Show properties
              </button>
            </div>
          </div>
        </div>

        <div
          data-anim="property-grid"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {properties.map((prop) => (
            <div key={prop.property_id} data-anim="property-card">
              <PropertyCard property={prop} onSelect={setSelectedProperty} />
            </div>
          ))}
        </div>
      </section>

      <PropertyModal property={selectedProperty} onClose={() => setSelectedProperty(null)} />
    </div>
  );
}
