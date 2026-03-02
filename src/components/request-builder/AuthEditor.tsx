import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface AuthConfig {
  type: AuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
}

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const [showSecrets, setShowSecrets] = useState(false);

  const updateAuth = (updates: Partial<AuthConfig>) => {
    onChange({ ...auth, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Authentication</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSecrets(!showSecrets)}
          className="gap-1 text-muted-foreground"
        >
          {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showSecrets ? 'Hide' : 'Show'}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Auth Type</Label>
          <Select
            value={auth.type}
            onValueChange={(value: AuthType) => updateAuth({ type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select auth type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="api-key">API Key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {auth.type === 'bearer' && (
          <div className="space-y-2">
            <Label>Token</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Enter bearer token"
              value={auth.bearer?.token || ''}
              onChange={(e) =>
                updateAuth({ bearer: { token: e.target.value } })
              }
              className="font-mono text-sm"
            />
          </div>
        )}

        {auth.type === 'basic' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Username"
                value={auth.basic?.username || ''}
                onChange={(e) =>
                  updateAuth({
                    basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password || '' },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                placeholder="Password"
                value={auth.basic?.password || ''}
                onChange={(e) =>
                  updateAuth({
                    basic: { ...auth.basic, password: e.target.value, username: auth.basic?.username || '' },
                  })
                }
              />
            </div>
          </div>
        )}

        {auth.type === 'api-key' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input
                  placeholder="X-API-Key"
                  value={auth.apiKey?.key || ''}
                  onChange={(e) =>
                    updateAuth({
                      apiKey: {
                        ...auth.apiKey,
                        key: e.target.value,
                        value: auth.apiKey?.value || '',
                        addTo: auth.apiKey?.addTo || 'header',
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  placeholder="API key value"
                  value={auth.apiKey?.value || ''}
                  onChange={(e) =>
                    updateAuth({
                      apiKey: {
                        ...auth.apiKey,
                        value: e.target.value,
                        key: auth.apiKey?.key || '',
                        addTo: auth.apiKey?.addTo || 'header',
                      },
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add to</Label>
              <Select
                value={auth.apiKey?.addTo || 'header'}
                onValueChange={(value: 'header' | 'query') =>
                  updateAuth({
                    apiKey: {
                      ...auth.apiKey,
                      addTo: value,
                      key: auth.apiKey?.key || '',
                      value: auth.apiKey?.value || '',
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="query">Query Parameter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {auth.type === 'none' && (
          <p className="text-sm text-muted-foreground">
            No authentication will be added to the request.
          </p>
        )}
      </div>
    </div>
  );
}
