// @ts-nocheck
enum MessageAction {
  LOGIN = "LOGIN",
  CHECK_AUTH = "CHECK_AUTH",
}

interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName?: string;
  };
  error?: string;
}

const SUPPORTED_DOMAINS = {
  GMAIL: "mail.google.com",
  OUTLOOK: "outlook.live.com",
} as const;

class LoginManager {
  private loginForm: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private loginButton: HTMLButtonElement;
  private errorMessage: HTMLElement;
  private loginContainer: HTMLElement;
  private mainContainer: HTMLElement;
  private unauthorizedContainer: HTMLElement;
  private userInfo: HTMLElement;
  private currentDomain: string | null = null;

  constructor() {
    // Get elements
    this.loginForm = document.getElementById("loginForm") as HTMLFormElement;
    this.emailInput = document.getElementById("email") as HTMLInputElement;
    this.passwordInput = document.getElementById(
      "password"
    ) as HTMLInputElement;
    this.loginButton = document.getElementById(
      "loginButton"
    ) as HTMLButtonElement;
    this.errorMessage = document.getElementById("loginError") as HTMLElement;
    this.loginContainer = document.getElementById(
      "loginContainer"
    ) as HTMLElement;
    this.mainContainer = document.getElementById(
      "mainContainer"
    ) as HTMLElement;
    this.unauthorizedContainer = document.getElementById(
      "unauthorizedContainer"
    ) as HTMLElement;
    this.userInfo = document.getElementById("userInfo") as HTMLElement;

    this.loginForm.addEventListener("submit", this.handleLogin.bind(this));

    console.log("[Login] Login manager initialized");
  }

  async initialize(): Promise<boolean> {
    try {
      console.log("[Login] Checking domain...");
      const currentTab = await this.getCurrentTab();
      if (!currentTab?.url) {
        console.log("[Login] No valid tab URL found");
        this.showUnauthorizedDomain();
        return false;
      }

      const domain = this.extractDomain(currentTab.url);
      this.currentDomain = domain;

      // Check if domain is supported
      if (!this.isDomainSupported(domain)) {
        console.log(`[Login] Domain ${domain} not supported`);
        this.showUnauthorizedDomain();
        return false;
      }

      console.log("[Login] Domain supported, checking auth status...");
      const status = await this.checkAuthStatus();

      if (status.success) {
        this.showLoggedInState(status.user);
        return true;
      } else {
        this.showLoginForm();
        return false;
      }
    } catch (error) {
      console.error("[Login] Auth check error:", error);
      this.showLoginForm();
      return false;
    }
  }

  private async getCurrentTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  private extractDomain(url: string): string {
    return new URL(url).hostname;
  }

  private isDomainSupported(domain: string): boolean {
    return Object.values(SUPPORTED_DOMAINS).includes(domain as any);
  }

  private async checkAuthStatus(): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: MessageAction.CHECK_AUTH },
        (response: AuthResult) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  private async handleLogin(event: Event): Promise<void> {
    event.preventDefault();

    this.loginButton.disabled = true;
    this.loginButton.textContent = "Loading...";
    this.errorMessage.textContent = "";

    try {
      const email = this.emailInput.value.trim();
      const password = this.passwordInput.value;

      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const result = await this.sendLoginRequest(email, password);

      if (result.success) {
        console.log("[Login] Login successful");
        this.showLoggedInState(result.user);
      } else {
        throw new Error(result.error || "Login failed");
      }
    } catch (error) {
      console.error("[Login] Login error:", error);
      this.errorMessage.textContent = error.message;
      this.errorMessage.style.display = "block";
      this.loginButton.disabled = false;
      this.loginButton.textContent = "Login";
    }
  }

  private async sendLoginRequest(
    email: string,
    password: string
  ): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: MessageAction.LOGIN,
          email,
          password,
        },
        (response: AuthResult) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  private showUnauthorizedDomain(): void {
    console.log("[Login] Showing unauthorized domain screen");
    this.unauthorizedContainer.style.display = "flex";
    this.loginContainer.style.display = "none";
    this.mainContainer.style.display = "none";
  }

  private showLoginForm(): void {
    console.log("[Login] Showing login form");
    this.unauthorizedContainer.style.display = "none";
    this.loginContainer.style.display = "flex";
    this.mainContainer.style.display = "none";
  }

  private showLoggedInState(user: any): void {
    console.log("[Login] Showing logged in state");
    this.unauthorizedContainer.style.display = "none";
    this.loginContainer.style.display = "none";
    this.mainContainer.style.display = "flex";

    if (user && this.userInfo) {
      const displayName = user.displayName || user.email || "User";
      this.userInfo.textContent = `${displayName}`;
    }
  }
}

export default LoginManager;
