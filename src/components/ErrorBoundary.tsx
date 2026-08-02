import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: 20, maxWidth: 600, margin: '40px auto' }}>
          <Card title="Algo salió mal">
            <div style={{ padding: '0 20px 20px 20px' }}>
              <p style={{ color: 'var(--bad)' }}>
                Se ha producido un error crítico en esta sección de la aplicación.
              </p>
              <pre style={{ 
                background: 'var(--layer-2)', 
                padding: 10, 
                borderRadius: 4, 
                fontSize: 12, 
                overflowX: 'auto',
                color: 'var(--ink-soft)'
              }}>
                {this.state.error?.toString()}
              </pre>
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn-primary"
                style={{ marginTop: 20 }}
              >
                Recargar Pantalla
              </button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
