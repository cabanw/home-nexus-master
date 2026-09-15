
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

export default function ProfilePage() {
  const { user } = useAuth();
  const username: string | undefined = user?.user_metadata.username;
  const displayName = username ?? user?.email ?? "";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/50 shadow-lg">
            <AvatarImage src={user?.user_metadata.avatar_url} />
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle>{displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {username && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} disabled />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
