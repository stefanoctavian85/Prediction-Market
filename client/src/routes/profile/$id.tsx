import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api, BetDetails } from "@/lib/api";

const SERVER_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const PAGE_LIMIT = 20;

function ProfilePage() {
    const { id } = useParams({ from: "/profile/$id" });
    const navigate = useNavigate();
    const { isAuthenticated, user, updateUserInformation } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeBets, setActiveBets] = useState<BetDetails[]>([]);
    const [pageActiveBets, setPageActiveBets] = useState<number>(1);
    const [totalActiveBets, setTotalActiveBets] = useState<number>(0);
    const [resolvedBets, setResolvedBets] = useState<BetDetails[]>([]);
    const [pageResolvedBets, setPageResolvedBets] = useState<number>(1);
    const [totalResolvedBets, setTotalResolvedBets] = useState<number>(0);
    const [apiKey, setApiKey] = useState<string>("");

    const activeBetsRef = useRef<BetDetails[]>([]);

    const userId = parseInt(id, 10);

    const loadActiveBets = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const dataActiveBets = await api.getUserBets(userId, "active", PAGE_LIMIT, pageActiveBets);
            setActiveBets(dataActiveBets.bets);
            setTotalActiveBets(dataActiveBets.totalBets);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load bets");
        } finally {
            setIsLoading(false);
        }
    }, [pageActiveBets]);

    const loadResolvedBets = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const dataResolvedBets = await api.getUserBets(userId, "resolved", PAGE_LIMIT, pageResolvedBets);
            setResolvedBets(dataResolvedBets.bets);
            setTotalResolvedBets(dataResolvedBets.totalBets);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load bets");
        } finally {
            setIsLoading(false);
        }
    }, [pageResolvedBets]);

    useEffect(() => {
        const sseConnection = new EventSource(`${SERVER_BASE_URL}/sse`);

        sseConnection.onmessage = async (event) => {
            const { type, marketId } = JSON.parse(event.data);

            if ((type === "market_resolved" || type === "market_archived")) {
                loadActiveBets();
                loadResolvedBets();
                const updatedUser = await api.getUserInformation(user.id);
                updateUserInformation(updatedUser);
            }

            if (type === "bet_placed") {
                const hasBetOnMarket = activeBetsRef.current.some(bet => bet.marketId === marketId);
                if (hasBetOnMarket) {
                    loadActiveBets();
                }
            }
        }

        return () => sseConnection.close();
    }, [loadActiveBets, loadResolvedBets]);

    useEffect(() => {
        loadActiveBets();
    }, [loadActiveBets]);

    useEffect(() => {
        loadResolvedBets();
    }, [loadResolvedBets]);

    useEffect(() => {
        activeBetsRef.current = activeBets;
    }, [activeBets]);

    const generateApiKey = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const dataApiKey = await api.generateApiKey(user.id);
            setApiKey(dataApiKey.apiKey);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load bets");
        } finally {
            setIsLoading(false);
        }
    }


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
                        <h1 className="text-4xl font-bold text-gray-900">Profile</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                            <span className="text-sm font-bold text-primary">${user?.balance.toFixed(2)}</span>
                        </div>
                        <Button onClick={() => navigate({ to: `/` })}>Dashboard</Button>
                        <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
                            Logout
                        </Button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-12">
                            <p className="text-muted-foreground">Loading bets...</p>
                        </CardContent>
                    </Card>
                ) :
                    <div>
                        {/* User information */}
                        <div className="flex justify-center mb-8">
                            <Card className="w-full max-w-sm">
                                <CardContent className="pt-6 pb-6">
                                    <div className="text-center">
                                        <p className="font-bold text-3xl mb-1">{user?.username.charAt(0).toUpperCase()}{user?.username.substring(1)}</p>
                                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {apiKey ? (
                            <div className="flex justify-center mb-6">
                                <Card className="w-full max-w-lg">
                                    <CardContent>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm font-semibold">Your API Key</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                                Save this — it won't be shown again
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <code className="text-xs bg-gray-100 px-3 py-2 rounded-lg flex-1 overflow-hidden text-ellipsis">
                                                {apiKey}
                                            </code>
                                            <Button
                                                variant="outline"
                                                onClick={() => navigator.clipboard.writeText(apiKey)}
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="flex justify-center mb-6">
                                <Card className="w-full max-w-lg">
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm">API Key</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Generate a key to place bets programmatically
                                                </p>
                                            </div>
                                            <Button onClick={generateApiKey} variant="outline">
                                                Generate API Key
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Bets */}
                        <div className="flex gap-40 mt-6 justify-center">
                            {/* Active Bets */}
                            <div className="w-1/3">
                                <Card>
                                    <CardContent>
                                        <h2 className="text-xl font-bold mb-4 text-center">Active Bets</h2>
                                        <div className="flex flex-col gap-3">
                                            {activeBets.map((bet) => (
                                                <div key={bet.id} className="flex justify-between items-center p-3 rounded-lg border-2 border-secondary bg-secondary/5 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                                    <div>
                                                        <p className="font-semibold text-sm">{bet.marketTitle}</p>
                                                        <p className="text-xs text-muted-foreground">{bet.outcomeTitle}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-indigo-600">${bet.amount.toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground">{bet.odds.toFixed(2)}%</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {activeBets.length > 0 && (
                                            <div className="mt-6 pb-8 flex items-center justify-center gap-2">
                                                <div className="w-24 flex justify-end">
                                                    <Button
                                                        className="w-16"
                                                        onClick={() => setPageActiveBets(pageActiveBets - 1)}
                                                        disabled={(pageActiveBets <= 1)}
                                                        variant="outline"
                                                    >Previous</Button>
                                                </div>
                                                <p
                                                    className="w-16 text-center"
                                                >
                                                    {pageActiveBets} / {Math.ceil(totalActiveBets / PAGE_LIMIT)}
                                                </p>
                                                <div className="w-24 flex justify-start">
                                                    <Button
                                                        className="w-16"
                                                        onClick={() => setPageActiveBets(pageActiveBets + 1)}
                                                        disabled={(totalActiveBets <= (pageActiveBets * PAGE_LIMIT))}
                                                        variant="outline"
                                                    >Next</Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Resolved Bets */}
                            <div className="w-1/3">
                                <Card>
                                    <CardContent>
                                        <h2 className="text-xl font-bold mb-4 text-center">Resolved Bets</h2>
                                        <div className="flex flex-col gap-3">
                                            {resolvedBets.map((bet) => (
                                                <div key={bet.id} className="flex justify-between items-center p-3 rounded-lg border-2 border-secondary bg-secondary/5 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                                    <div>
                                                        <p className="font-semibold text-sm">{bet.marketTitle}</p>
                                                        <p className="text-xs text-muted-foreground">{bet.outcomeTitle}</p>
                                                    </div>
                                                    <span className={`text-sm font-bold ${bet.won ? "text-green-500" : "text-red-500"}`}>
                                                        {bet.won ? "Won" : "Lost"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {resolvedBets.length > 0 && (
                                            <div className="mt-6 pb-8 flex items-center justify-center gap-2">
                                                <div className="w-24 flex justify-end">
                                                    <Button
                                                        className="w-16"
                                                        onClick={() => setPageResolvedBets(pageResolvedBets - 1)}
                                                        disabled={(pageResolvedBets <= 1)}
                                                        variant="outline"
                                                    >Previous</Button>
                                                </div>
                                                <p
                                                    className="w-16 text-center"
                                                >
                                                    {pageResolvedBets} / {Math.ceil(totalResolvedBets / PAGE_LIMIT)}
                                                </p>
                                                <div className="w-24 flex justify-start">
                                                    <Button
                                                        className="w-16"
                                                        onClick={() => setPageResolvedBets(pageResolvedBets + 1)}
                                                        disabled={(totalResolvedBets <= (pageResolvedBets * PAGE_LIMIT))}
                                                        variant="outline"
                                                    >Next</Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                }
            </div>
        </div>
    )
}

export const Route = createFileRoute("/profile/$id")({
    component: ProfilePage,
});
