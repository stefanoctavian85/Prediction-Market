import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { api, UserLeaderboard } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

function LeaderboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<UserLeaderboard[]>([]);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await api.getLeaderboard();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load markets");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadUsers();
    }, []);

    const getRankStyle = (place: number) => {
        if (place === 1) return "border-yellow-400 bg-yellow-50 hover:border-yellow-500 hover:bg-yellow-100";
        if (place === 2) return "border-gray-400 bg-gray-50 hover:border-gray-500 hover:bg-gray-100";
        if (place === 3) return "border-amber-600 bg-amber-50 hover:border-amber-700 hover:bg-amber-100";
        return "border-secondary bg-secondary/5 hover:border-primary/50 hover:bg-primary/5";
    };

    const getRankColor = (place: number) => {
        if (place === 1) return "text-yellow-500";
        if (place === 2) return "text-gray-400";
        if (place === 3) return "text-amber-600";
        return "text-muted-foreground";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900">Leaderboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                            <span className="text-sm font-bold text-primary">${user?.balance.toFixed(2)}</span>
                        </div>
                        <Button onClick={() => navigate({ to: "/" })}>Dashboard</Button>
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
                            <p className="text-muted-foreground">Loading leaderboard...</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="max-w-xl mx-auto">
                        <Card>
                            <CardContent className="p-3">
                                <div className="flex flex-col gap-3">
                                    {users.map((user) => (
                                        <div
                                            key={user.userId}
                                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${getRankStyle(user.place)}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-bold w-6 text-center ${getRankColor(user.place)}`}>
                                                    {user.place}.
                                                </span>
                                                <p className="font-semibold text-sm">{user.username}</p>
                                            </div>
                                            <p className="text-sm font-bold text-indigo-600">
                                                ${user.totalWinnings.toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

export const Route = createFileRoute('/leaderboard/')({
    component: LeaderboardPage,
})