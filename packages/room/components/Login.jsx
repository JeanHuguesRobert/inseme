import React from 'react'
import { Login as SharedLogin } from "@inseme/ui"

export default function Login({
    onSignInAnonymously,
    onSignInWithProvider,
    onSignInWithPassword,
    onSignUp,
    onSpectator,
    loading,
    error,
    roomName,
    isUpgrading = false,
    initialMode = null
}) {
    const handleSignInAnonymously = (nickname, isPublic) => {
        if (isPublic) {
            localStorage.setItem('inseme_is_public', 'true')
        } else {
            localStorage.removeItem('inseme_is_public')
        }
        onSignInAnonymously(nickname)
    }

    return (
        <SharedLogin 
            onSignInAnonymously={handleSignInAnonymously}
            onSignInWithProvider={onSignInWithProvider}
            onSignInWithPassword={onSignInWithPassword}
            onSignUp={onSignUp}
            onSpectator={onSpectator}
            loading={loading}
            error={error}
            roomName={roomName}
            isUpgrading={isUpgrading}
            initialMode={initialMode}
            labels={{
                title: "Bienvenue",
                subtitle: "Connectez-vous pour participer",
                anonymousTitle: "Accès Invité",
                anonymousSubtitle: "Participez aux débats instantanément",
                signupTitle: isUpgrading ? "Devenir Membre" : "Créer un compte",
                signupSubtitle: isUpgrading ? "Enregistrez-vous pour conserver votre historique" : "Rejoignez la communauté Inseme",
            }}
        />
    )
}
