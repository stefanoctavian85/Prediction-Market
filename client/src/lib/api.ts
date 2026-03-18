const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved" | "archived";
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  token: string;
  role: string;
  balance: number;
}

export interface UserApiKey {
  apiKey: string;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export interface SortOption {
  label: string;
  field: string;
  order: "asc" | "desc";
}

export const sortOptionsArray: SortOption[] = [
  { label: "Newest", field: "createdAt", order: "desc" },
  { label: "Oldest", field: "createdAt", order: "asc" },
  { label: "Highest Bet Size", field: "totalMarketBets", order: "desc" },
  { label: "Lowest Bet Size", field: "totalMarketBets", order: "asc" },
  { label: "Most Participants", field: "participants", order: "desc" },
  { label: "Least Participants", field: "participants", order: "asc" },
];

export interface MarketResponse {
  markets: Market[];
  totalMarkets: number;
};

export interface BetDetails extends Bet {
  marketTitle: string;
  outcomeTitle: string;
  status: string;
  resolvedOutcomeId: number | null;
  odds: number | 0;
  won: boolean | null;
}

export interface BetDetailsResponse {
  bets: BetDetails[];
  totalBets: number;
}

export interface UserLeaderboard {
  userId: number;
  username: string;
  totalWinnings: number;
  place: number;
}

export interface Message {
  success: boolean;
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // User endpoints
  async getUserInformation(userId: number): Promise<User> {
    return this.request(`/api/profile/user/${userId}`);
  }

  // Markets endpoints
  async listMarkets(status: "active" | "resolved" | "archived" = "active",
    sortField: string = "createdAt",
    sortOrder: "asc" | "desc" = "asc",
    pageLimit: number = 20,
    page: number = 1
  ): Promise<MarketResponse> {
    return this.request(`/api/markets?status=${status}&sortField=${sortField}&sortOrder=${sortOrder}&pageLimit=${pageLimit}&page=${page}`);
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  async setResultForMarket(marketId: number, outcomeId: number): Promise<Message> {
    return this.request(`/api/markets/resolve/${marketId}/${outcomeId}`, {
      method: "PATCH",
    });
  }

  async archiveMarket(marketId: number): Promise<Message> {
    return this.request(`/api/markets/archive/${marketId}`, {
      method: "PATCH",
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  // Profile endpoints
  async getUserBets(id: number, status: "active" | "resolved" = "active", pageLimit: number = 20, page: number = 1): Promise<BetDetailsResponse> {
    return this.request(`/api/profile/${id}/bets?status=${status}&pageLimit=${pageLimit}&page=${page}`);
  }

  async generateApiKey(id: number): Promise<UserApiKey> {
    return this.request(`/api/profile/user/generateApiKey/${id}`);
  }

  // Leaderboard endpoints
  async getLeaderboard(): Promise<UserLeaderboard[]> {
    return this.request(`/api/leaderboard`);
  }
}

export const api = new ApiClient(API_BASE_URL);
