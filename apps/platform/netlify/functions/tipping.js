import Stripe from "stripe";
import jwt from "jsonwebtoken";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const JWT_SECRET = process.env.TIPPING_SECRET || "tipping_secret_placeholder";

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
      const { stripe_account_id, recipient_mode, barman_name, place, phone, phone_visibility } =
        payload;

      if (!stripe_account_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing stripe_account_id" }),
        };
      }

      const token = jwt.sign(
        {
          stripe_account_id,
          recipient_mode: recipient_mode || "individual",
          purpose: "don",
          barman_name,
          place,
          phone,
          phone_visibility: phone_visibility || "private",
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

    // 2. CREATE CHECKOUT SESSION (For Client donation)
    if (action === "create-session") {
      const { token, amount, metadata, success_url, cancel_url } = payload;

      if (!token || !amount) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing token or amount" }),
        };
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Invalid or expired token" }),
        };
      }

      const amountCents = Math.round(parseFloat(amount) * 100);
      if (isNaN(amountCents) || amountCents < 100 || amountCents > 50000) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid amount (1€ - 500€)" }),
        };
      }

      // Create Stripe Checkout Session
      // Note: We use direct charges or destination charges depending on requirements.
      // Here we assume simple checkout session for now, but in a real scenario with Connect,
      // we would use transfer_data or similar.
      // Since the spec says "Stripe is the only legal register", we'll create a session
      // that pays to the barman's account if possible, or just a platform payment with metadata.
      // Given the "stateless" and "no responsibility" requirement, a direct charge to the connected account
      // is usually best if Connect is used.

      const sessionParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `Pourboire pour ${decoded.barman_name || "le barman"}`,
                description: `Lieu: ${decoded.place || "Non spécifié"}`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url:
          success_url || `${event.headers.origin}/tip-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancel_url || `${event.headers.origin}/`,
        metadata: {
          ...metadata,
          stripe_account_id: decoded.stripe_account_id,
          recipient_mode: decoded.recipient_mode,
          purpose: "don",
          barman_name: decoded.barman_name,
        },
      };

      // If we want to send money directly to the barman's account (Stripe Connect)
      if (decoded.stripe_account_id.startsWith("acct_")) {
        sessionParams.payment_intent_data = {
          transfer_data: {
            destination: decoded.stripe_account_id,
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ url: session.url }),
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
