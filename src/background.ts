// @ts-nocheck
//---------------------------- TYPE DEFINITIONS ----------------------------//

enum MessageAction {
  FETCH_ATTACHMENTS = "FETCH_ATTACHMENTS",
  GET_ATTACHMENTS = "GET_ATTACHMENTS",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  CHECK_AUTH = "CHECK_AUTH",
  REFRESH_TOKEN = "REFRESH_TOKEN",
}

interface Message {
  action: MessageAction | string;
  tabId?: number;
  domain?: string;
  lang?: string;
  [key: string]: any;
}

interface Attachment {
  id: string;
  name: string;
  type: number;
  data: string;
  metadata?: {
    size?: number;
    mimeType?: string;
  };
}

interface AttachmentBatch {
  attachments: Attachment[];
  lang: string;
}

interface FetchResult {
  success: boolean;
  data?: AttachmentBatch;
  error?: string;
}

interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName?: string;
  };
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

interface TokenData {
  jwt: string;
  refreshToken: string;
  tokenExpiry: number;
  user?: {
    id: string;
    email: string;
    displayName?: string;
  };
}

//---------------------------- CONFIGURATION ----------------------------//

const API_URL = process.env.API_URL;
const API_PREFIX = "/api/v1";
const MESSAGE_TIMEOUT = 30000;
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;
let refreshTimerId: number | null = null;

//---------------------------- AUTH MANAGEMENT ----------------------------//

chrome.runtime.onStartup.addListener(() => {
  checkAuthStatus();
});

chrome.runtime.onInstalled.addListener(() => {
  checkAuthStatus();
});

function checkAuthStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["jwt", "refreshToken", "tokenExpiry", "user"],
      (result) => {
        if (!result.jwt || !result.refreshToken) {
          console.log("[Background] No auth tokens found");
          resolve(false);
          return;
        }

        if (isTokenExpired(result.tokenExpiry)) {
          console.log("[Background] Token expired, attempting refresh");
          refreshToken()
            .then((success) => resolve(success))
            .catch(() => resolve(false));
          return;
        }

        validateToken(result.jwt)
          .then((isValid) => {
            if (isValid) {
              const timeToExpiry = result.tokenExpiry - Date.now();
              console.log(
                `[Background] Token valid for ${Math.floor(
                  timeToExpiry / 60000
                )} minutes`
              );
              setupTokenRefresh(result.tokenExpiry);
              resolve(true);
            } else {
              console.log(
                "[Background] Token invalid according to server, attempting refresh"
              );
              refreshToken()
                .then((success) => resolve(success))
                .catch(() => resolve(false));
            }
          })
          .catch(() => {
            const timeToExpiry = result.tokenExpiry - Date.now();
            console.log(
              `[Background] Could not validate token, assuming valid for ${Math.floor(
                timeToExpiry / 60000
              )} minutes`
            );
            setupTokenRefresh(result.tokenExpiry);
            resolve(true);
          });
      }
    );
  });
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}${API_PREFIX}/auth/validate`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error("[Background] Error validating token:", error);
    return true;
  }
}

function isTokenExpired(expiryTime: number): boolean {
  return Date.now() + TOKEN_REFRESH_BUFFER > expiryTime;
}

function setupTokenRefresh(expiryTime: number): void {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
  }
  const timeUntilRefresh = expiryTime - Date.now() - TOKEN_REFRESH_BUFFER;
  if (timeUntilRefresh > 0) {
    console.log(
      `[Background] Scheduling token refresh in ${Math.floor(
        timeUntilRefresh / 60000
      )} minutes`
    );
    refreshTimerId = setTimeout(() => refreshToken(), timeUntilRefresh);
  } else {
    refreshToken();
  }
}

async function refreshToken(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["refreshToken"], (result) => {
      if (!result.refreshToken) {
        console.log("[Background] No refresh token found");
        resolve(false);
        return;
      }

      console.log("[Background] Refreshing token");
      fetch(`${API_URL}${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: result.refreshToken }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Token refresh failed");
          }
          return response.json();
        })
        .then((data) => {
          const tokenExpiry = Date.now() + data.expires_in * 1000;
          const tokenData: TokenData = {
            jwt: data.token,
            refreshToken: data.refresh_token || result.refreshToken,
            tokenExpiry: tokenExpiry,
            user: data.user,
          };

          chrome.storage.local.set(tokenData, () => {
            console.log("[Background] Token refreshed successfully");
            setupTokenRefresh(tokenExpiry);
            resolve(true);
          });
        })
        .catch((error) => {
          console.error("[Background] Error refreshing token:", error);
          chrome.storage.local.remove(
            ["jwt", "refreshToken", "tokenExpiry", "user"],
            () => {
              console.log(
                "[Background] Auth data cleared due to refresh failure"
              );
              reject(error);
            }
          );
          resolve(false);
        });
    });
  });
}

//---------------------------- MESSAGE HANDLING ----------------------------//

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    console.log("[Background] Received message:", message.action);

    switch (message.action) {
      case MessageAction.FETCH_ATTACHMENTS:
        handleFetchAttachments(message, sendResponse);
        return true;

      case MessageAction.LOGIN:
        handleLogin(message, sendResponse);
        return true;

      case MessageAction.LOGOUT:
        handleLogout(sendResponse);
        return true;

      case MessageAction.CHECK_AUTH:
        handleCheckAuth(sendResponse);
        return true;

      case MessageAction.REFRESH_TOKEN:
        handleRefreshToken(sendResponse);
        return true;

      default:
        console.log("[Background] Unknown message action:", message.action);
        return false;
    }
  }
);

function handleFetchAttachments(
  message: Message,
  sendResponse: (response: FetchResult) => void
): void {
  console.log(`[Background] Relaying fetch request to tab ${message.tabId}`);
  checkAuthStatus().then((isAuthenticated) => {
    if (!isAuthenticated) {
      sendResponse({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!message.tabId) {
      sendResponse({
        success: false,
        error: "No tab ID provided",
      });
      return;
    }
    const messageTimeout = setTimeout(() => {
      console.error("[Background] Timeout waiting for content script response");
      sendResponse({
        success: false,
        error: "Timeout waiting for content script response",
      });
    }, MESSAGE_TIMEOUT);

    chrome.storage.local.get(["jwt"], (result) => {
      chrome.tabs.sendMessage(
        message.tabId,
        {
          action: MessageAction.GET_ATTACHMENTS,
          domain: message.domain,
          lang: message.lang,
          token: result.jwt,
        },
        handleContentResponse
      );
    });

    function handleContentResponse(response: FetchResult) {
      clearTimeout(messageTimeout);
      console.log("[Background] Received response from content script");
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || "Unknown error";
        console.error("[Background] Chrome runtime error:", errorMsg);

        sendResponse({
          success: false,
          error: errorMsg.includes("Receiving end does not exist")
            ? "Please refresh the page to activate the extension"
            : errorMsg,
        });
        return;
      }

      if (response?.success && response.data?.attachments.length > 0) {
        console.log(
          `[Background] Found ${response.data.attachments.length} attachments`
        );

        chrome.storage.local.get(["jwt"], (result) => {
          sendAttachmentsToApi(response.data, result.jwt)
            .then((apiResponse) => {
              console.log("[Background] API response:", apiResponse);
            })
            .catch((error) => {
              console.error("[Background] API error:", error);

              // Handle auth errors
              if (error.status === 401 || error.status === 403) {
                refreshToken().catch(() => {
                  console.log(
                    "[Background] Auth refresh failed after API error"
                  );
                });
              }
            });
        });
      }
      sendResponse(response);
    }
  });
}

//---------------------------- API COMMUNICATION ----------------------------//

async function sendAttachmentsToApi(
  attachmentBatch: AttachmentBatch,
  token: string
): Promise<any> {
  if (!API_URL) {
    throw new Error("API URL not configured");
  }

  console.log(
    `[Background] Sending ${attachmentBatch.attachments.length} attachments to API`
  );

  const response = await fetch(`${API_URL}${API_PREFIX}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(attachmentBatch),
  });

  if (!response.ok) {
    const error = new Error(`API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

function handleLogin(
  message: Message,
  sendResponse: (response: AuthResult) => void
): void {
  console.log("[Background] Processing login request");
  const loginData = {
    email: message.email,
    password: message.password,
  };

  fetch(`${API_URL}${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(loginData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Login failed with status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data.token && !data.refresh_token) {
        throw new Error("Invalid authentication response");
      }

      console.log("[Background] Login successful");
      const token = data.token;
      const refreshToken = data.refresh_token;
      const expiresIn = data.expires_in || 3600;
      const user = data.user || {
        id: data.user_id || "",
        email: message.email,
        displayName: data.user?.name || message.email,
      };

      const tokenExpiry = Date.now() + expiresIn * 1000;
      chrome.storage.local.set(
        {
          jwt: token,
          refreshToken: refreshToken,
          tokenExpiry: tokenExpiry,
          user: user,
        },
        () => {
          setupTokenRefresh(tokenExpiry);

          sendResponse({
            success: true,
            user: user,
            token: token,
          });
        }
      );
    })
    .catch((error) => {
      console.error("[Background] Login error:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    });
}

function handleLogout(sendResponse: (response: AuthResult) => void): void {
  console.log("[Background] Processing logout request");

  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  chrome.storage.local.get(["jwt"], (result) => {
    const jwt = result.jwt;

    chrome.storage.local.remove(
      ["jwt", "refreshToken", "tokenExpiry", "user"],
      () => {
        console.log("[Background] Auth data cleared");

        if (jwt) {
          fetch(`${API_URL}${API_PREFIX}/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
          })
            .then((response) => response.json())
            .then(() => {
              console.log("[Background] Logout successful");
              sendResponse({ success: true });
            })
            .catch((error) => {
              console.error("[Background] Logout error:", error);
              sendResponse({
                success: false,
                error: error.message,
              });
            });
        } else {
          sendResponse({ success: true });
        }
      }
    );
  });
}

function handleCheckAuth(sendResponse: (response: AuthResult) => void): void {
  console.log("[Background] Checking auth status");

  checkAuthStatus()
    .then((isAuthenticated) => {
      if (isAuthenticated) {
        chrome.storage.local.get(["user"], (result) => {
          sendResponse({
            success: true,
            user: result.user,
          });
        });
      } else {
        sendResponse({
          success: false,
          error: "Not authenticated",
        });
      }
    })
    .catch((error) => {
      sendResponse({
        success: false,
        error: error.message,
      });
    });
}

function handleRefreshToken(
  sendResponse: (response: AuthResult) => void
): void {
  console.log("[Background] Manual token refresh requested");

  refreshToken()
    .then((success) => {
      if (success) {
        chrome.storage.local.get(["user"], (result) => {
          sendResponse({
            success: true,
            user: result.user,
          });
        });
      } else {
        sendResponse({
          success: false,
          error: "Refresh failed",
        });
      }
    })
    .catch((error) => {
      sendResponse({
        success: false,
        error: error.message,
      });
    });
}

//---------------------------- INITIALIZATION ----------------------------//

console.log(
  "[Background] Mail Attachment Extension background script initialized"
);
