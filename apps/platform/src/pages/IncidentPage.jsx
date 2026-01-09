import React from "react";
import { useCurrentUser } from "@inseme/cop-host";
import PostView from "../components/social/PostView";
import SiteFooter from "../components/layout/SiteFooter";

// Simple wrapper page to host the incident-specific view route
export default function IncidentPage() {
  const { currentUser } = useCurrentUser();

  return (
    <>
      <PostView currentUser={currentUser} />
      <SiteFooter />
    </>
  );
}
