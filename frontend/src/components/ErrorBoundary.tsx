import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error boundary:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-destructive/30">
            <CardContent className="py-10 px-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold">
                {this.props.fallbackTitle ?? "Something went wrong"}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {this.state.message || "This page encountered an unexpected error."}
              </p>
              <Button
                className="mt-6"
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false, message: undefined });
                  window.location.reload();
                }}
              >
                Reload page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
