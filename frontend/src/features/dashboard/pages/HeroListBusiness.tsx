import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes/paths';

const HeroListBusiness = () => {

    const navigate = useNavigate();

    return (
        <div className="relative bg-[#1A1A1A] min-h-screen overflow-hidden flex flex-col items-center">
            
            {/* Grid Background */}
            <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ 
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", 
                    backgroundSize: "60px 60px" 
                }} 
            />

            {/* Glowing Background Blob */}
            <div
                className="absolute top-0 rounded-full blur-3xl opacity-60 pointer-events-none"
                style={{
                    width: '760px',
                    height: '680px',
                    left: '50%',
                    transform: 'translate(-50%, -70%)',
                    background: 'radial-gradient(circle, rgba(255,226,160,0.8) 0%, rgba(255,226,160,0.2) 50%, transparent 70%)',
                }}
            />

            <div className="relative z-10 flex flex-col items-center text-center py-16 lg:py-24 px-6 sm:px-10 w-full max-w-5xl">

                <div className="w-full flex justify-start mb-8">
                    <button
                        onClick={() => navigate(ROUTES.HOME)}
                        className="flex items-center gap-2 text-[#FBFAF8]/50 hover:text-[#FBFAF8] text-sm cursor-pointer transition-colors"
                    >
                    ← Back to Main
                    </button>
                </div>
                
                <div className="flex items-center space-x-3 px-4 py-2 rounded-full border border-[#FFE2A0] bg-yellow-400/20 w-fit mb-8">
                    <span className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></span>
                    <span className="text-sm font-semibold uppercase tracking-wide text-yellow-300/90 text-xs sm:text-sm text-center">
                        Local Discovery Platform
                    </span>
                </div>

                <h1 className="text-white font-['Playfair_Display'] font-semibold text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight max-w-3xl">
                    Put Your Business on <br className="hidden sm:block" />
                    <span className="text-[#f8cd68]">the Map</span>
                </h1>

                <p className="text-base sm:text-lg max-w-[500px] w-full text-[#bdae8d] mt-6 leading-relaxed">
                    Join thousands of verified local businesses. Reach customers who are actively searching for what you offer.
                </p>
                
                {/* Statistics Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12 mt-12 w-full max-w-4xl">
                    
                    {/* Item 1 */}
                    <div className="flex flex-col items-center p-4">
                        <span className="text-[#FFE2A0] font-['Playfair_Display'] text-3xl lg:text-4xl font-bold mb-2">
                            12K+
                        </span>
                        <span className="text-blue-200/40 text-xs font-normal tracking-wide uppercase">
                            Listed Businesses
                        </span>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col items-center border-y sm:border-y-0 sm:border-x border-white/5 p-4">
                        <span className="text-[#FFE2A0] font-['Playfair_Display'] text-3xl lg:text-4xl font-bold mb-2">
                            98%
                        </span>
                        <span className="text-blue-200/40 text-xs font-normal tracking-wide uppercase">
                            Approval Rate
                        </span>
                    </div>

                    {/* Item 3 */}
                    <div className="flex flex-col items-center p-4">
                        <span className="text-[#FFE2A0] font-['Playfair_Display'] text-3xl lg:text-4xl font-bold mb-2">
                            24hr
                        </span>
                        <span className="text-blue-200/40 text-xs font-normal tracking-wide uppercase">
                            Review Time
                        </span>
                    </div>
                    
                </div>

                {/*List Business Button*/}
                <div className="w-full flex justify-center px-4 mt-6">
                    <button 
                        onClick={() => navigate(ROUTES.BUSINESS_REGISTER)}
                        className="w-full max-w-[320px] py-4 flex justify-center gap-3 items-center bg-[#eec76c] text-[#222222] text-lg font-bold tracking-wide rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(238,199,108,0.4)] hover:shadow-[0_0_30px_rgba(238,199,108,0.6)]"
                    >  
                        Create an Account 
                    </button>
                </div>

                <div className="flex justify-center items-center mt-5 gap-2 px-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 text-blue-200/40">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <p className="text-blue-200/40 text-xs sm:text-sm">Free to list · Verified & trusted</p>
                </div>

                {/* Verification Features Section */}
                <div className="mt-12 px-4 w-full max-w-3xl pb-16">
                    {/* Flex Container: Handles Centering and Wrapping */}
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                        {/* Feature Pill (Reusable) */}
                        {[
                        "DTI / Mayor's Permit",
                        "ID Verification",
                        "OTP Confirmation",
                        "Map Pinning",
                        "24-48hr Review"
                        ].map((feature, index) => (
                        <div 
                            key={index} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e2229] border border-white/5 shadow-inner"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                strokeWidth="2.5" 
                                stroke="currentColor" 
                                className="size-4 text-[#dac594]"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            <span className="text-[11px] sm:text-xs font-normal text-[#dac594] tracking-wide">
                                {feature}
                            </span>
                        </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HeroListBusiness;