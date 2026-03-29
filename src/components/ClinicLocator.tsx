import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Phone, 
  Globe, 
  Clock, 
  Star, 
  Loader2, 
  ExternalLink,
  Map as MapIcon,
  AlertCircle,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getMapsGroundingResponse } from '@/services/gemini';
import { toast } from 'sonner';

export function ClinicLocator() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{ text: string; sources: any[] } | null>(null);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [needsKey, setNeedsKey] = useState(false);

  const detectLocation = () => {
    if (navigator.geolocation) {
      setLocationStatus('detecting');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationStatus('success');
          toast.success("Location detected successfully!");
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationStatus('error');
          toast.error("Could not detect location. Please search manually.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationStatus('error');
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setResult(null);
    setSelectedPlace(null);
    setNeedsKey(false);

    try {
      const response = await getMapsGroundingResponse(query, location || undefined);
      setResult(response);
    } catch (error: any) {
      console.error("Maps search error:", error);
      const isFetchError = error.message?.includes("fetch") || error.message?.includes("NetworkError");
      
      if (error.message === "GEMINI_API_KEY_MISSING" || error.message === "API_KEY_MISSING" || error.message === "API_KEY_DENIED") {
        setNeedsKey(true);
        setResult({ text: "⚠️ **Gemini API Key is missing or denied.**\n\nPlease select a valid API key with Google Maps permissions to use this feature.", sources: [] });
      } else if (error.message === "QUOTA_EXCEEDED" || isFetchError) {
        const msg = isFetchError 
          ? "⚠️ **Network Error.**\n\nThe connection to the AI server failed. This might be due to high traffic or a temporary outage."
          : "⚠️ **AI Quota Exceeded.**\n\nThe AI is currently busy handling many requests.";
          
        setResult({ 
          text: `${msg}\n\nYou can wait 30 seconds and try again, or search directly on Google Maps using the button below.`, 
          sources: [{ maps: { title: "Search directly on Google Maps", address: query, uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` } }] 
        });
      } else {
        setResult({ 
          text: `Error: ${error.message || "Error performing maps search. Please try again."}`, 
          sources: [{ maps: { title: "Search directly on Google Maps", address: query, uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` } }] 
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Clinic & Specialist Locator</h1>
        <p className="text-zinc-400 mt-2">Find nearby medical facilities, specialized clinics, and healthcare providers with Google Maps grounding.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-sm space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Search Query</label>
                <button 
                  onClick={detectLocation}
                  className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-md transition-all flex items-center gap-1",
                    locationStatus === 'success' ? "bg-emerald-500/10 text-emerald-500" :
                    locationStatus === 'detecting' ? "bg-amber-500/10 text-amber-500 animate-pulse" :
                    locationStatus === 'error' ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  <MapPin size={10} />
                  {locationStatus === 'success' ? "Location On" :
                   locationStatus === 'detecting' ? "Detecting..." :
                   locationStatus === 'error' ? "Location Off" : "Detect Location"}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., Cardiology clinics nearby..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <button
                  onClick={handleSearch}
                  disabled={!query.trim() || isSearching}
                  className="absolute right-2 top-2 bottom-2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                >
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your Location</p>
                <p className="text-sm font-bold text-zinc-100 truncate">
                  {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 
                   locationStatus === 'detecting' ? 'Detecting location...' :
                   locationStatus === 'error' ? 'Location access denied' : 'Location not detected'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Popular Searches</h3>
              <div className="flex flex-wrap gap-2">
                {['Emergency Room', 'Pharmacy', 'Pediatrician', 'Diagnostic Center'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-3xl text-zinc-100 border border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500 rounded-xl">
                <Navigation size={20} className="text-white" />
              </div>
              <h3 className="font-bold">Smart Referrals</h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Use this tool to find the best specialists for your patients based on proximity, ratings, and clinical expertise.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm leading-relaxed text-zinc-300">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest mb-4">
                    {needsKey && (
                      <button 
                        onClick={handleOpenKeyDialog}
                        className="mr-4 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Key size={12} />
                        Fix API Key
                      </button>
                    )}
                    {(result.text.includes("Quota Exceeded") || result.text.includes("Network Error")) && (
                      <button 
                        onClick={handleSearch}
                        className="mr-4 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-bold hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Loader2 size={12} className={isSearching ? "animate-spin" : ""} />
                        Retry Search
                      </button>
                    )}
                    <MapIcon size={14} />
                    MAPS GROUNDED RESULTS
                  </div>
                  <div className="prose prose-invert max-w-none mb-8">
                    <p className="text-lg font-medium text-zinc-100 leading-relaxed">{result.text}</p>
                  </div>

                  {selectedPlace && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-8 rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-950"
                    >
                      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                          <MapIcon size={16} className="text-emerald-500" />
                          <span className="text-sm font-bold text-zinc-100">{selectedPlace}</span>
                        </div>
                        <button 
                          onClick={() => setSelectedPlace(null)}
                          className="text-xs font-bold text-zinc-500 hover:text-zinc-300"
                        >
                          Close Map
                        </button>
                      </div>
                      <iframe
                        width="100%"
                        height="400"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedPlace)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                      ></iframe>
                    </motion.div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {result.sources.map((source: any, i: number) => {
                      const mapData = source.maps || {};
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all group flex flex-col"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                              <MapPin size={20} />
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                              <Star size={14} fill="currentColor" />
                              <span className="text-xs font-bold">4.8</span>
                            </div>
                          </div>
                          
                          <h4 className="text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors mb-3">
                            {mapData.title || 'Medical Facility'}
                          </h4>
                          
                          <div className="space-y-3 mb-6 flex-grow">
                            <div className="flex items-start gap-3 text-sm text-zinc-400">
                              <MapPin size={16} className="mt-0.5 shrink-0 text-zinc-600" />
                              <span className="line-clamp-2">{mapData.address || 'Address available on map'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                              <Clock size={16} className="shrink-0 text-zinc-600" />
                              <span>Open • Closes 8:00 PM</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                              <Phone size={16} className="shrink-0 text-zinc-600" />
                              <span>+1 (555) 000-0000</span>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4 border-t border-zinc-800/50">
                            <button
                              onClick={() => setSelectedPlace(mapData.title || mapData.address)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            >
                              <MapIcon size={16} />
                              View on Map
                            </button>
                            <a
                              href={mapData.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 transition-all"
                              title="Get Directions"
                            >
                              <Navigation size={18} />
                            </a>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : isSearching ? (
              <div className="bg-zinc-950 p-12 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-4 text-center h-full min-h-[500px]">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-zinc-100 font-bold">Querying Google Maps...</p>
                  <p className="text-zinc-500 text-sm mt-1">Finding the best healthcare providers in your vicinity.</p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950 p-12 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-4 text-center h-full min-h-[500px]">
                <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700">
                  <MapIcon size={40} />
                </div>
                <div>
                  <p className="text-zinc-100 font-bold text-xl">Find Medical Facilities</p>
                  <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
                    Use the search bar to find hospitals, clinics, or specialists. AI will provide recommendations based on your location.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

  );
}
