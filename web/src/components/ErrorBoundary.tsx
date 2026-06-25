import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { captureError } from '../utils/monitoring';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base p-4">
          <div className="card max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-ink">出错了</h2>

            <p className="text-sm text-ink-muted leading-relaxed">
              {this.state.error?.message || '发生了意外错误，请重试'}
            </p>

            <button onClick={this.handleRetry} className="btn btn-primary mt-2">
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
