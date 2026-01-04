
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface SecurityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  device?: string;
  timestamp: string;
}

const allAlerts: SecurityAlert[] = [
  {
    id: "1",
    type: "critical",
    title: "Vulnerable Device Detected",
    description: "Smart TV has outdated firmware with known security vulnerabilities.",
    device: "Smart TV (192.168.1.112)",
    timestamp: "2023-10-27 10:30 AM",
  },
  {
    id: "2",
    type: "warning",
    title: "Suspicious Network Activity",
    description: "Unusual data transfer patterns detected from iPhone 15.",
    device: "iPhone 15 (192.168.1.108)",
    timestamp: "2023-10-27 10:15 AM",
  },
  {
    id: "3",
    type: "info",
    title: "New Device Connected",
    description: "Unknown device joined the network.",
    device: "Unknown Device (192.168.1.125)",
    timestamp: "2023-10-27 09:00 AM",
  },
  {
    id: "4",
    type: "warning",
    title: "Multiple Failed Login Attempts",
    description: "Someone tried to log in to your router with the wrong password multiple times.",
    device: "Router (192.168.1.1)",
    timestamp: "2023-10-26 08:00 PM",
  },
  {
    id: "5",
    type: "info",
    title: "Security Policy Updated",
    description: "The network security policies have been successfully updated.",
    timestamp: "2023-10-26 05:00 PM",
  },
];

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SecurityAlert[]>(allAlerts);

  const handleResolve = (alertId: string) => {
    setAlerts(currentAlerts => currentAlerts.filter(alert => alert.id !== alertId));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return ShieldAlert;
      case 'warning': return AlertTriangle;
      default: return Shield;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return 'text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">All Security Alerts</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.length > 0 ? (
              alerts.map((alert) => {
                const AlertIcon = getAlertIcon(alert.type);
                
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border",
                      "bg-card/50 backdrop-blur-glass hover:bg-card/80 transition-all",
                      alert.type === 'critical' && 'border-destructive/20',
                      alert.type === 'warning' && 'border-warning/20',
                      alert.type === 'info' && 'border-primary/20'
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      alert.type === 'critical' && 'bg-destructive/20',
                      alert.type === 'warning' && 'bg-warning/20',
                      alert.type === 'info' && 'bg-primary/20'
                    )}>
                      <AlertIcon className={cn("h-5 w-5", getAlertColor(alert.type))} />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge 
                          variant={alert.type === 'critical' ? 'destructive' : 
                                  alert.type === 'warning' ? 'secondary' : 'default'}
                        >
                          {alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      {alert.device && (
                        <p className="text-xs text-muted-foreground">Device: {alert.device}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => handleResolve(alert.id)}>
                      Resolve
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-success" />
                <h3 className="font-semibold">All Clear!</h3>
                <p className="text-sm">No security alerts to display.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
