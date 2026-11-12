import React, { useEffect, useState } from 'react';
import { X, MapPin, Home, Maximize2, CheckCircle2, Calendar } from 'lucide-react';
import { followupsApi, formatINR, leadsApi } from '../services/api';
import TimeSelect, { formatTime24To12 } from './TimeSelect';

function getLocalTomorrowDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function PropertyModal({ property, onClose }) {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [visitDate, setVisitDate] = useState(getLocalTomorrowDate);
  const [visitTime, setVisitTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    setShowBookingForm(false);
    setBookingError('');
    setBookingSuccess(false);
  }, [property?.property_id]);

  if (!property) return null;

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

  return (
    <div
      data-lenis-prevent
      data-lenis-prevent-wheel
      data-lenis-prevent-touch
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
    >
      <div
        data-lenis-prevent
        data-lenis-prevent-wheel
        data-lenis-prevent-touch
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white hover:text-navy-900"
          aria-label="Close property details"
        >
          <X className="h-5 w-5" />
        </button>

        {property.image_url && (
          <div className="h-64 w-full overflow-hidden bg-slate-100">
            <img
              src={property.image_url}
              alt={property.property_name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-navy-900 px-2.5 py-1 text-xs font-semibold uppercase text-white">
              {property.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </span>
            <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {property.possession_status}
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {property.availability_status}
            </span>
            {property.is_demo && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Sample Demo Listing
              </span>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-bold text-navy-900">{property.property_name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 text-brand-600" />
            {property.location}, {property.city}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Price</p>
              <p className="mt-0.5 text-lg font-extrabold text-brand-600">
                {formatINR(property.price, property.listing_type)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Configuration</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-navy-900">
                <Home className="h-4 w-4 text-slate-400" />
                {property.bhk} {property.property_type}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Built-up Area</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-navy-900">
                <Maximize2 className="h-4 w-4 text-slate-400" />
                {property.area_sqft} sq.ft
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Description
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{property.description}</p>
          </div>

          {property.amenities?.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Amenities
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {property.amenities.map((am) => (
                  <span
                    key={am}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
                    {am}
                  </span>
                ))}
              </div>
            </div>
          )}

          {bookingSuccess && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Booking confirmed for <strong>{property.property_name}</strong>! Your site visit has been added to Follow-ups.
              </span>
            </div>
          )}

          {showBookingForm && (
            <form
              onSubmit={handleBookSubmit}
              className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  Book {property.property_name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="text-xs font-medium text-slate-500 hover:text-navy-900"
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Phone Number *"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Visit Date</label>
                  <input
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Visit Time</label>
                  <TimeSelect value={visitTime} onChange={setVisitTime} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Property ID: {property.property_id}
            </span>
            <div className="flex items-center gap-2">
              {!showBookingForm && !bookingSuccess && (
                <button
                  type="button"
                  onClick={() => setShowBookingForm(true)}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  Book Now
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
