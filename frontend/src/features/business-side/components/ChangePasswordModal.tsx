import { useState } from "react";
import { HiOutlineLockClosed, HiX } from "react-icons/hi";
import { supabase } from "../../../lib/supabase";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (passwords.new !== passwords.confirm) {
            setError("New passwords do not match");
            return;
        }
        const validatePassword = (pw: string): string => {
            if (pw.length < 8)            return 'Password must be at least 8 characters.';
            if (!/[a-z]/.test(pw))        return 'Password must include at least one lowercase letter.';
            if (!/[A-Z]/.test(pw))        return 'Password must include at least one uppercase letter.';
            if (!/[0-9]/.test(pw))        return 'Password must include at least one number.';
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw))
                                           return 'Password must include at least one special character.';
            return '';
        };
        const pwError = validatePassword(passwords.new);
        if (pwError) {
            setError(pwError);
            return;
        }

        setLoading(true);

        // Re-authenticate with current password first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
            setError("Unable to verify current session.");
            setLoading(false);
            return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: passwords.current,
        });

        if (signInError) {
            setError("Current password is incorrect.");
            setLoading(false);
            return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
            password: passwords.new,
        });

        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setPasswords({ current: "", new: "", confirm: "" });
                onClose();
            }, 1500);
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div
                className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-[#3a3a3a] flex items-center justify-between bg-[#333333]/30">
                    <div className="flex items-center gap-2">
                        <HiOutlineLockClosed className="text-[#FFE2A0] size-5" />
                        <h3 className="text-white text-lg font-semibold font-['Playfair_Display'] tracking-wide">Security Update</h3>
                    </div>
                    <button onClick={onClose} className="text-[#a0a0a0] hover:text-white transition-colors">
                        <HiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleUpdate} className="p-6 space-y-6">
                    <p className="text-[#a0a0a0] text-sm leading-relaxed">Ensure your account is using a long, random password to stay secure.</p>

                    <div className="space-y-4">
                        {["current", "new", "confirm"].map((field) => (
                            <div key={field} className="space-y-1.5">
                                <label className="text-[#FFE2A0] text-[10px] font-bold uppercase tracking-widest px-1 opacity-60">
                                    {field === "current" ? "Current Password" : field === "new" ? "New Password" : "Confirm New Password"}
                                </label>
                                <input
                                    required
                                    type="password"
                                    value={passwords[field as keyof typeof passwords]}
                                    onChange={(e) => setPasswords({ ...passwords, [field]: e.target.value })}
                                    placeholder={field === "new" ? "Min. 8 characters" : field === "confirm" ? "Repeat new password" : "Enter current password"}
                                    className="w-full bg-[#3a3a3a] border border-[#4d4d4d] rounded-xl px-4 py-3 text-white focus:border-[#FFE2A0] transition-all outline-none"
                                />
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-4 py-2 rounded-lg">{error}</div>
                    )}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-4 py-2 rounded-lg">Password updated successfully!</div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-[#a0a0a0] hover:text-white transition-colors text-sm font-semibold">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 bg-[#FFE2A0] text-[#1a1a1a] rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;