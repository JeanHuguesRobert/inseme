import { useState, useEffect } from 'react'
import { getSupabase } from '../client/supabase.js'

export function useSupabaseAuth() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const supabase = getSupabase()

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    const signInAnonymously = async () => {
        const { data, error } = await supabase.auth.signInAnonymously()
        return { data, error }
    }

    const signInWithProvider = async (provider) => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin
            }
        })
        return { data, error }
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    return {
        user,
        loading,
        signInAnonymously,
        signInWithProvider,
        signOut
    }
}
