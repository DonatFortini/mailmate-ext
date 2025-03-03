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

class LoginManager {
  private loginForm: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private loginButton: HTMLButtonElement;
  private errorMessage: HTMLElement;
  private loginContainer: HTMLElement;
  private mainContainer: HTMLElement;
  private userInfo: HTMLElement;

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
    this.userInfo = document.getElementById("userInfo") as HTMLElement;

    this.loginForm.addEventListener("submit", this.handleLogin.bind(this));

    console.log("[Login] Login manager initialized");
  }

  async initialize(): Promise<boolean> {
    try {
      console.log("[Login] Checking auth status...");

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

  private showLoginForm(): void {
    console.log("[Login] Showing login form");
    this.loginContainer.style.display = "block";
    this.mainContainer.style.display = "none";
  }

  private showLoggedInState(user: any): void {
    console.log("[Login] Showing logged in state");
    this.loginContainer.style.display = "none";
    this.mainContainer.style.display = "block";

    if (user && this.userInfo) {
      const displayName = user.displayName || user.email || "User";
      this.userInfo.textContent = `Logged in as ${displayName}`;
    }
  }
}

export default LoginManager;
