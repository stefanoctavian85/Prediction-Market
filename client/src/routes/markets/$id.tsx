import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const SERVER_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUserInformation } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState<boolean>(false);
  const [isSettingResult, setIsSettingResult] = useState<boolean>(false);
  const [isArchivingMarket, setIsArchivingMarket] = useState<boolean>(false);

  const marketId = parseInt(id, 10);

  const loadMarket = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getMarket(marketId);
      setMarket(data);
      if (data.outcomes.length > 0) {
        setSelectedOutcomeId(data.outcomes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market details");
    } finally {
      setIsLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    loadMarket();
  }, [marketId]);

  useEffect(() => {
      const sseConnection = new EventSource(`${SERVER_BASE_URL}/sse`);

      sseConnection.onmessage = async (event) => {
        const { type, marketId: eventMarketId } = JSON.parse(event.data);

        if (type === "market_resolved" || type === "market_archived") {
          const updatedUser = await api.getUserInformation(user.id);
          updateUserInformation(updatedUser);
          loadMarket();
        } else if (type === "bet_placed" && marketId === eventMarketId) {
          const updatedMarket = await api.getMarket(marketId);
          setMarket(updatedMarket);
          const updatedUser = await api.getUserInformation(user.id);
          updateUserInformation(updatedUser);
        }
      };

      return () => sseConnection.close();
    }, [loadMarket]);

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !betAmount) {
      setError("Please select an outcome and enter a bet amount");
      return;
    }

    try {
      setIsBetting(true);
      setError(null);
      await api.placeBet(marketId, selectedOutcomeId, parseFloat(betAmount));
      setBetAmount("");
      const updatedUser = await api.getUserInformation(user.id);
      updateUserInformation(updatedUser);
      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setIsBetting(false);
    }
  };

  const handleSetResultMarket = async () => {
    if (!selectedOutcomeId) {
      setError("Please select an outcome");
      return;
    }

    try {
      setIsSettingResult(true);
      setError(null);
      await api.setResultForMarket(marketId, selectedOutcomeId);
      const updated = await api.getMarket(marketId);
      const updatedUser = await api.getUserInformation(user.id);
      updateUserInformation(updatedUser);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    } finally {
      setIsSettingResult(false);
    }
  }

  const handleArchiveMarket = async () => {
    if (!marketId) {
      setError("Please select a market");
      return;
    }

    try {
      setIsArchivingMarket(true);
      setError(null);
      await api.archiveMarket(marketId);
      const updated = await api.getMarket(marketId);
      setMarket(updated);
      const updatedUser = await api.getUserInformation(user.id);
      updateUserInformation(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive market");
    } finally {
      setIsArchivingMarket(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view this market</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>Back to Markets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            ← Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-bold text-primary">${user?.balance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">{market.description}</CardDescription>
                )}
              </div>
              <Badge variant={market.status === "active" ? "default" : "secondary"}>
                {market.status === "active" ? "Active" : market.status === "resolved" ? "Resolved" : "Archived"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Outcomes Display */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Outcomes</h3>
              {market.outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedOutcomeId === outcome.id
                    ? "border-primary bg-primary/5"
                    : "border-secondary bg-secondary/5 hover:border-primary/50"
                    }`}
                  onClick={() => market.status === "active" && setSelectedOutcomeId(outcome.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold">{outcome.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total bets: ${outcome.totalBets.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{outcome.odds}%</p>
                      <p className="text-xs text-muted-foreground">odds</p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${outcome.odds}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Market Stats */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">Total Market Value</p>
              <p className="text-4xl font-bold text-primary">
                ${market.totalMarketBets.toFixed(2)}
              </p>
            </div>

            {/* Betting Section */}
            {market.status === "active" && (
              <div>
                {user?.role === "admin" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-secondary/5 mb-5">
                      <CardHeader>
                        <CardTitle>Set The Result</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Selected Outcome</Label>
                          <div className="p-3 bg-white border border-secondary rounded-md">
                            {market.outcomes.find((o) => o.id === selectedOutcomeId)?.title ||
                              "None selected"}
                          </div>
                        </div>

                        <Button
                          className="w-full text-lg py-6"
                          onClick={handleSetResultMarket}
                          disabled={isSettingResult || !selectedOutcomeId}
                        >
                          {isSettingResult ? "Setting Result..." : "Set Result"}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-secondary/5 mb-5">
                      <CardHeader>
                        <CardTitle>Archive Market</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>&nbsp;</Label>
                          <div className="space-y-2">
                            <div className="mb-11 pl-3 bg-white border-secondary rounded-md text-sm flex items-center">
                              Cancel this market and refund all bettors.
                            </div>
                          </div>
                        </div>

                        <Button
                          className="w-full text-lg py-6"
                          onClick={handleArchiveMarket}
                        >
                          {isArchivingMarket ? "Archiving Market..." : "Archive Market"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
                <Card className="bg-secondary/5">
                  <CardHeader>
                    <CardTitle>Place Your Bet</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selected Outcome</Label>
                      <div className="p-3 bg-white border border-secondary rounded-md">
                        {market.outcomes.find((o) => o.id === selectedOutcomeId)?.title ||
                          "None selected"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="betAmount">Bet Amount ($)</Label>
                      <Input
                        id="betAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder="Enter amount"
                        disabled={isBetting}
                      />
                    </div>

                    <Button
                      className="w-full text-lg py-6"
                      onClick={handlePlaceBet}
                      disabled={isBetting || !selectedOutcomeId || !betAmount}
                    >
                      {isBetting ? "Placing bet..." : "Place Bet"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {market.status === "resolved" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been resolved.</p>
                </CardContent>
              </Card>
            )}

            {market.status === "archived" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been archived.</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});
