import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Info, Scale, User } from 'lucide-react';

export default function About() {
  const appName = 'POAM Tracker Desktop';
  const version = '1.0.1';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight title-row">About</h1>
          <p className="text-muted-foreground mt-1">Learn more about this application</p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          v{version}
        </div>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>{appName}</CardTitle>
              <CardDescription>Security Compliance Management</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Author</div>
                  <div className="font-medium">Jeremiah Price</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Version</div>
                  <div className="font-medium">{version}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Terms of Use</div>
                  <div className="font-medium">By using this application you agree to the license, terms, and acceptable use.</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                This software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. Use within authorized environments only.
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-sm text-muted-foreground">
            <p>
              Copyright © {new Date().getFullYear()} Jeremiah Price. All rights reserved.
            </p>
            <p className="mt-1">Developed for professional POA&M tracking and security compliance workflows.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


