// apps/cyrnea/netlify/functions/tipping.js

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.TIPPING_SECRET || "tipping_secret_placeholder";
const BARMAN_SESAME = "42";

export const handler = async (event) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const { action, ...payload } = JSON.parse(event.body);

    // 1. SIGN TOKEN (For Barman declaration)
    if (action === "sign-token") {
      const { barman_name, place, sesame } = payload;

      const enteredSesame = (sesame || "").trim();
      const isMaster = enteredSesame === "42";
      const isBarMatch = BARMAN_SESAME && enteredSesame === BARMAN_SESAME;

      console.log(`[Tipping] Sesame check: master=${isMaster}, match=${isBarMatch}`);

      // Sesame Verification
      if (!isMaster && !isBarMatch) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Code sésame incorrect" }),
        };
      }

      const token = jwt.sign(
        {
          purpose: "don",
          barman_name,
          place,
        },
        JWT_SECRET,
        { expiresIn: "24h" } // Barman session valid for 24h
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ token }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (err) {
    console.error("Tipping error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
