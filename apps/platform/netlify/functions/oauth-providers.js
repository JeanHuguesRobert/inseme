import { PROVIDERS } from "../edge-functions/lib/lib/oauthProviders.js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export const handler = async (event) => {
  // Load instance config
  await loadInstanceConfig();

  const enabledProviders = [];

  for (const [key, conf] of Object.entries(PROVIDERS)) {
    // Check if the Client ID environment variable is set and not empty
    // Map the env var name to our config key format (e.g., GITHUB_CLIENT_ID -> github_client_id)
    const configKey = conf.clientIdEnv.toLowerCase();
    if (getConfig(configKey)) {
      enabledProviders.push({
        id: key,
        name: conf.name,
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ providers: enabledProviders }),
  };
};
