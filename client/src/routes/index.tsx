import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market, SortOption, sortOptionsArray } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

const SERVER_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const PAGE_LIMIT = 20;

function DashboardPage() {
  const { isAuthenticated, user, updateUserInformation } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved" | "archived">("active");
  const [sort, setSort] = useState<SortOption>(sortOptionsArray[0]);
  const [page, setPage] = useState<number>(1);
  const [totalMarkets, setTotalMarkets] = useState<number>(0);

  const loadMarkets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { field, order } = sort;
      const data = await api.listMarkets(status, field, order, PAGE_LIMIT, page);
      setMarkets(data.markets);
      setTotalMarkets(data.totalMarkets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setIsLoading(false);
    }
  }, [status, sort, page]);

  useEffect(() => {
    loadMarkets();
  }, [status, sort, page]);

  useEffect(() => {
    const sseConnection = new EventSource(`${SERVER_BASE_URL}/sse`);

    sseConnection.onmessage = async (event) => {
      const { type, marketId } = JSON.parse(event.data);

      if (type === "market_created" || type === "market_resolved" || type === "market_archived") {
        const updatedUser = await api.getUserInformation(user.id);
        updateUserInformation(updatedUser);
        loadMarkets();
      } else if (type === "bet_placed") {
        const updatedMarket = await api.getMarket(marketId);
        setMarkets(prev => prev.map((market) => market.id === marketId ? updatedMarket : market));
      }
    };

    return () => sseConnection.close();
  }, [loadMarkets]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Prediction Markets</h1>
          <p className="text-gray-600 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Markets</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.username.charAt(0).toUpperCase()}{user?.username.substring(1)}!</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-bold text-primary">${user?.balance.toFixed(2)}</span>
            </div>
            <Button onClick={() => navigate({ to: "/leaderboard" })}>Leaderboard</Button>
            <Button onClick={() => navigate({ to: `/profile/${user?.id}` })}>Profile</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
              Logout
            </Button>
          </div>
        </div>

        {/* Filters and Sorting Menu */}
        <div className="flex justify-between mb-6 items-center">
          <div className="flex gap-4">
            <Button
              variant={status === "active" ? "default" : "outline"}
              onClick={() => {
                setStatus("active");
                setPage(1);
              }}
            >
              Active Markets
            </Button>
            <Button
              variant={status === "resolved" ? "default" : "outline"}
              onClick={() => {
                setStatus("resolved");
                setPage(1);
              }}
            >
              Resolved Markets
            </Button>
            <Button
              variant={status === "archived" ? "default" : "outline"}
              onClick={() => {
                setStatus("archived");
                setPage(1);
              }}
            >
              Archived Markets
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/markets/new" })}
            >
              Create Market
            </Button>
          </div>

          <div>
            <DropdownMenu>
              <div className="flex gap-4">
                <Label>
                  Sort by
                </Label>
                <DropdownMenuTrigger asChild>
                  <Button>
                    {sort.label}
                  </Button>
                </DropdownMenuTrigger>
              </div>

              <DropdownMenuContent
                align="end"
              >
                <DropdownMenuRadioGroup
                  value={sort.label}
                  onValueChange={(value: string) => {
                    const option = sortOptionsArray.find(op => op.label === value)!;
                    setSort(option);
                  }}
                >
                  {sortOptionsArray.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.label}
                      value={option.label}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg">
                  No {status} markets found. {status === "active" && "Create one to get started!"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && markets.length > 0 && (
          <div className="mt-6 pb-8 flex items-center justify-center gap-2">
            <div className="w-24 flex justify-end">
              <Button
                className="w-16"
                onClick={() => setPage(page - 1)}
                disabled={(page <= 1)}
                variant="outline"
              >Previous</Button>
            </div>
            <p
              className="w-16 text-center"
            >
              {page} / {Math.ceil(totalMarkets / PAGE_LIMIT)}
            </p>
            <div className="w-24 flex justify-start">
              <Button
                className="w-16"
                onClick={() => setPage(page + 1)}
                disabled={(totalMarkets <= (page * PAGE_LIMIT))}
                variant="outline"
              >Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
