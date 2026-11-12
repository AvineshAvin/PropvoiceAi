import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal, X } from 'lucide-react';
import PropertyCard from '../components/PropertyCard';
import PropertyModal from '../components/PropertyModal';
import { Reveal, StaggerGroup } from '../motion';
import { propertiesApi } from '../services/api';

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    city: searchParams.get('city') || 'all',
    bhk: searchParams.get('bhk') || 'all',
    property_type: searchParams.get('property_type') || 'all',
    listing_type: searchParams.get('listing_type') || 'all',
    max_price: searchParams.get('max_price') || '',
    sort_by: 'price_asc',
  });

  useEffect(() => {
    const cityParam = searchParams.get('city');
    const bhkParam = searchParams.get('bhk');
    const typeParam = searchParams.get('property_type');
    const listingParam = searchParams.get('listing_type');
    const maxParam = searchParams.get('max_price');
    if (cityParam || bhkParam || typeParam || listingParam || maxParam) {
      setFilters((prev) => ({
        ...prev,
        city: cityParam || 'all',
        bhk: bhkParam || 'all',
        property_type: typeParam || 'all',
        listing_type: listingParam || 'all',
        max_price: maxParam || '',
      }));
    }
  }, [searchParams]);

  const [newProp, setNewProp] = useState({
    property_name: '',
    city: 'Bangalore',
    location: '',
    property_type: 'Apartment',
    listing_type: 'buy',
    bhk: '2 BHK',
    price: '',
    area_sqft: '',
    amenities: 'Clubhouse, Gym, 24/7 Security',
    description: '',
    possession_status: 'Ready to Move',
    availability_status: 'Available',
    image_url: '',
  });

  const fetchProperties = useCallback(() => {
    setLoading(true);
    const params = {
      sort_by: filters.sort_by,
      ...(filters.search && { search: filters.search }),
      ...(filters.city !== 'all' && { city: filters.city }),
      ...(filters.bhk !== 'all' && { bhk: filters.bhk }),
      ...(filters.property_type !== 'all' && { property_type: filters.property_type }),
      ...(filters.listing_type !== 'all' && { listing_type: filters.listing_type }),
      ...(filters.max_price && { max_price: Number(filters.max_price) }),
    };
    propertiesApi
      .list(params)
      .then(setProperties)
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    try {
      await propertiesApi.create({
        ...newProp,
        price: Number(newProp.price),
        area_sqft: Number(newProp.area_sqft),
        amenities: newProp.amenities
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        is_demo: false,
      });
      setShowAddModal(false);
      fetchProperties();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to add property');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Reveal>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <SlidersHorizontal className="h-4 w-4 text-brand-600" />
            <span>Search &amp; Filter Properties</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {properties.length} results
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Property
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search city, location, or project..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <select
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All Cities</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Chennai">Chennai</option>
            <option value="Hyderabad">Hyderabad</option>
          </select>

          <select
            value={filters.bhk}
            onChange={(e) => setFilters({ ...filters, bhk: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All BHK</option>
            <option value="1 BHK">1 BHK</option>
            <option value="2 BHK">2 BHK</option>
            <option value="3 BHK">3 BHK</option>
            <option value="4 BHK">4 BHK</option>
          </select>

          <select
            value={filters.property_type}
            onChange={(e) => setFilters({ ...filters, property_type: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
          </select>

          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="area_desc">Area: Largest First</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={filters.listing_type}
            onChange={(e) => setFilters({ ...filters, listing_type: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium focus:border-brand-500 focus:outline-none"
          >
            <option value="all">Buy &amp; Rent</option>
            <option value="buy">For Sale (Buy)</option>
            <option value="rent">For Rent</option>
          </select>

          <input
            type="number"
            placeholder="Max Budget (INR, e.g. 8000000)"
            value={filters.max_price}
            onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
            className="w-60 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
          />
        </div>
        </div>
      </Reveal>

      {/* Property Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-600">
            No properties matched your selected filters.
          </p>
        </div>
      ) : (
        <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((prop) => (
            <PropertyCard key={prop.property_id} property={prop} />
          ))}
        </StaggerGroup>
      )}

      <PropertyModal property={selected} onClose={() => setSelected(null)} />

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-navy-900">Add New Property Listing</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProperty} className="mt-4 space-y-3">
              <input
                required
                placeholder="Property Name"
                value={newProp.property_name}
                onChange={(e) => setNewProp({ ...newProp, property_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newProp.city}
                  onChange={(e) => setNewProp({ ...newProp, city: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Bangalore">Bangalore</option>
                  <option value="Chennai">Chennai</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
                <input
                  required
                  placeholder="Location (e.g. Whitefield)"
                  value={newProp.location}
                  onChange={(e) => setNewProp({ ...newProp, location: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={newProp.listing_type}
                  onChange={(e) => setNewProp({ ...newProp, listing_type: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                </select>
                <select
                  value={newProp.property_type}
                  onChange={(e) => setNewProp({ ...newProp, property_type: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Apartment">Apartment</option>
                  <option value="Villa">Villa</option>
                </select>
                <input
                  required
                  placeholder="BHK (e.g. 2 BHK)"
                  value={newProp.bhk}
                  onChange={(e) => setNewProp({ ...newProp, bhk: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  placeholder="Price in INR"
                  value={newProp.price}
                  onChange={(e) => setNewProp({ ...newProp, price: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  placeholder="Area (sq.ft)"
                  value={newProp.area_sqft}
                  onChange={(e) => setNewProp({ ...newProp, area_sqft: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Amenities (comma-separated)"
                value={newProp.amenities}
                onChange={(e) => setNewProp({ ...newProp, amenities: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={3}
                placeholder="Property description..."
                value={newProp.description}
                onChange={(e) => setNewProp({ ...newProp, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
