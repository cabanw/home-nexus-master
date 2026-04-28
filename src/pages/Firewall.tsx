import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FirewallRule {
  id: string;
  user_id: string;
  source: string;
  destination: string;
  port: string;
  action: "allow" | "deny";
  enabled: boolean;
  created_at: string | null;
}

export default function FirewallPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<FirewallRule>>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["firewall_rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FirewallRule[];
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (rule: Partial<FirewallRule> & { id?: string }) => {
      if (rule.id) {
        const { error } = await supabase
          .from("firewall_rules")
          .update({
            source: rule.source,
            destination: rule.destination,
            port: rule.port,
            action: rule.action,
          })
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("firewall_rules")
          .insert({
            user_id: user!.id,
            source: rule.source ?? "any",
            destination: rule.destination ?? "any",
            port: rule.port ?? "any",
            action: rule.action ?? "allow",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall_rules"] });
      setIsDialogOpen(false);
      setIsEditing(null);
      setCurrentRule({});
      toast.success("Rule saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("firewall_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall_rules"] });
      toast.success("Rule deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("firewall_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firewall_rules"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const handleEdit = (rule: FirewallRule) => {
    setIsEditing(rule.id);
    setCurrentRule(rule);
    setIsDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setIsEditing(null);
    setCurrentRule({});
    setIsDialogOpen(true);
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Firewall Rules
          {!isLoading && (
            <Badge variant="secondary" className="ml-1">{rules.length}</Badge>
          )}
        </CardTitle>
        <Button onClick={handleOpenAdd} disabled={!user}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No firewall rules configured. Add one to get started.
          </p>
        ) : (
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
                      onCheckedChange={(enabled) => toggleMutation.mutate({ id: rule.id, enabled })}
                      disabled={toggleMutation.isPending}
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The rule ({rule.source} → {rule.destination}:{rule.port}) will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(rule.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                value={currentRule.source ?? ""}
                onChange={(e) => setCurrentRule({ ...currentRule, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination IP</Label>
              <Input
                id="destination"
                placeholder="e.g., 8.8.8.8 or any"
                value={currentRule.destination ?? ""}
                onChange={(e) => setCurrentRule({ ...currentRule, destination: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                placeholder="e.g., 443 or any"
                value={currentRule.port ?? ""}
                onChange={(e) => setCurrentRule({ ...currentRule, port: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={currentRule.action ?? "allow"}
                onValueChange={(value: "allow" | "deny") =>
                  setCurrentRule({ ...currentRule, action: value })
                }
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate({ ...currentRule, id: isEditing ?? undefined })}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
