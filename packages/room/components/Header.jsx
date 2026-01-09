import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function Header({ user, onSignOut }) {
    return (
        <header className="w-full bg-neutral-900/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo & Title */}
                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.search = ''}>
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center p-2 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                        <img src="/images/favicon.svg" alt="Inseme Logo" className="w-full h-full filter brightness-0 invert" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            Inseme
                        </h1>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">
                            Démocratie directe et liquide
                        </p>
                    </div>
                </div>

                {/* User Info & Actions */}
                <div className="flex items-center gap-4">
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-sm font-bold text-white">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
                                </span>
                                <span className="text-[10px] text-white/40 uppercase tracking-tighter">
                                    {user.app_metadata?.provider || 'Anonyme'}
                                </span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                {user.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-5 h-5 text-white/40" />
                                )}
                            </div>
                            <button
                                onClick={onSignOut}
                                className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all"
                                title="Déconnexion"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
