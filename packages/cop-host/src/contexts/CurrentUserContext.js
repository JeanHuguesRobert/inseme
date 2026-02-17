import { createContext } from "react";

export const CurrentUserContext = createContext({
  currentUser: null,
  session: null,
  loading: true,
  error: null,
  userStatus: "signed_out",
  updateProfile: async () => {},
});
