import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Maximize2, Home, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../services/api';
import { InteractiveTilt } from './InteractiveTilt';
import { isMobileViewport, prefersReducedMotion } from '../motion';

export default function PropertyCard({ property, onSelect }) {
  const navigate = useNavigate();
  const enableSharedLayout = !prefersReducedMotion() && !isMobileViewport();

  const handleClick = () => {
    if (onSelect) {
      onSelect(property);
      return;
    }
    navigate(`/properties/${property.property_id}`, {
      state: { property, sharedPropertyTransition: true },
    });
  };
  const statusColors = {
    Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Limited: 'bg-amber-50 text-amber-700 border-amber-200',
    'Sold Out': 'bg-rose-50 text-rose-700 border-rose-200',
    Rented: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <InteractiveTilt maxTilt={4} scale={1.015} className="rounded-xl">
      <div
        onClick={handleClick}
        className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:border-neutral-300 hover:shadow-md"
      >
      <motion.div
        layoutId={enableSharedLayout ? `property-image-${property.property_id}` : undefined}
        className="relative h-44 w-full overflow-hidden bg-slate-100"
      >
        {property.image_url ? (
          <img
            src={property.image_url}
            alt={property.property_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Home className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-md bg-navy-900/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {property.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
          {property.is_demo && (
            <span className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy-900">
              Demo
            </span>
          )}
        </div>
        <span
          className={`absolute right-3 top-3 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            statusColors[property.availability_status] || statusColors.Available
          }`}
        >
          {property.availability_status}
        </span>
      </motion.div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-navy-900">
            {property.property_name}
          </h3>
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-brand-600" />
          <span>
            {property.location}, {property.city}
          </span>
        </p>

        <div className="mt-3 flex items-baseline justify-between border-t border-neutral-100 pt-3">
          <span className="text-lg font-bold text-[#111111]">
            {formatINR(property.price, property.listing_type)}
          </span>
          <span className="text-xs font-medium text-neutral-500">
            {property.possession_status}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 font-medium">
            <Home className="h-3.5 w-3.5 text-slate-400" />
            {property.bhk} {property.property_type}
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
            {property.area_sqft} sq.ft
          </span>
        </div>

        {property.amenities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {property.amenities.slice(0, 3).map((am) => (
              <span
                key={am}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                <CheckCircle2 className="h-3 w-3 text-brand-500" />
                {am}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                +{property.amenities.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
      </div>
    </InteractiveTilt>
  );
}
