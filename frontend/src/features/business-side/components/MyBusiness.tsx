import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { BusinessFilterDropdown } from "./BusinessFilterDropdown";
import { ROUTES } from '../../../routes/paths';
import BusinessCard from "../../dashboard/components/BusinessCard";
import EditListingModal from "./EditListingModal";
import type { Listing } from "../../Data/Listings";
import { supabase } from "../../../lib/supabase";
import SkeletonCard from "../../dashboard/components/SkeletonCard";
import { useAuth } from "../../../hooks/useAuth";

const MyBusiness = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [listings, setListings] = useState<Listing[]>([]);
    const [activeFilter, setActiveFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [savedToast, setSavedToast] = useState(false);

    // ─── Fetch user's listings ────────────────────────────────────────────────
    const fetchListings = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from("listings")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (fetchError) {
            setError("Failed to load your listings. Please try again.");
            console.error(fetchError);
        } else {
            const mapped: Listing[] = (data ?? []).map((row: any) => ({
                id: row.id,
                name: row.name,
                location: row.location,
                coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
                hours: row.hours,
                description: row.description,
                verified: row.verified,
                images: row.images ?? [],
                category: row.category,
                phone: row.phone,
                email: row.email,
                facebook: row.facebook,
                website: row.website,
            }));
            setListings(mapped);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchListings();
    }, [user?.id]);

    // ─── Edit ─────────────────────────────────────────────────────────────────
    const handleEditListing = (listing: Listing) => {
        setEditingListing(listing);
        setIsEditModalOpen(true);
    };

    const handleSaveListing = async (updatedListing: Partial<Listing>) => {
        if (!editingListing) return;

        const { error: updateError } = await supabase
            .from("listings")
            .update({
                name: updatedListing.name,
                location: updatedListing.location,
                lat: updatedListing.coordinates?.lat ?? (updatedListing as any).lat,
                lng: updatedListing.coordinates?.lng ?? (updatedListing as any).lng,
                hours: updatedListing.hours,
                description: updatedListing.description,
                images: updatedListing.images,
                category: updatedListing.category,
                phone: updatedListing.phone,
                email: updatedListing.email,
                facebook: updatedListing.facebook,
                website: updatedListing.website,
            })
            .eq("id", editingListing.id);

        if (updateError) {
            console.error("Failed to save listing:", updateError);
        } else {
            setListings((prev) =>
                prev.map((l) =>
                    l.id === editingListing.id ? { ...l, ...updatedListing } : l
                )
            );
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
        }

        setIsEditModalOpen(false);
        setEditingListing(null);
    };

    // ─── Delete ───────────────────────────────────────────────────────────────
    const handleDeleteListing = async (id: number) => {
        setDeletingId(id);

        const { error: deleteError } = await supabase
            .from("listings")
            .delete()
            .eq("id", id);

        if (deleteError) {
            console.error("Failed to delete listing:", deleteError);
        } else {
            setListings((prev) => prev.filter((l) => l.id !== id));
        }

        setDeletingId(null);
        setConfirmDeleteId(null);
    };

    const filteredListings = listings
        .filter(l => activeFilter === "All" || l.name === activeFilter)
        .filter(l => {
            if (statusFilter === "All") return true;
            if (statusFilter === "Approved") return l.verified === true;
            if (statusFilter === "Pending") return l.verified === false;
            return true;
        });

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="w-full h-full pb-10">
            <div className="px-4 md:px-6 py-4">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-0">
                    <div className="mb-4">
                        <h1 className="font-['Playfair_Display'] text-white text-2xl md:text-3xl font-semibold tracking-wide cursor-default">
                            My <span className="text-[#FFE2A0]">Business</span>
                        </h1>
                        <p className="text-white text-sm">Overview and management of your professional presence</p>
                    </div>

                    <BusinessFilterDropdown 
                        activeFilter={activeFilter} 
                        onFilterChange={setActiveFilter} 
                        listings={listings} 
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        onClick={() => navigate(ROUTES.LIST_BUSINESS)}
                        className="p-3 w-54 h-18 rounded-xl flex flex-row items-center gap-3 bg-[#5a5241] hover:bg-[#857657] border border-[#FFE2A0] text-[#fdfdfd] text-md tracking-wide cursor-pointer text-left transition-all shadow-lg active:scale-95"
                    >
                        <div className="p-3 h-12 w-12 flex justify-center items-center bg-[#474133] rounded-xl text-white">
                            <HiOutlineOfficeBuilding className="size-6" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold">List Business</span>
                            <span className="text-xs text-[#FFE2A0] opacity-80">Add your listing</span>
                        </div>
                    </button>
                </div>

                <div className="mt-12 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[#FFE2A0] text-xl font-['Playfair_Display'] font-semibold">Your Listings</h2>
                        {/* Summary counts */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 px-2 py-0.5 rounded-full font-medium">
                                {listings.filter(l => l.verified).length} Approved
                            </span>
                            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                                {listings.filter(l => !l.verified).length} Pending
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-row items-center gap-2 bg-[#3a3a3a] p-1.5 rounded-xl border border-[#4d4d4d] w-full sm:w-fit overflow-x-auto scrollbar-hide">
                        {["All", "Approved", "Pending"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                    statusFilter === status
                                        ? 'bg-[#FFE2A0] text-[#1a1a1a] shadow-md font-semibold'
                                        : 'text-white hover:bg-white/5'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* States */}
                {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
                    {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
                </div>
                )}
                {!loading && error && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <p className="text-red-400 text-sm">{error}</p>
                        <button
                            onClick={fetchListings}
                            className="px-4 py-2 bg-[#5a5241] border border-[#FFE2A0] text-[#FFE2A0] text-sm rounded-lg hover:bg-[#857657] transition-all"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && listings.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                        <div className="bg-[#474133] p-4 rounded-full border border-[#5a5241]">
                            <HiOutlineOfficeBuilding className="size-8 text-[#FFE2A0]" />
                        </div>
                        <p className="text-white font-semibold">No listings yet</p>
                        <p className="text-[#a0a0a0] text-sm">Click "List Business" to add your first listing.</p>
                    </div>
                )}

                {!loading && !error && listings.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6 items-stretch">
                        {filteredListings.map((listing) => (
                            <div key={listing.id} className="relative">

                                {/* ── Status badge ─────────────────────────── */}
                                {listing.verified ? (
                                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Approved
                                    </div>
                                ) : (
                                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                                        </svg>
                                        Pending Review
                                    </div>
                                )}

                                <BusinessCard
                                    listing={listing}
                                    isBusinessSide={true}
                                    isSelected={false}
                                    isSaved={false}
                                    onSelect={() => {}}
                                    onToggleSave={() => {}}
                                    onEdit={handleEditListing}
                                    onViewAnalytics={() => navigate(ROUTES.DASHBOARD_ANALYTICS)}
                                />



                                {/* ── Delete trigger button ─────────────────── */}
                                {confirmDeleteId !== listing.id && (
                                    <button
                                        onClick={() => setConfirmDeleteId(listing.id)}
                                        className="absolute top-3 right-3 z-20 p-2 bg-red-600 hover:bg-red-700 rounded-full text-white transition-all shadow-lg"
                                        title="Delete listing"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Save Toast ───────────────────────────────────────────────── */}
            {savedToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-[#1e1e1e] border border-[#FFE2A0]/30 text-white px-5 py-3 rounded-xl shadow-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#FFE2A0] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">Changes saved successfully</span>
                </div>
            )}

            <EditListingModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingListing(null);
                }}
                onSave={handleSaveListing}
                listing={editingListing}
            />

            {/* ── Global Delete Confirmation Modal ── */}
            {confirmDeleteId !== null && createPortal(
              <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#1A1A1A] border border-zinc-700/50 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center flex flex-col items-center gap-6">
                   <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-2">
                       <svg xmlns="http://www.w3.org/2000/svg" className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                   </div>
                   <div>
                       <h3 className="text-white font-['Playfair_Display'] font-bold text-2xl mb-2">Delete Listing?</h3>
                       <p className="text-[#FBFAF8]/60 text-sm leading-relaxed">
                           Are you sure you want to delete <span className="text-[#FFE2A0] font-semibold">"{listings.find(l => l.id === confirmDeleteId)?.name}"</span>? 
                           This action will permanently remove it from our directory.
                       </p>
                   </div>
                   <div className="flex gap-4 w-full">
                       <button
                           onClick={() => setConfirmDeleteId(null)}
                           className="flex-1 px-4 py-3 rounded-xl bg-[#2D2D2D] text-white text-sm font-semibold hover:bg-[#3D3D3D] transition-all border border-[#3A3A3A] cursor-pointer"
                       >
                           Cancel
                       </button>
                       <button
                           onClick={() => handleDeleteListing(confirmDeleteId)}
                           disabled={deletingId === confirmDeleteId}
                           className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-600/20 cursor-pointer"
                       >
                           {deletingId === confirmDeleteId ? "Deleting..." : "Confirm Delete"}
                       </button>
                   </div>
                </div>
              </div>,
              document.body
            )}
        </div>
    );
};

export default MyBusiness;