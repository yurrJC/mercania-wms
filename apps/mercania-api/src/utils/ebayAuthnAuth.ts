import crypto from 'crypto';

/**
 * eBay Auth'n'Auth (Legacy Authentication) Implementation
 * 
 * This is the older authentication method that doesn't require OAuth flows.
 * It uses App ID, Dev ID, and Cert ID for authentication.
 * 
 * Note: eBay is phasing out Auth'n'Auth in favor of OAuth 2.0, but it's still
 * supported for existing applications and may be simpler for your use case.
 */

interface AuthnAuthConfig {
  appId: string;
  devId: string;
  certId: string;
  ruName: string; // eBay Return URL Name
}

export class eBayAuthnAuth {
  private config: AuthnAuthConfig;

  constructor(config: AuthnAuthConfig) {
    this.config = config;
  }

  /**
   * Generate the eBay Auth'n'Auth URL for user authorization
   * This URL should be opened in a browser for the user to authorize your app
   */
  generateAuthUrl(): string {
    const baseUrl = 'https://signin.ebay.com/ws/eBayISAPI.dll';
    const params = new URLSearchParams({
      SignIn: 'true',
      RUName: this.config.ruName,
      SessID: this.generateSessionId(),
      RUParams: 'SessID'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate a unique session ID for the authorization flow
   */
  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create the XML request for getting a user token
   * This is used after the user has authorized your application
   */
  createGetTokenRequest(sessionId: string): string {
    const timestamp = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="utf-8"?>
<GetSessionIDRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${this.config.appId}</eBayAuthToken>
  </RequesterCredentials>
  <RuName>${this.config.ruName}</RuName>
  <Version>1191</Version>
</GetSessionIDRequest>`;
  }

  /**
   * Create the XML request for fetching a user token
   */
  createFetchTokenRequest(sessionId: string): string {
    const timestamp = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="utf-8"?>
<FetchTokenRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${this.config.appId}</eBayAuthToken>
  </RequesterCredentials>
  <SessionID>${sessionId}</SessionID>
  <Version>1191</Version>
</FetchTokenRequest>`;
  }

  /**
   * Make a request to eBay's Trading API
   */
  async makeTradingApiRequest(xmlRequest: string, callName: string): Promise<any> {
    const url = 'https://api.ebay.com/ws/api.dll';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1191',
        'X-EBAY-API-DEV-NAME': this.config.devId,
        'X-EBAY-API-APP-NAME': this.config.appId,
        'X-EBAY-API-CERT-NAME': this.config.certId,
        'X-EBAY-API-CALL-NAME': callName,
        'X-EBAY-API-SITEID': '15', // Australia
        'Content-Type': 'text/xml'
      },
      body: xmlRequest
    });

    if (!response.ok) {
      throw new Error(`eBay API Error: ${response.status} ${response.statusText}`);
    }

    const xmlResponse = await response.text();
    return this.parseXmlResponse(xmlResponse);
  }

  /**
   * Parse XML response from eBay API
   * Note: In production, you should use a proper XML parser
   */
  private parseXmlResponse(xml: string): any {
    // Simple XML parsing - in production use a proper XML parser
    const tokenMatch = xml.match(/<eBayAuthToken>(.*?)<\/eBayAuthToken>/);
    const errorMatch = xml.match(/<ShortMessage>(.*?)<\/ShortMessage>/);
    
    if (errorMatch) {
      throw new Error(`eBay API Error: ${errorMatch[1]}`);
    }
    
    if (tokenMatch) {
      return { token: tokenMatch[1] };
    }
    
    return { raw: xml };
  }

  /**
   * Get a user token using Auth'n'Auth flow
   * This is a simplified version - the full flow requires user interaction
   */
  async getUserToken(sessionId: string): Promise<string> {
    const xmlRequest = this.createFetchTokenRequest(sessionId);
    const response = await this.makeTradingApiRequest(xmlRequest, 'FetchToken');
    
    if (!response.token) {
      throw new Error('Failed to get user token from eBay');
    }
    
    return response.token;
  }
}

/**
 * Helper function to create Auth'n'Auth instance from environment variables
 */
export function createAuthnAuthFromEnv(): eBayAuthnAuth {
  const config = {
    appId: process.env.EBAY_APP_ID || '',
    devId: process.env.EBAY_DEV_ID || '',
    certId: process.env.EBAY_CERT_ID || '',
    ruName: process.env.EBAY_RU_NAME || 'Mercania-WMS-1'
  };

  if (!config.appId || !config.devId || !config.certId) {
    throw new Error('Missing required eBay Auth\'n\'Auth credentials. Please set EBAY_APP_ID, EBAY_DEV_ID, and EBAY_CERT_ID in your environment variables.');
  }

  return new eBayAuthnAuth(config);
}
