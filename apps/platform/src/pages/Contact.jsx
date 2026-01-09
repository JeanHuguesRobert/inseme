import React from "react";
import { Link } from "react-router-dom";
import { HASHTAG, CITY_NAME, getDynamicConfig } from "../constants.js";
import CommentSection from "../components/common/CommentSection";
import { useCurrentUser } from "@inseme/cop-host";
import { getConfig } from "../common/config/instanceConfig.client.js";

export default function Contact() {
  // Email de l'éditeur du site - Information légale obligatoire (LCEN)
  // Utilise le vault si disponible, sinon fallback sur env vars
  const { contactEmail: emailRaw } = getDynamicConfig();
  const email = (emailRaw || "").trim();
  const { currentUser } = useCurrentUser();

  const isAdmin =
    currentUser?.email && email && currentUser.email.toLowerCase() === email.toLowerCase();

  return (
    <div className="min-h-screen">
      {/* Header identique au reste du site */}
      <div className=" shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold text-bauhaus-red">{HASHTAG}</div>
              <div className="h-1 bg-bauhaus-blue my-3 max-w-2xl mx-auto"></div>
              <div className="text-4xl font-bold text-bauhaus-blue">
                {CITY_NAME.toUpperCase()}
                <br />
                CAPITALE
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-bauhaus-black shadow-md p-8 border border-gray-700">
          <h1 className="text-3xl font-bold text-bauhaus-white mb-6">Contact</h1>

          <div className="space-y-6">
            <section>
              <p className="text-gray-200">
                Contactez{" "}
                <Link to="/ophelia-land" className="text-bauhaus-yellow hover:underline">
                  l'auteur
                </Link>
                , écrivez à&nbsp;
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="text-bauhaus-yellow font-bold hover:underline"
                  >
                    {email}
                  </a>
                ) : (
                  <span className="text-bauhaus-red font-bold italic">(email non configuré)</span>
                )}
                .
              </p>
            </section>
          </div>

          {/* Admin section visible only to the configured contact email */}
          {isAdmin && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">Admin</h2>
              <ul className="space-y-2">
                <li>
                  <Link to="/admin" className="text-blue-600 hover:underline font-medium">
                    Administration
                  </Link>
                </li>
              </ul>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              to="/"
              className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold hover:bg-gray-200"
            >
              Retour à la consultation
            </Link>
          </div>
        </div>

        {/* Section de questions et discussions */}
        {true && (
          <div className="mt-6">
            <CommentSection
              linkedType="contact_page"
              linkedId="main"
              currentUser={currentUser}
              defaultExpanded={false}
            />
          </div>
        )}
      </div>

      <footer className="bg-gray-800 text-bauhaus-white py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="mb-2">
            Une initiative {HASHTAG} - {CITY_NAME} Capitale
          </p>
          <a
            href="https://www.facebook.com/groups/1269635707349220"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300"
          >
            Rejoignez-nous sur Facebook
          </a>
        </div>
      </footer>
    </div>
  );
}
