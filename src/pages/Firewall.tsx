
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, PlusCircle, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface FirewallRule {
  id: string;
  source: string;
  destination: string;
  port: string;
  action: "allow" | "deny";
  enabled: boolean;
}

const initialRules: FirewallRule[] = [
  {
    id: "1",
    source: "any",
    destination: "192.168.1.112",
    port: "80",
    action: "allow",
    enabled: true,
  },
  {
    id: "2",
    source: "192.168.1.108",
    destination: "any",
    port: "any",
    action: "deny",
    enabled: true,
  },
  {
    id: "3",
    source: "any",
    destination: "any",
    port: "22",
    action: "deny",
    enabled: false,
  },
];

export default function FirewallPage() {
  const [rules, setRules] = useState<FirewallRule[]>(initialRules);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<FirewallRule>>({});

  const handleAddOrUpdateRule = () => {
    if (isEditing) {
      setRules(rules.map(r => r.id === isEditing ? { ...r, ...currentRule } as FirewallRule : r));
    } else {
      const newRule: FirewallRule = {
        id: Date.now().toString(),
        source: currentRule.source || 'any',
        destination: currentRule.destination || 'any',
        port: currentRule.port || 'any',
        action: currentRule.action || 'allow',
        enabled: true,
        ...currentRule,
      };
      setRules([...rules, newRule]);
    }
    setIsDialogOpen(false);
    setIsEditing(null);
    setCurrentRule({});
  };

  const handleEdit = (rule: FirewallRule) => {
    setIsEditing(rule.id);
    setCurrentRule(rule);
    setIsDialogOpen(true);
  };

  const handleDelete = (ruleId: string) => {
    setRules(rules.filter(r => r.id !== ruleId));
  };

  const handleToggle = (ruleId: string) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Firewall Rules
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setIsEditing(null);
              setCurrentRule({});
              setIsDialogOpen(true);
            }}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Rule" : "Add New Rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source IP</Label>
                <Input 
                  id="source" 
                  placeholder="e.g., 192.168.1.100 or any"
                  value={currentRule.source || ''} 
                  onChange={e => setCurrentRule({ ...currentRule, source: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination IP</Label>
                <Input 
                  id="destination" 
                  placeholder="e.g., 8.8.8.8 or any" 
                  value={currentRule.destination || ''}
                  onChange={e => setCurrentRule({ ...currentRule, destination: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input 
                  id="port" 
                  placeholder="e.g., 443 or any" 
                  value={currentRule.port || ''}
                  onChange={e => setCurrentRule({ ...currentRule, port: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select
                  value={currentRule.action || 'allow'}
                  onValueChange={(value: "allow" | "deny") => setCurrentRule({ ...currentRule, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddOrUpdateRule}>Save Rule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className={cn(!rule.enabled && "text-muted-foreground")}>
                <TableCell>
                  <Switch 
                    checked={rule.enabled} 
                    onCheckedChange={() => handleToggle(rule.id)}
                  />
                </TableCell>
                <TableCell>{rule.source}</TableCell>
                <TableCell>{rule.destination}</TableCell>
                <TableCell>{rule.port}</TableCell>
                <TableCell>
                  <Badge variant={rule.action === "allow" ? "default" : "destructive"}>
                    {rule.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
