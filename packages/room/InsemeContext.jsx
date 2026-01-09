import React, { createContext, useContext } from 'react';
import { useInseme } from './hooks/useInseme.js';

const InsemeContext = createContext(null);

export function InsemeProvider({ children, roomName, user, supabase, config = {}, isSpectator = false }) {
    const inseme = useInseme(roomName, user, supabase, config, isSpectator);

    return (
        <InsemeContext.Provider value={inseme}>
            {children}
        </InsemeContext.Provider>
    );
}

export function useInsemeContext() {
    const context = useContext(InsemeContext);
    if (!context) {
        throw new Error('useInsemeContext must be used within an InsemeProvider');
    }
    return context;
}
