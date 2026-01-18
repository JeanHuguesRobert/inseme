export const handler = async () => {
  return {
    statusCode: 501,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "facebook-oembed not implemented" }),
  };
};
