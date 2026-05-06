import { useState, useRef, useEffect } from "react";
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePhotograph } from "react-icons/hi";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";
import { BusinessFilterDropdown } from "./BusinessFilterDropdown";

interface GalleryImage {
    id: string;
    url: string;
    alt: string;
    addedDate: string;
    listingName: string;
    storagePath: string;
}

interface UserListing {
    id: number;
    name: string;
}

const Gallery = () => {
    const { user } = useAuth();
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [userListings, setUserListings] = useState<UserListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>("All");
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [isAddingPhoto, setIsAddingPhoto] = useState(false);
    const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch user's listings
    useEffect(() => {
        if (!user?.id) return;
        const fetchListings = async () => {
            const { data } = await supabase
                .from("listings")
                .select("id, name")
                .eq("user_id", user.id);
            if (data && data.length > 0) {
                setUserListings(data);
                setSelectedListingId(data[0].id);
            }
        };
        fetchListings();
    }, [user?.id]);

    // Fetch gallery images scoped to user's listings
    useEffect(() => {
        if (!user?.id) return;
        const fetchImages = async () => {
            setLoading(true);
            const { data: listings } = await supabase
                .from("listings")
                .select("id")
                .eq("user_id", user.id);

            if (!listings || listings.length === 0) {
                setLoading(false);
                return;
            }

            const listingIds = listings.map((l) => l.id);
            const { data } = await supabase
                .from("gallery_images")
                .select("*")
                .in("listing_id", listingIds)
                .order("added_date", { ascending: false });

            if (data) {
                setImages(data.map((row) => ({
                    id: row.id,
                    url: row.url,
                    alt: row.alt ?? "",
                    addedDate: new Date(row.added_date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                    listingName: row.listing_name,
                    storagePath: row.storage_path,
                })));
            }
            setLoading(false);
        };
        fetchImages();
    }, [user?.id]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedListingId) return;

        setUploading(true);
        const selectedListing = userListings.find((l) => l.id === selectedListingId);
        const storagePath = `${user!.id}/${selectedListingId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from("gallery-images")
            .upload(storagePath, file);

        if (uploadError) {
            console.error("Upload failed:", uploadError);
            setUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage
            .from("gallery-images")
            .getPublicUrl(storagePath);

        const { data: inserted, error: insertError } = await supabase
            .from("gallery_images")
            .insert({
                url: urlData.publicUrl,
                alt: file.name,
                listing_id: selectedListingId,
                listing_name: selectedListing?.name ?? "",
                storage_path: storagePath,
            })
            .select()
            .single();

        if (!insertError && inserted) {
            setImages((prev) => [{
                id: inserted.id,
                url: inserted.url,
                alt: inserted.alt ?? "",
                addedDate: new Date(inserted.added_date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                listingName: inserted.listing_name,
                storagePath: inserted.storage_path,
            }, ...prev]);
        }

        setUploading(false);
        setIsAddingPhoto(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDelete = async (e: React.MouseEvent, image: GalleryImage) => {
        e.stopPropagation();

        await supabase.storage.from("gallery-images").remove([image.storagePath]);
        await supabase.from("gallery_images").delete().eq("id", image.id);
        setImages((prev) => prev.filter((img) => img.id !== image.id));
    };

    const filteredImages = activeFilter === "All"
        ? images
        : images.filter((img) => img.listingName === activeFilter);

    const filterOptions = ["All", ...userListings.map((l) => l.name)];

    return (
        <div className="w-full h-full pb-10">
            {/* Header */}
            <div className="px-4 md:px-6 py-4">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-0">
                    <div className="mb-2">
                        <h1 className="font-['Playfair_Display'] text-white text-2xl md:text-3xl font-semibold tracking-wide cursor-default">
                            Business <span className="text-[#FFE2A0]">Gallery</span>
                        </h1>
                        <p className="text-white text-sm">Organize your visuals by business branch</p>
                    </div>

                    <BusinessFilterDropdown 
                        activeFilter={activeFilter} 
                        onFilterChange={setActiveFilter} 
                        listings={userListings} 
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        onClick={() => setIsAddingPhoto(true)}
                        disabled={userListings.length === 0}
                        className="p-3 w-54 h-18 rounded-xl flex flex-row items-center gap-3 bg-[#5a5241] hover:bg-[#857657] border border-[#FFE2A0] text-[#fdfdfd] text-md tracking-wide cursor-pointer text-left transition-all shadow-lg active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="p-3 h-12 w-12 flex justify-center items-center bg-[#474133] rounded-xl group-hover:scale-105 transition-transform shrink-0">
                            <HiOutlinePlus className="size-6 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm">Add Photos</span>
                            <span className="text-[#FFE2A0] text-[10px] opacity-80">Update gallery</span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="px-4 md:px-6 py-6">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[0,1,2,3,4,5,6,7].map(i => (
                        <div
                            key={i}
                            className="aspect-square bg-[#2e2e2e] animate-pulse rounded-2xl border border-[#3a3a3a]"
                        />
                        ))}
                    </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredImages.map((image) => (
                            <div
                                key={image.id}
                                onClick={() => setSelectedImage(image)}
                                className="group relative aspect-square bg-[#3a3a3a] border border-[#4d4d4d] rounded-2xl overflow-hidden shadow-lg hover:border-[#FFE2A0]/40 transition-all cursor-zoom-in"
                            >
                                <img
                                    src={image.url}
                                    alt={image.alt}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute top-4 right-4 flex gap-2 translate-y-[-10px] group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    <button
                                        onClick={(e) => handleDelete(e, image)}
                                        className="p-2 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg cursor-pointer"
                                        title="Delete Photo"
                                    >
                                        <HiOutlineTrash className="size-5" />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 translate-y-[20px] group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 text-left">
                                    <p className="text-white text-[10px] uppercase tracking-widest font-bold mb-1 opacity-60">{image.listingName}</p>
                                    <p className="text-[#FFE2A0] text-[10px] font-medium opacity-90">Added on {image.addedDate}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredImages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="bg-[#474133] p-6 rounded-full border border-[#5a5241]">
                            <HiOutlinePhotograph className="size-12 text-[#FFE2A0] opacity-20" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-white text-lg font-semibold font-['Playfair_Display'] tracking-wide">
                                {userListings.length === 0 ? "No listings yet" : "Category is Empty"}
                            </h3>
                            <p className="text-[#a0a0a0] text-sm max-w-xs mx-auto">
                                {userListings.length === 0
                                    ? "Add a listing first before uploading gallery images."
                                    : <>No images found for <span className="text-[#FFE2A0]">{activeFilter}</span>.</>}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Photo Modal */}
            {isAddingPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="space-y-1 text-center">
                            <h3 className="text-white text-2xl font-['Playfair_Display'] font-semibold tracking-wide">Add New Image</h3>
                            <p className="text-[#a0a0a0] text-sm">Select which business this photo represents</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[#FFE2A0] text-xs font-bold uppercase tracking-widest px-1">Select Business</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {userListings.map((listing) => (
                                        <button
                                            key={listing.id}
                                            onClick={() => setSelectedListingId(listing.id)}
                                            className={`w-full p-4 rounded-xl text-left transition-all border ${
                                                selectedListingId === listing.id
                                                    ? 'bg-[#474133] border-[#FFE2A0] text-white shadow-inner'
                                                    : 'bg-[#333333] border-[#444444] text-[#a0a0a0] hover:bg-[#3a3a3a]'
                                            }`}
                                        >
                                            {listing.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-4 bg-[#FFE2A0] text-[#1a1a1a] rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg cursor-pointer disabled:opacity-50"
                            >
                                {uploading ? "Uploading..." : "Select Image from Device"}
                            </button>

                            <button
                                onClick={() => setIsAddingPhoto(false)}
                                className="w-full py-2 text-[#a0a0a0] hover:text-white transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer z-10"
                        onClick={() => setSelectedImage(null)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div
                        className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={selectedImage.url}
                            alt={selectedImage.alt}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                        />
                        <div className="text-center space-y-1">
                            <p className="text-white text-xs uppercase tracking-[0.2em] font-bold opacity-60">{selectedImage.listingName}</p>
                            <p className="text-[#FFE2A0] text-sm opacity-90 uppercase tracking-widest font-medium">Added on {selectedImage.addedDate}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;