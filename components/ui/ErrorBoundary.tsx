"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time errors in the React tree below it and shows a friendly
 * fallback instead of a blank white screen. Use one per major route segment.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the browser console; production should ship to Sentry/etc.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 m-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-red-800">Đã có lỗi xảy ra</h3>
              <p className="text-xs text-red-700 mt-1">
                Trang này không hiển thị được. Bạn có thể thử lại hoặc tải lại trang.
              </p>
              <p className="text-[11px] text-red-600 mt-2 font-mono break-all line-clamp-3">
                {this.state.error.message}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3" /> Thử lại
                </button>
                <button
                  onClick={() => location.reload()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  Tải lại trang
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
