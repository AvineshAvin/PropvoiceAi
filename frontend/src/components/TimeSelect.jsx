import React, { useEffect, useRef, useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

export function formatTime24To12(time24) {
  if (!time24 || !time24.includes(':')) return '11:00 AM';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export const ALL_TIME_SLOTS = Array.from({ length: 48 }, (_, idx) => {
  const hour = Math.floor(idx / 2);
  const min = idx % 2 === 0 ? '00' : '30';
  const value = `${String(hour).padStart(2, '0')}:${min}`;
  return { value, label: formatTime24To12(value) };
});

export default function TimeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-xs text-neutral-900 focus:border-[#111111] focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-neutral-400" />
          {formatTime24To12(value)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </button>

      {open && (
        <div
          data-lenis-prevent
          data-lenis-prevent-wheel
          data-lenis-prevent-touch
          className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-100 p-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Custom Exact Time
            </label>
            <input
              type="time"
              value={value}
              onChange={(e) => {
                if (e.target.value) onChange(e.target.value);
              }}
              className="w-full rounded-md border border-neutral-200 px-2 py-1 text-xs focus:border-[#111111] focus:outline-none"
            />
          </div>
          <div
            data-lenis-prevent
            data-lenis-prevent-wheel
            data-lenis-prevent-touch
            className="max-h-48 overflow-y-auto py-1"
          >
            {ALL_TIME_SLOTS.map((slot) => {
              const selected = slot.value === value;
              return (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => {
                    onChange(slot.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs transition ${
                    selected
                      ? 'bg-[#111111] font-semibold text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
