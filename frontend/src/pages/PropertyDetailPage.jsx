import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Home, Maximize2, CheckCircle2, Calendar, Mic } from 'lucide-react';
import { followupsApi, formatINR, leadsApi, propertiesApi } from '../services/api';
import { MOTION_CONFIG, isMobileViewport, prefersReducedMotion } from '../motion';
import TimeSelect, { formatTime24To12 } from '../components/TimeSelect';

function getLocalTomorrowDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function PropertyDetailPage() {
  const { propertyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [property, setProperty] = useState(location.state?.property || null);
  const [loading, setLoading] = useState(!location.state?.property);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [visitDate, setVisitDate] = useState(getLocalTomorrowDate);
  const [visitTime, setVisitTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const enableSharedLayout = !prefersReducedMotion() && !isMobileViewport();

  useEffect(() => {
    setShowBookingForm(false);
    setBookingError('');
    setBookingSuccess(false);
  }, [propertyId]);

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !phoneNumber.trim()) {
      setBookingError('Please enter your name and phone number.');
      return;
    }
    setSubmitting(true);
    setBookingError('');
    const timeLabel = formatTime24To12(visitTime);
    const scheduledIso = `${visitDate}T${visitTime}:00`;
    try {
      const lead = await leadsApi.create({
        customer_name: customerName.trim(),
        phone_number: phoneNumber.trim(),
        intent: property.listing_type || 'buy',
        city: property.city,
        location: property.location,
        property_type: property.property_type,
        bhk: property.bhk,
        budget_max: property.price,
        preferred_site_visit: `${visitDate} at ${timeLabel}`,
        notes: notes.trim() || `Interested in ${property.property_name} (${property.property_id})`,
      });
      await followupsApi.create({
        lead_id: lead.lead_id,
        task_type: 'Site Visit',
        scheduled_at: scheduledIso,
        notes: `Booked ${property.property_name} (${property.property_id}) at ${timeLabel}${notes.trim() ? ` — ${notes.trim()}` : ''}`,
      });
      setBookingSuccess(true);
      setShowBookingForm(false);
    } catch (err) {
      setBookingError(err?.response?.data?.detail || 'Could not complete booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!property && propertyId) {
      setLoading(true);
      propertiesApi
        .get(propertyId)
        .then(setProperty)
        .catch(() => setProperty(null))
        .finally(() => setLoading(false));
    }
  }, [propertyId, property]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-80 animate-pulse rounded-2xl bg-neutral-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-neutral-700">Property not found.</p>
        <button
          type="button"
          onClick={() => navigate('/properties')}
          className="mt-4 rounded-lg bg-[#111111] px-4 py-2 text-xs font-semibold text-white"
        >
          Back to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] transition hover:bg-neutral-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to listings
      </button>

      {/* Shared-Element Hero Image */}
      <motion.div
        layoutId={enableSharedLayout ? `property-image-${property.property_id}` : undefined}
        transition={{ duration: 0.55, ease: MOTION_CONFIG.revealEase }}
        className="h-72 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm sm:h-[420px]"
      >
        {property.image_url ? (
          <img
            src={property.image_url}
            alt={property.property_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            <Home className="h-12 w-12" />
          </div>
        )}
      </motion.div>

      {/* Rest of page fades in after shared-element settles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.25, ease: MOTION_CONFIG.revealEase }}
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#111111] px-2.5 py-1 text-xs font-semibold uppercase text-white">
            {property.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
          <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
            {property.possession_status}
          </span>
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {property.availability_status}
          </span>
          {property.is_demo && (
            <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              Sample Demo Listing
            </span>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#111111] sm:text-3xl">
          {property.property_name}
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-500">
          <MapPin className="h-4 w-4 text-[#111111]" />
          {property.location}, {property.city}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-[#FAFAFA] p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-neutral-500">Price</p>
            <p className="mt-1 text-xl font-bold text-[#111111]">
              {formatINR(property.price, property.listing_type)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Configuration</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#111111]">
              <Home className="h-4 w-4 text-neutral-400" />
              {property.bhk} {property.property_type}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Built-up Area</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#111111]">
              <Maximize2 className="h-4 w-4 text-neutral-400" />
              {property.area_sqft} sq.ft
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Description
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">{property.description}</p>
        </div>

        {property.amenities?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Amenities
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {property.amenities.map((am) => (
                <span
                  key={am}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#111111]" />
                  {am}
                </span>
              ))}
            </div>
          </div>
        )}

        {bookingSuccess && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Booking confirmed for <strong>{property.property_name}</strong>! Your site visit has been added to Follow-ups.
            </span>
          </div>
        )}

        {showBookingForm && (
          <form
            onSubmit={handleBookSubmit}
            className="mt-6 space-y-3 rounded-xl border border-neutral-200 bg-[#FAFAFA] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                Book {property.property_name}
              </h3>
              <button
                type="button"
                onClick={() => setShowBookingForm(false)}
                className="text-xs font-medium text-neutral-500 hover:text-[#111111]"
              >
                Cancel
              </button>
            </div>
            {bookingError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {bookingError}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your Name *"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs focus:border-[#111111] focus:outline-none"
              />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone Number *"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs focus:border-[#111111] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-500">Visit Date</label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs focus:border-[#111111] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-500">Visit Time</label>
                <TimeSelect value={visitTime} onChange={setVisitTime} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-500">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs focus:border-[#111111] focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#111111] px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </form>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Calendar className="h-3.5 w-3.5" />
            Property ID: {property.property_id}
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            {!showBookingForm && !bookingSuccess && (
              <button
                type="button"
                onClick={() => setShowBookingForm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#111111] bg-white px-4 py-2 text-xs font-semibold text-[#111111] transition hover:bg-neutral-100"
              >
                <Calendar className="h-3.5 w-3.5" />
                Book Now
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/voice-assistant')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              <Mic className="h-3.5 w-3.5" />
              Inquire via Voice AI
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
