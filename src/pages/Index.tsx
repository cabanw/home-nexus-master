import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wifi, 
  Home, 
  Shield, 
  Activity, 
  Network,
  Router,
  Smartphone,
  Monitor
} from "lucide-react";
import NetworkScanner from "@/components/NetworkScanner";
import SmartHomePanel from "@/components/SmartHomePanel";
import NetworkTopology from "@/components/NetworkTopology";
import SecurityDashboard from "@/components/SecurityDashboard";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

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
                192.168.1.0/24
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-card/50 backdrop-blur-glass">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="smarthome" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Smart Home
            </TabsTrigger>
            <TabsTrigger value="topology" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Topology
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
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
                      <p className="text-2xl font-bold">12</p>
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
                      <p className="text-sm text-muted-foreground">Smart Devices</p>
                      <p className="text-2xl font-bold">8</p>
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
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-success rounded-full" />
                        <span className="text-sm">iPhone 15 connected</span>
                      </div>
                      <span className="text-xs text-muted-foreground">2 min ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-warning rounded-full" />
                        <span className="text-sm">Smart TV firmware update</span>
                      </div>
                      <span className="text-xs text-muted-foreground">15 min ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-destructive rounded-full" />
                        <span className="text-sm">Security scan detected issue</span>
                      </div>
                      <span className="text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                  </div>
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

          <TabsContent value="scanner">
            <NetworkScanner />
          </TabsContent>

          <TabsContent value="smarthome">
            <SmartHomePanel />
          </TabsContent>

          <TabsContent value="topology">
            <NetworkTopology />
          </TabsContent>

          <TabsContent value="security">
            <SecurityDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
