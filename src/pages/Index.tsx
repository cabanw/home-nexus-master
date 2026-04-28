
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Activity,
  Network,
  Router,
  Smartphone,
  Monitor,
  Users,
  LogOut,
  Crown,
  HardDrive,
  Settings,
  User
} from "lucide-react";
import SecurityDashboard from "@/components/SecurityDashboard";
import UserManagement from "@/components/UserManagement";
import DevicesPage from "@/pages/Devices";
import FirewallPage from "@/pages/Firewall";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import type { ScannedDevice } from "@/types/device";

const fetchDevices = (): Promise<ScannedDevice[]> =>
  fetch("/api/scan").then((r) => r.json());

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();

  const { data: devices = [], isLoading: devicesLoading } = useQuery<ScannedDevice[]>({
    queryKey: ["devices"],
    queryFn: fetchDevices,
    staleTime: 60_000,
    enabled: !!user,
  });

  const onlineDevices = devices.filter((d) => d.status === "online");
  const recentDevices = [...devices]
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 3);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-glass">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                <Network className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">NetControl Pro</h1>
                <p className="text-sm text-muted-foreground">Network & Smart Home Management</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-sm text-success">Network Online</span>
              </div>
              <Badge variant="outline" className="bg-primary/10">
                {import.meta.env.VITE_SCAN_SUBNET ?? '192.168.1.0/24'}
              </Badge>
              <div className="flex items-center gap-2 pl-4 border-l border-border">
                {isAdmin && (
                  <Badge variant="secondary" className="gap-1">
                    <Crown className="w-3 h-3" />
                    Admin
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <User className="h-4 w-4" />
                      {user.email}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} bg-card/50 backdrop-blur-glass`}>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="firewall" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Firewall
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-card border-border shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Router className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Network Devices</p>
                      {devicesLoading
                        ? <Skeleton className="h-8 w-12 mt-1" />
                        : <p className="text-2xl font-bold">{devices.length}</p>
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/20 rounded-lg">
                      <Smartphone className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Online Devices</p>
                      {devicesLoading
                        ? <Skeleton className="h-8 w-12 mt-1" />
                        : <p className="text-2xl font-bold">{onlineDevices.length}</p>
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/20 rounded-lg">
                      <Shield className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Security Score</p>
                      <p className="text-2xl font-bold">78%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <Monitor className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bandwidth Usage</p>
                      <p className="text-2xl font-bold">245 Mbps</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Access */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-card border-border shadow-card">
                <CardHeader>
                  <CardTitle>Recent Network Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {devicesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : recentDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  ) : (
                    <div className="space-y-3">
                      {recentDevices.map((device) => (
                        <div key={device.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-success' : 'bg-muted-foreground'}`} />
                            <span className="text-sm">{device.name} — {device.ip}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-card">
                <CardHeader>
                  <CardTitle>Smart Home Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <span className="text-sm">Living Room Lights</span>
                      <Badge className="bg-success/20 text-success">ON</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <span className="text-sm">Main Thermostat</span>
                      <Badge className="bg-primary/20 text-primary">72°F</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <span className="text-sm">Security System</span>
                      <Badge className="bg-success/20 text-success">ARMED</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <SecurityDashboard />
          </TabsContent>

          <TabsContent value="devices">
            <DevicesPage />
          </TabsContent>

          <TabsContent value="firewall">
            <FirewallPage />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
